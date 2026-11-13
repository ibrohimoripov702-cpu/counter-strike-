import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import {
  BOMBSITES,
  getGroundHeightAt,
  resolveMapCollision,
  WEAPONS,
  type WeaponId,
} from '../shared/gameData.ts';
import type { NetPlayer, RoomStateSnapshot } from '../shared/protocol.ts';
import { buildDust2Environment, detectSoftwareWebGL } from '../game/dust2Scene.ts';
import {
  buildBombWorldModel,
  buildCharacterModel,
  buildViewModel,
  buildWeaponMesh,
  type CharacterRig,
} from '../game/models.ts';
import { soundEngine } from '../audio/soundEngine.ts';

export interface LocalHudState {
  weapon: WeaponId;
  inventory: WeaponId[];
  ammoInMag: Record<string, number>;
  ammoReserve: Record<string, number>;
  reloading: boolean;
  scopeLevel: 0 | 1 | 2;
  plantProgress: number;
  inBombSite: 'A' | 'B' | null;
  nearPlantedBomb: boolean;
  pointerLocked: boolean;
  crosshairSpread: number;
  hitMarkerAt: number;
  hitMarkerHeadshot: boolean;
  damageFlashAt: number;
  localPos: { x: number; y: number; z: number; yaw: number };
}

interface TracerEffect {
  line: THREE.Line;
  expiresAt: number;
}

interface GameViewportProps {
  snapshotRef: React.MutableRefObject<RoomStateSnapshot | null>;
  yourIdRef: React.MutableRefObject<string | null>;
  buyMenuOpen: boolean;
  chatOpen: boolean;
  onToggleBuyMenu: () => void;
  onToggleScoreboard: (open: boolean) => void;
  onOpenChat: () => void;
  onHudSync: (hud: LocalHudState) => void;
  onSendMove: (
    x: number,
    y: number,
    z: number,
    yaw: number,
    pitch: number,
    crouching: boolean,
    weapon: WeaponId
  ) => void;
  onSendShoot: (
    origin: [number, number, number],
    dir: [number, number, number],
    weapon: WeaponId
  ) => void;
  onPlantStart: (site: 'A' | 'B') => void;
  onPlantComplete: (site: 'A' | 'B', x: number, y: number, z: number) => void;
  onDefuseToggle: (active: boolean) => void;
  pendingWeaponGrantRef: React.MutableRefObject<WeaponId | null>;
  shotEventQueueRef: React.MutableRefObject<
    Array<{
      shooterId: string;
      weapon: WeaponId;
      origin: [number, number, number];
      endPoint: [number, number, number];
      hitPlayerId?: string;
      headshot?: boolean;
    }>
  >;
  damageFlashQueueRef: React.MutableRefObject<number[]>;
  sensitivity: number;
}

// Pre-allocated math helpers outside render loop
const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _moveDir = new THREE.Vector3();
const _shootDir = new THREE.Vector3();
const _euler = new THREE.Euler(0, 0, 0, 'YXZ');

export function GameViewport(props: GameViewportProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const propsRef = useRef(props);
  propsRef.current = props;

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareWebGL();
    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    const handleContextLost = (e: Event) => {
      e.preventDefault();
    };
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      75,
      container.clientWidth / Math.max(1, container.clientHeight),
      0.08,
      280
    );
    scene.add(camera);

    const env = buildDust2Environment(scene, renderer, isSoftwareGl);

    // First-person weapon viewmodel attached to camera
    const viewModelHolder = new THREE.Group();
    camera.add(viewModelHolder);

    const muzzleLight = new THREE.PointLight(0xffb44c, 0, 8);
    muzzleLight.position.set(0.25, -0.15, -0.95);
    camera.add(muzzleLight);

    // Bomb world object
    const bombWorld = buildBombWorldModel();
    bombWorld.group.visible = false;
    scene.add(bombWorld.group);

    // Remote character rigs
    const remoteRigs = new Map<string, { rig: CharacterRig; team: string; lastX: number; lastZ: number; walkPhase: number }>();
    const tracers: TracerEffect[] = [];

    // Local player simulation state
    let posX = 0;
    let posY = 0;
    let posZ = 46;
    let velY = 0;
    let yaw = 0;
    let pitch = 0;
    let onGround = true;
    let crouching = false;
    let currentEyeHeight = 1.62;
    let lastSyncedRound = -1;
    let lastSyncedAlive = false;

    let currentWeapon: WeaponId = 'glock';
    let primaryWeapon: WeaponId | null = null;
    let secondaryWeapon: WeaponId = 'glock';
    let currentViewModel: THREE.Group | null = null;
    let currentViewModelId: WeaponId | null = null;

    const ammoInMag: Record<string, number> = {
      glock: 20,
      usp: 12,
      deagle: 7,
      ak47: 30,
      m4a1: 30,
      awp: 10,
    };
    const ammoReserve: Record<string, number> = {
      glock: 120,
      usp: 100,
      deagle: 35,
      ak47: 90,
      m4a1: 90,
      awp: 30,
    };

    let reloading = false;
    let reloadEndAt = 0;
    let lastShotAt = 0;
    let mouseDownLeft = false;
    let shotFiredWhileMouseDown = false;
    let scopeLevel: 0 | 1 | 2 = 0;
    let recoilOffset = 0;
    let weaponKickZ = 0;
    let walkBobTime = 0;
    let lastFootstepAt = 0;
    let plantProgress = 0;
    let plantStartedSent = false;
    let defusingActive = false;
    let hitMarkerAt = 0;
    let hitMarkerHeadshot = false;
    let damageFlashAt = 0;
    let lastNetworkMoveSentAt = 0;
    let lastHudSyncAt = 0;
    let lastBombBeepAt = 0;

    function rebuildViewModel(w: WeaponId) {
      if (currentViewModelId === w && currentViewModel) return;
      if (currentViewModel) {
        viewModelHolder.remove(currentViewModel);
      }
      currentViewModel = buildViewModel(w);
      viewModelHolder.add(currentViewModel);
      currentViewModelId = w;
    }

    function getInventory(hasBomb: boolean): WeaponId[] {
      const inv: WeaponId[] = [];
      if (primaryWeapon) inv.push(primaryWeapon);
      inv.push(secondaryWeapon);
      inv.push('knife');
      if (hasBomb) inv.push('c4');
      return inv;
    }

    function switchWeapon(w: WeaponId) {
      if (w === currentWeapon) return;
      currentWeapon = w;
      reloading = false;
      scopeLevel = 0;
      camera.fov = 75;
      camera.updateProjectionMatrix();
      viewModelHolder.visible = true;
      rebuildViewModel(w);
      soundEngine.playClick(700, 0.06);
    }

    function startReload() {
      const spec = WEAPONS[currentWeapon];
      if (!spec || spec.magSize <= 0 || reloading) return;
      const inMag = ammoInMag[currentWeapon] ?? 0;
      const res = ammoReserve[currentWeapon] ?? 0;
      if (inMag >= spec.magSize || res <= 0) return;
      reloading = true;
      scopeLevel = 0;
      camera.fov = 75;
      camera.updateProjectionMatrix();
      viewModelHolder.visible = true;
      reloadEndAt = performance.now() + spec.reloadTimeMs;
      soundEngine.playReload();
    }

    function spawnTracer(origin: [number, number, number], endPoint: [number, number, number], isAwp: boolean) {
      const pts = [
        new THREE.Vector3(origin[0], origin[1] - 0.05, origin[2]),
        new THREE.Vector3(endPoint[0], endPoint[1], endPoint[2]),
      ];
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const mat = new THREE.LineBasicMaterial({
        color: isAwp ? 0xffe49e : 0xffcc66,
        transparent: true,
        opacity: isAwp ? 0.85 : 0.45,
      });
      const line = new THREE.Line(geo, mat);
      scene.add(line);
      tracers.push({ line, expiresAt: performance.now() + (isAwp ? 180 : 80) });
    }

    // Input listeners
    const keys: Record<string, boolean> = {};
    let pointerLocked = false;
    let draggingFallback = false;

    const onPointerLockChange = () => {
      pointerLocked = document.pointerLockElement === renderer.domElement;
    };

    const onMouseMove = (e: MouseEvent) => {
      if (propsRef.current.buyMenuOpen || propsRef.current.chatOpen) return;
      if (!pointerLocked && !draggingFallback) return;
      const sens = propsRef.current.sensitivity * (scopeLevel === 2 ? 0.25 : scopeLevel === 1 ? 0.48 : 1.0);
      yaw -= e.movementX * 0.0022 * sens;
      pitch = Math.max(-Math.PI / 2.1, Math.min(Math.PI / 2.1, pitch - e.movementY * 0.0022 * sens));
    };

    const onMouseDown = (e: MouseEvent) => {
      soundEngine.unlock();
      if (propsRef.current.buyMenuOpen || propsRef.current.chatOpen) return;
      if (!pointerLocked && e.target === renderer.domElement) {
        renderer.domElement.requestPointerLock?.();
        draggingFallback = true;
      }
      if (e.button === 0) {
        mouseDownLeft = true;
        shotFiredWhileMouseDown = false;
      } else if (e.button === 2) {
        if (WEAPONS[currentWeapon].canScope && !reloading) {
          scopeLevel = ((scopeLevel + 1) % 3) as 0 | 1 | 2;
          camera.fov = scopeLevel === 1 ? 30 : scopeLevel === 2 ? 13 : 75;
          camera.updateProjectionMatrix();
          viewModelHolder.visible = scopeLevel === 0;
          soundEngine.playClick(1300, 0.08);
        }
      }
    };

    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 0) {
        mouseDownLeft = false;
        shotFiredWhileMouseDown = false;
      }
      draggingFallback = false;
    };

    const onContextMenu = (e: MouseEvent) => e.preventDefault();

    const onWheel = (e: WheelEvent) => {
      if (propsRef.current.buyMenuOpen || propsRef.current.chatOpen) return;
      const snap = propsRef.current.snapshotRef.current;
      const me = snap?.players.find((p) => p.id === propsRef.current.yourIdRef.current);
      const inv = getInventory(Boolean(me?.hasBomb));
      const idx = inv.indexOf(currentWeapon);
      const next = (idx + (e.deltaY > 0 ? 1 : -1) + inv.length) % inv.length;
      switchWeapon(inv[next]);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (propsRef.current.chatOpen) return;

      if (e.code === 'KeyB') {
        e.preventDefault();
        if (document.pointerLockElement) document.exitPointerLock?.();
        propsRef.current.onToggleBuyMenu();
        return;
      }
      if (e.code === 'Enter' || e.code === 'KeyT') {
        if (!propsRef.current.buyMenuOpen) {
          e.preventDefault();
          if (document.pointerLockElement) document.exitPointerLock?.();
          propsRef.current.onOpenChat();
          return;
        }
      }
      if (e.code === 'Tab') {
        e.preventDefault();
        propsRef.current.onToggleScoreboard(true);
        return;
      }

      if (propsRef.current.buyMenuOpen) return;

      keys[e.code] = true;

      if (e.code === 'KeyR') startReload();
      if (e.code === 'Digit1' && primaryWeapon) switchWeapon(primaryWeapon);
      if (e.code === 'Digit2') switchWeapon(secondaryWeapon);
      if (e.code === 'Digit3') switchWeapon('knife');
      if (e.code === 'Digit4') {
        const snap = propsRef.current.snapshotRef.current;
        const me = snap?.players.find((p) => p.id === propsRef.current.yourIdRef.current);
        if (me?.hasBomb) switchWeapon('c4');
      }
      if (e.code === 'Space' && onGround) {
        velY = 6.3;
        onGround = false;
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keys[e.code] = false;
      if (e.code === 'Tab') {
        propsRef.current.onToggleScoreboard(false);
      }
    };

    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = Math.max(1, container.clientHeight);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    document.addEventListener('pointerlockchange', onPointerLockChange);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    renderer.domElement.addEventListener('contextmenu', onContextMenu);
    window.addEventListener('wheel', onWheel);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('resize', onResize);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // Initialize default viewmodel
    rebuildViewModel(currentWeapon);

    let frameId = 0;
    let prevTime = performance.now();

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function tick() {
      const now = performance.now();
      const dt = Math.min(0.05, (now - prevTime) / 1000);
      prevTime = now;

      const {
        snapshotRef,
        yourIdRef,
        buyMenuOpen,
        chatOpen,
        pendingWeaponGrantRef,
        shotEventQueueRef,
        damageFlashQueueRef,
      } = propsRef.current;

      const snap = snapshotRef.current;
      const myId = yourIdRef.current;
      const me: NetPlayer | undefined = snap?.players.find((p) => p.id === myId);

      // Process newly purchased weapon
      if (pendingWeaponGrantRef.current) {
        const bought = pendingWeaponGrantRef.current;
        pendingWeaponGrantRef.current = null;
        const spec = WEAPONS[bought];
        if (spec) {
          ammoInMag[bought] = spec.magSize;
          ammoReserve[bought] = spec.reserveAmmo;
          if (spec.slot === 1) {
            primaryWeapon = bought;
          } else if (spec.slot === 2) {
            secondaryWeapon = bought;
          }
          switchWeapon(bought);
        }
      }

      // Sync spawn position on new round or respawn
      if (snap && me) {
        if (snap.roundNumber !== lastSyncedRound || (me.alive && !lastSyncedAlive)) {
          posX = me.x;
          posY = me.y;
          posZ = me.z;
          yaw = me.yaw;
          pitch = me.pitch;
          velY = 0;
          onGround = true;
          lastSyncedRound = snap.roundNumber;

          // Reset default pistol if died previous round
          if (!me.alive) {
            primaryWeapon = null;
          }
          const defPistol: WeaponId = me.team === 'T' ? 'glock' : 'usp';
          if (secondaryWeapon !== 'deagle') {
            secondaryWeapon = defPistol;
          }
          if (!primaryWeapon && currentWeapon !== 'knife' && currentWeapon !== 'c4') {
            currentWeapon = secondaryWeapon;
            rebuildViewModel(currentWeapon);
          }
          if (me.alive) {
            for (const key of Object.keys(ammoInMag)) {
              const s = WEAPONS[key as WeaponId];
              if (s && s.magSize > 0) {
                ammoInMag[key] = s.magSize;
                ammoReserve[key] = s.reserveAmmo;
              }
            }
          }
        }
        lastSyncedAlive = me.alive;
      }

      // Drain damage flashes
      while (damageFlashQueueRef.current.length > 0) {
        damageFlashQueueRef.current.shift();
        damageFlashAt = now;
      }

      // Drain incoming shot events for tracers + audio
      while (shotEventQueueRef.current.length > 0) {
        const ev = shotEventQueueRef.current.shift()!;
        if (ev.shooterId !== myId) {
          const dist = Math.hypot(ev.origin[0] - posX, ev.origin[1] - posY, ev.origin[2] - posZ);
          soundEngine.playShoot(ev.weapon, dist);
        } else if (ev.hitPlayerId) {
          hitMarkerAt = now;
          hitMarkerHeadshot = Boolean(ev.headshot);
          soundEngine.playHit(Boolean(ev.headshot));
        }
        if (ev.weapon !== 'knife') {
          spawnTracer(ev.origin, ev.endPoint, ev.weapon === 'awp');
        }
      }

      // Complete reload timer
      if (reloading && now >= reloadEndAt) {
        reloading = false;
        const spec = WEAPONS[currentWeapon];
        if (spec && spec.magSize > 0) {
          const cur = ammoInMag[currentWeapon] ?? 0;
          const res = ammoReserve[currentWeapon] ?? 0;
          const needed = Math.min(spec.magSize - cur, res);
          ammoInMag[currentWeapon] = cur + needed;
          ammoReserve[currentWeapon] = res - needed;
        }
      }

      // Local movement physics
      const canMove = Boolean(me?.alive) && snap?.phase !== 'FREEZETIME' && !buyMenuOpen && !chatOpen;
      let moveSpeed = 0;

      if (canMove) {
        crouching = Boolean(keys['ControlLeft'] || keys['KeyC']);
        const walking = Boolean(keys['ShiftLeft']);
        const spec = WEAPONS[currentWeapon];
        const baseSpeed = crouching ? 3.1 : walking ? 3.5 : 6.4;
        const maxSpeed = baseSpeed * (spec?.moveSpeedMult ?? 1) * (scopeLevel > 0 ? 0.65 : 1);

        _forward.set(-Math.sin(yaw), 0, -Math.cos(yaw));
        _right.set(Math.cos(yaw), 0, -Math.sin(yaw));
        _moveDir.set(0, 0, 0);

        if (keys['KeyW']) _moveDir.add(_forward);
        if (keys['KeyS']) _moveDir.sub(_forward);
        if (keys['KeyD']) _moveDir.add(_right);
        if (keys['KeyA']) _moveDir.sub(_right);

        if (_moveDir.lengthSq() > 0) {
          _moveDir.normalize();
          moveSpeed = maxSpeed;
          const nextX = posX + _moveDir.x * maxSpeed * dt;
          const nextZ = posZ + _moveDir.z * maxSpeed * dt;
          const res = resolveMapCollision(nextX, posY, nextZ, 0.45, crouching ? 1.25 : 1.75);
          posX = res.x;
          posZ = res.z;

          if (onGround && !walking && !crouching && now - lastFootstepAt > 360) {
            lastFootstepAt = now;
            soundEngine.playFootstep();
          }
        }

        // Gravity & ramps
        velY -= 18.5 * dt;
        posY += velY * dt;
        const groundY = getGroundHeightAt(posX, posZ, posY);
        if (posY <= groundY) {
          posY = groundY;
          velY = 0;
          onGround = true;
        } else {
          onGround = false;
        }
      }

      // Smooth crouch eye height
      const targetEye = crouching ? 1.08 : 1.62;
      currentEyeHeight = THREE.MathUtils.damp(currentEyeHeight, targetEye, 16, dt);

      // Recoil recovery & firing
      recoilOffset = THREE.MathUtils.damp(recoilOffset, 0, 11, dt);
      weaponKickZ = THREE.MathUtils.damp(weaponKickZ, 0, 18, dt);

      const spec = WEAPONS[currentWeapon];
      const canShoot =
        Boolean(me?.alive) &&
        snap?.phase !== 'FREEZETIME' &&
        !buyMenuOpen &&
        !chatOpen &&
        !reloading &&
        currentWeapon !== 'c4';

      if (canShoot && mouseDownLeft && spec) {
        const allowFire = spec.automatic || !shotFiredWhileMouseDown;
        if (allowFire && now - lastShotAt >= spec.fireRateMs) {
          const curMag = ammoInMag[currentWeapon] ?? 0;
          if (spec.magSize === 0 || curMag > 0) {
            lastShotAt = now;
            shotFiredWhileMouseDown = true;
            if (spec.magSize > 0) {
              ammoInMag[currentWeapon] = curMag - 1;
              if (ammoInMag[currentWeapon] === 0 && (ammoReserve[currentWeapon] ?? 0) > 0) {
                setTimeout(() => startReload(), 160);
              }
            }

            soundEngine.playShoot(currentWeapon, 0);
            muzzleLight.intensity = currentWeapon === 'knife' || spec.suppressed ? 0 : 4.5;
            weaponKickZ = currentWeapon === 'awp' ? 0.14 : 0.055;

            const moveSpread = (moveSpeed / 6.4) * 0.025;
            const totalSpread = spec.spread + moveSpread;
            const spreadX = (Math.random() - 0.5) * totalSpread;
            const spreadY = (Math.random() - 0.5) * totalSpread;

            _euler.set(pitch + recoilOffset + spreadY, yaw + spreadX, 0, 'YXZ');
            _shootDir.set(0, 0, -1).applyEuler(_euler).normalize();

            propsRef.current.onSendShoot(
              [posX, posY + currentEyeHeight, posZ],
              [_shootDir.x, _shootDir.y, _shootDir.z],
              currentWeapon
            );

            recoilOffset = Math.min(0.18, recoilOffset + spec.recoil);

            // Auto unscope AWP after shot
            if (currentWeapon === 'awp' && scopeLevel > 0) {
              scopeLevel = 0;
              camera.fov = 75;
              camera.updateProjectionMatrix();
              viewModelHolder.visible = true;
            }
          } else {
            startReload();
          }
        }
      }

      muzzleLight.intensity = THREE.MathUtils.damp(muzzleLight.intensity, 0, 28, dt);

      // Bomb site & plant / defuse checks
      let inBombSite: 'A' | 'B' | null = null;
      for (const siteKey of ['A', 'B'] as const) {
        const s = BOMBSITES[siteKey];
        if (Math.hypot(posX - s.x, posZ - s.z) <= s.radius && Math.abs(posY - s.y) < 2.2) {
          inBombSite = siteKey;
          break;
        }
      }

      const nearPlantedBomb =
        Boolean(snap?.bomb.state === 'PLANTED') &&
        Math.hypot(posX - (snap?.bomb.x ?? 0), posZ - (snap?.bomb.z ?? 0)) <= 3.4;

      if (me?.alive && snap?.mode === 'bomb') {
        // Plant with E or holding Left Click while holding C4 in site
        const holdingPlant =
          me.team === 'T' &&
          me.hasBomb &&
          snap.phase === 'LIVE' &&
          inBombSite !== null &&
          (keys['KeyE'] || (currentWeapon === 'c4' && mouseDownLeft));

        if (holdingPlant && inBombSite) {
          if (!plantStartedSent) {
            plantStartedSent = true;
            propsRef.current.onPlantStart(inBombSite);
            soundEngine.playBombBeep(false);
          }
          plantProgress = Math.min(1, plantProgress + dt / 2.6);
          if (plantProgress >= 1) {
            plantProgress = 0;
            plantStartedSent = false;
            propsRef.current.onPlantComplete(inBombSite, posX, posY, posZ);
            switchWeapon(primaryWeapon || secondaryWeapon);
          }
        } else {
          plantProgress = 0;
          plantStartedSent = false;
        }

        // Defuse with E when CT near planted bomb
        const wantsDefuse =
          me.team === 'CT' &&
          snap.phase === 'BOMB_PLANTED' &&
          nearPlantedBomb &&
          Boolean(keys['KeyE']);

        if (wantsDefuse !== defusingActive) {
          defusingActive = wantsDefuse;
          propsRef.current.onDefuseToggle(defusingActive);
        }
      } else {
        plantProgress = 0;
        if (defusingActive) {
          defusingActive = false;
          propsRef.current.onDefuseToggle(false);
        }
      }

      // Position camera (or spectate living teammate if dead)
      if (me && !me.alive && snap) {
        const specTarget = snap.players.find((p) => p.alive && p.team === me.team) || snap.players.find((p) => p.alive);
        if (specTarget) {
          camera.position.set(
            specTarget.x - Math.sin(specTarget.yaw) * -2.2,
            specTarget.y + 2.3,
            specTarget.z - Math.cos(specTarget.yaw) * -2.2
          );
          camera.lookAt(specTarget.x, specTarget.y + 1.4, specTarget.z);
        }
        viewModelHolder.visible = false;
      } else {
        camera.position.set(posX, posY + currentEyeHeight, posZ);
        camera.rotation.order = 'YXZ';
        camera.rotation.y = yaw;
        camera.rotation.x = Math.max(-Math.PI / 2.05, Math.min(Math.PI / 2.05, pitch + recoilOffset));
        viewModelHolder.visible = scopeLevel === 0;
      }

      // Viewmodel sway, bob & reload tilt
      if (moveSpeed > 0.2 && onGround) {
        walkBobTime += dt * (moveSpeed > 5 ? 11 : 7);
      }
      const bobX = Math.cos(walkBobTime) * (moveSpeed > 0.2 ? 0.012 : 0.002);
      const bobY = Math.abs(Math.sin(walkBobTime)) * (moveSpeed > 0.2 ? -0.014 : 0);
      viewModelHolder.position.set(bobX, bobY - (reloading ? 0.08 : 0), weaponKickZ);
      viewModelHolder.rotation.x = reloading ? -0.45 : weaponKickZ * 1.4;

      // Sync remote players & AI bots
      if (snap) {
        const seenIds = new Set<string>();
        for (const p of snap.players) {
          if (p.id === myId) continue;
          seenIds.add(p.id);
          let entry = remoteRigs.get(p.id);
          if (!entry || entry.team !== p.team) {
            if (entry) scene.remove(entry.rig.group);
            const rig = buildCharacterModel(p.team, p.weapon);
            scene.add(rig.group);
            entry = { rig, team: p.team, lastX: p.x, lastZ: p.z, walkPhase: 0 };
            remoteRigs.set(p.id, entry);
          }

          entry.rig.group.visible = p.alive;
          if (!p.alive) continue;

          if (entry.rig.currentWeapon !== p.weapon) {
            entry.rig.weaponMount.clear();
            entry.rig.weaponMount.add(buildWeaponMesh(p.weapon));
            entry.rig.currentWeapon = p.weapon;
          }

          const nx = THREE.MathUtils.damp(entry.rig.group.position.x, p.x, 16, dt);
          const ny = THREE.MathUtils.damp(entry.rig.group.position.y, p.y, 16, dt);
          const nz = THREE.MathUtils.damp(entry.rig.group.position.z, p.z, 16, dt);
          const speed = Math.hypot(nx - entry.lastX, nz - entry.lastZ) / Math.max(0.001, dt);
          entry.lastX = nx;
          entry.lastZ = nz;

          entry.rig.group.position.set(nx, ny, nz);
          entry.rig.group.rotation.y = p.yaw;
          entry.rig.group.scale.y = p.crouching ? 0.72 : 1.0;

          if (speed > 0.35) {
            entry.walkPhase += dt * 10;
            entry.rig.leftLeg.rotation.x = Math.sin(entry.walkPhase) * 0.55;
            entry.rig.rightLeg.rotation.x = -Math.sin(entry.walkPhase) * 0.55;
          } else {
            entry.rig.leftLeg.rotation.x = THREE.MathUtils.damp(entry.rig.leftLeg.rotation.x, 0, 10, dt);
            entry.rig.rightLeg.rotation.x = THREE.MathUtils.damp(entry.rig.rightLeg.rotation.x, 0, 10, dt);
          }
        }

        for (const [id, entry] of remoteRigs.entries()) {
          if (!seenIds.has(id)) {
            scene.remove(entry.rig.group);
            remoteRigs.delete(id);
          }
        }

        // Bomb world mesh & C4 beep
        if (snap.bomb.state === 'PLANTED' || snap.bomb.state === 'DROPPED') {
          bombWorld.group.visible = true;
          bombWorld.group.position.set(snap.bomb.x, snap.bomb.y, snap.bomb.z);
          if (snap.bomb.state === 'PLANTED') {
            const beepInterval = snap.bomb.timer < 10 ? 280 : snap.bomb.timer < 20 ? 550 : 950;
            if (now - lastBombBeepAt >= beepInterval) {
              lastBombBeepAt = now;
              soundEngine.playBombBeep(snap.bomb.timer < 10);
              (bombWorld.led.material as THREE.MeshStandardMaterial).emissiveIntensity = 5.0;
            } else {
              (bombWorld.led.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.4;
            }
          }
        } else {
          bombWorld.group.visible = false;
        }
      }

      // Cleanup expired bullet tracers
      for (let i = tracers.length - 1; i >= 0; i--) {
        if (now >= tracers[i].expiresAt) {
          scene.remove(tracers[i].line);
          tracers[i].line.geometry.dispose();
          (tracers[i].line.material as THREE.Material).dispose();
          tracers.splice(i, 1);
        }
      }

      // Network movement sync (~20Hz)
      if (me?.alive && now - lastNetworkMoveSentAt >= 50) {
        lastNetworkMoveSentAt = now;
        propsRef.current.onSendMove(posX, posY, posZ, yaw, pitch, crouching, currentWeapon);
      }

      // React HUD sync (~15Hz)
      if (now - lastHudSyncAt >= 66) {
        lastHudSyncAt = now;
        propsRef.current.onHudSync({
          weapon: currentWeapon,
          inventory: getInventory(Boolean(me?.hasBomb)),
          ammoInMag: { ...ammoInMag },
          ammoReserve: { ...ammoReserve },
          reloading,
          scopeLevel,
          plantProgress,
          inBombSite,
          nearPlantedBomb,
          pointerLocked,
          crosshairSpread: Math.min(26, Math.round(moveSpeed * 2.2 + recoilOffset * 180)),
          hitMarkerAt,
          hitMarkerHeadshot,
          damageFlashAt,
          localPos: { x: posX, y: posY, z: posZ, yaw },
        });
      }

      renderer.render(scene, camera);

      if (isSoftwareGl) afterDraw(tick);
      else frameId = requestAnimationFrame(tick);
    }

    frameId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      document.removeEventListener('pointerlockchange', onPointerLockChange);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      renderer.domElement.removeEventListener('contextmenu', onContextMenu);
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('resize', onResize);
      renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
      env.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return <div ref={mountRef} className="w-full h-full bg-[#1a1815]" />;
}
