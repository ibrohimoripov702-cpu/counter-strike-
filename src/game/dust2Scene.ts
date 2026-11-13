import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { MAP_BLOCKS, MAP_RAMPS } from '../shared/gameData.ts';
import { createMaterialLibrary, createSiteDecalTexture } from './textures.ts';

export function detectSoftwareWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return false;
  }
}

export function buildDust2Environment(
  scene: THREE.Scene,
  renderer: THREE.WebGLRenderer,
  isSoftwareGl: boolean
): { dispose: () => void } {
  const skyColor = new THREE.Color(0xdcc7a1);
  scene.background = skyColor;
  scene.fog = new THREE.FogExp2(0xdcc7a1, 0.0085);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTex;
  pmrem.dispose();

  // Warm sun + cool/warm desert hemisphere fill
  const hemi = new THREE.HemisphereLight(0xf6ecd8, 0x8f7454, 0.85);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xfff1d6, 1.8);
  sun.position.set(42, 72, 34);
  if (!isSoftwareGl) {
    sun.castShadow = true;
    sun.shadow.mapSize.width = 2048;
    sun.shadow.mapSize.height = 2048;
    sun.shadow.camera.near = 10;
    sun.shadow.camera.far = 180;
    const d = 68;
    sun.shadow.camera.left = -d;
    sun.shadow.camera.right = d;
    sun.shadow.camera.top = d;
    sun.shadow.camera.bottom = -d;
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.025;
  }
  scene.add(sun);

  const matLib = createMaterialLibrary(renderer);
  const disposables: Array<{ dispose: () => void }> = [];

  // Extended desert floor beyond playable walls (no floating void)
  const floorGeo = new THREE.PlaneGeometry(360, 360);
  const floorMesh = new THREE.Mesh(floorGeo, matLib.materials.floorSand);
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.receiveShadow = true;
  scene.add(floorMesh);
  disposables.push(floorGeo);

  // Outer distant desert dunes & sandstone mesas for horizon silhouette
  const dunePositions: Array<[number, number, number, number, number, number]> = [
    [-85, 0, -75, 42, 16, 28],
    [88, 0, -80, 48, 20, 32],
    [-92, 0, 72, 46, 15, 36],
    [94, 0, 68, 44, 18, 30],
    [0, 0, -96, 75, 14, 24],
    [0, 0, 96, 75, 14, 24],
  ];
  for (const [x, y, z, w, h, d] of dunePositions) {
    const geo = new THREE.BoxGeometry(w, h, d);
    const m = new THREE.Mesh(geo, matLib.materials.sandDark);
    m.position.set(x, y + h / 2 - 1, z);
    scene.add(m);
    disposables.push(geo);
  }

  // Playable de_dust2 blocks
  for (const blk of MAP_BLOCKS) {
    const geo = new THREE.BoxGeometry(blk.w, blk.h, blk.d);
    const mesh = new THREE.Mesh(geo, matLib.materials[blk.material]);
    mesh.position.set(blk.x, blk.y + blk.h / 2, blk.z);
    mesh.castShadow = blk.h > 0.5;
    mesh.receiveShadow = true;
    scene.add(mesh);
    disposables.push(geo);

    if (blk.siteDecal) {
      const decalTex = createSiteDecalTexture(blk.siteDecal, matLib.aniso);
      const decalMat = new THREE.MeshBasicMaterial({
        map: decalTex,
        transparent: true,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      });
      const decalGeo = new THREE.PlaneGeometry(5.5, 5.5);
      const decal = new THREE.Mesh(decalGeo, decalMat);
      decal.rotation.x = -Math.PI / 2;
      decal.position.set(blk.x, blk.y + blk.h + 0.02, blk.z);
      scene.add(decal);
      disposables.push(decalTex, decalMat, decalGeo);
    }
  }

  // Sloped ramps (A Ramp, A Short stairs, CT A Ramp)
  for (const ramp of MAP_RAMPS) {
    const span = ramp.axis === 'x' ? ramp.w : ramp.d;
    const width = ramp.axis === 'x' ? ramp.d : ramp.w;
    const dy = ramp.yEnd - ramp.yStart;
    const length = Math.hypot(span, dy);
    const angle = Math.atan2(dy, span);

    const geo = new THREE.BoxGeometry(
      ramp.axis === 'x' ? length : width,
      0.32,
      ramp.axis === 'z' ? length : width
    );
    const mesh = new THREE.Mesh(geo, matLib.materials[ramp.material]);
    const midY = (ramp.yStart + ramp.yEnd) / 2 - 0.16;
    mesh.position.set(ramp.x, midY, ramp.z);
    if (ramp.axis === 'x') {
      mesh.rotation.z = angle;
    } else {
      mesh.rotation.x = -angle;
    }
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    scene.add(mesh);
    disposables.push(geo);
  }

  // Architectural accents: Dust 2 palm trees (T Spawn & Long A) & overhead arch lintels
  const palmMatTrunk = new THREE.MeshStandardMaterial({ color: 0x6e5134, roughness: 0.92 });
  const palmMatLeaf = new THREE.MeshStandardMaterial({ color: 0x4b6b36, roughness: 0.85, side: THREE.DoubleSide });
  disposables.push(palmMatTrunk, palmMatLeaf);

  const palmLocations: Array<[number, number]> = [
    [-16, 47],
    [47, 18],
    [14, 34],
  ];
  for (const [px, pz] of palmLocations) {
    const palmGroup = new THREE.Group();
    palmGroup.position.set(px, 0, pz);
    const trunkGeo = new THREE.CylinderGeometry(0.24, 0.36, 6.2, 8);
    const trunk = new THREE.Mesh(trunkGeo, palmMatTrunk);
    trunk.position.y = 3.1;
    trunk.castShadow = true;
    palmGroup.add(trunk);
    disposables.push(trunkGeo);

    const frondGeo = new THREE.ConeGeometry(1.9, 1.4, 6);
    const crown = new THREE.Mesh(frondGeo, palmMatLeaf);
    crown.position.y = 6.2;
    crown.scale.set(1.3, 0.7, 1.3);
    crown.castShadow = true;
    palmGroup.add(crown);
    disposables.push(frondGeo);

    scene.add(palmGroup);
  }

  return {
    dispose: () => {
      envTex.dispose();
      matLib.dispose();
      disposables.forEach((d) => d.dispose());
    },
  };
}
