import * as THREE from 'three';
import type { Team, WeaponId } from '../shared/gameData.ts';

const steelDarkMat = new THREE.MeshStandardMaterial({ color: 0x22262b, roughness: 0.32, metalness: 0.85 });
const gunmetalMat = new THREE.MeshStandardMaterial({ color: 0x383e45, roughness: 0.38, metalness: 0.78 });
const chromeMat = new THREE.MeshStandardMaterial({ color: 0xc8ced4, roughness: 0.18, metalness: 0.94 });
const woodMat = new THREE.MeshStandardMaterial({ color: 0x7b4520, roughness: 0.68, metalness: 0.05 });
const oliveMat = new THREE.MeshStandardMaterial({ color: 0x3b4d32, roughness: 0.56, metalness: 0.12 });
const gripMat = new THREE.MeshStandardMaterial({ color: 0x181a1d, roughness: 0.85, metalness: 0.05 });
const gloveMat = new THREE.MeshStandardMaterial({ color: 0x26292d, roughness: 0.88, metalness: 0.05 });
const sleeveMat = new THREE.MeshStandardMaterial({ color: 0x3a4339, roughness: 0.9, metalness: 0.02 });
const c4PackMat = new THREE.MeshStandardMaterial({ color: 0x4b5c3e, roughness: 0.75, metalness: 0.1 });
const ledRedMat = new THREE.MeshStandardMaterial({
  color: 0xff2222,
  emissive: 0xff1111,
  emissiveIntensity: 2.2,
  roughness: 0.2,
});

function addBox(
  parent: THREE.Group,
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
  mat: THREE.Material,
  rx = 0,
  ry = 0,
  rz = 0
): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  m.castShadow = true;
  parent.add(m);
  return m;
}

function addCyl(
  parent: THREE.Group,
  rt: number,
  rb: number,
  len: number,
  x: number,
  y: number,
  z: number,
  mat: THREE.Material,
  rx = Math.PI / 2
): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, len, 12), mat);
  m.position.set(x, y, z);
  m.rotation.x = rx;
  m.castShadow = true;
  parent.add(m);
  return m;
}

export function buildWeaponMesh(weapon: WeaponId): THREE.Group {
  const g = new THREE.Group();

  if (weapon === 'knife') {
    addBox(g, 0.024, 0.032, 0.14, 0, 0, 0.02, gripMat);
    addBox(g, 0.042, 0.044, 0.015, 0, 0.004, -0.055, steelDarkMat);
    addBox(g, 0.008, 0.034, 0.18, 0, 0.008, -0.15, chromeMat);
    addBox(g, 0.006, 0.02, 0.05, 0, 0.014, -0.25, chromeMat, -0.25, 0, 0);
    return g;
  }

  if (weapon === 'c4') {
    addBox(g, 0.16, 0.075, 0.22, 0, 0, 0, c4PackMat);
    addBox(g, 0.17, 0.016, 0.03, 0, 0.035, -0.05, gripMat);
    addBox(g, 0.17, 0.016, 0.03, 0, 0.035, 0.05, gripMat);
    addBox(g, 0.08, 0.02, 0.06, 0, 0.045, 0, steelDarkMat);
    addBox(g, 0.018, 0.014, 0.018, 0.03, 0.055, -0.02, ledRedMat);
    return g;
  }

  if (weapon === 'deagle') {
    // Heavy Desert Eagle chrome slide + frame + black grip
    addBox(g, 0.036, 0.046, 0.25, 0, 0.03, -0.07, chromeMat); // slide
    addBox(g, 0.032, 0.024, 0.21, 0, 0.002, -0.05, gunmetalMat); // lower frame
    addBox(g, 0.03, 0.11, 0.052, 0, -0.055, 0.04, gripMat, 0.24, 0, 0); // grip
    addCyl(g, 0.011, 0.011, 0.05, 0, 0.03, -0.2, steelDarkMat); // muzzle hole
    addBox(g, 0.008, 0.012, 0.015, 0, 0.058, -0.18, steelDarkMat); // front sight
    return g;
  }

  if (weapon === 'glock' || weapon === 'usp') {
    const slideMat = weapon === 'usp' ? steelDarkMat : gunmetalMat;
    addBox(g, 0.03, 0.036, 0.19, 0, 0.024, -0.05, slideMat);
    addBox(g, 0.026, 0.02, 0.16, 0, 0.0, -0.04, gripMat);
    addBox(g, 0.026, 0.095, 0.044, 0, -0.048, 0.03, gripMat, 0.22, 0, 0);
    if (weapon === 'usp') {
      // Tactical suppressor
      addCyl(g, 0.016, 0.016, 0.16, 0, 0.022, -0.22, steelDarkMat);
    }
    return g;
  }

  if (weapon === 'ak47') {
    // Iconic AK-47: wooden stock, receiver, wooden handguard, gas tube, curved magazine
    addBox(g, 0.042, 0.075, 0.24, 0, -0.015, 0.22, woodMat, -0.08, 0, 0); // stock
    addBox(g, 0.046, 0.072, 0.26, 0, 0.012, -0.02, steelDarkMat); // receiver
    addBox(g, 0.032, 0.1, 0.045, 0, -0.06, 0.07, gripMat, 0.25, 0, 0); // pistol grip
    addBox(g, 0.042, 0.046, 0.22, 0, 0.005, -0.26, woodMat); // lower handguard
    addCyl(g, 0.012, 0.012, 0.22, 0, 0.044, -0.25, steelDarkMat); // gas tube
    addCyl(g, 0.009, 0.009, 0.34, 0, 0.02, -0.42, gunmetalMat); // barrel
    addBox(g, 0.012, 0.036, 0.02, 0, 0.042, -0.54, steelDarkMat); // front sight post
    // Curved banana magazine (2 angled segments)
    addBox(g, 0.032, 0.11, 0.056, 0, -0.068, -0.06, woodMat, 0.18, 0, 0);
    addBox(g, 0.03, 0.1, 0.054, 0, -0.145, -0.095, woodMat, 0.42, 0, 0);
    return g;
  }

  if (weapon === 'm4a1') {
    addBox(g, 0.042, 0.072, 0.26, 0, 0.01, -0.02, steelDarkMat); // receiver
    addBox(g, 0.036, 0.075, 0.22, 0, 0.004, 0.21, gripMat); // stock
    addBox(g, 0.03, 0.095, 0.044, 0, -0.058, 0.06, gripMat, 0.25, 0, 0); // grip
    addBox(g, 0.026, 0.03, 0.15, 0, 0.058, -0.02, gunmetalMat); // carry handle / optic rail
    addCyl(g, 0.024, 0.024, 0.22, 0, 0.015, -0.25, gripMat); // quad-rail handguard
    addCyl(g, 0.018, 0.018, 0.22, 0, 0.015, -0.47, steelDarkMat); // suppressor
    addBox(g, 0.028, 0.16, 0.054, 0, -0.09, -0.06, gunmetalMat, 0.1, 0, 0); // magazine
    return g;
  }

  // AWP Sniper Rifle
  addBox(g, 0.05, 0.088, 0.46, 0, 0, 0.02, oliveMat); // chassis & stock
  addBox(g, 0.044, 0.06, 0.24, 0, 0.008, -0.31, oliveMat); // forend
  addCyl(g, 0.013, 0.015, 0.56, 0, 0.032, -0.58, steelDarkMat); // long fluted barrel
  addBox(g, 0.032, 0.034, 0.07, 0, 0.032, -0.87, gunmetalMat); // muzzle brake
  // Scope rings + scope tube + objective bell
  addBox(g, 0.024, 0.035, 0.02, 0, 0.065, -0.04, steelDarkMat);
  addBox(g, 0.024, 0.035, 0.02, 0, 0.065, -0.18, steelDarkMat);
  addCyl(g, 0.022, 0.022, 0.28, 0, 0.09, -0.11, gripMat);
  addCyl(g, 0.028, 0.024, 0.065, 0, 0.09, -0.26, steelDarkMat);
  // Bolt handle
  addBox(g, 0.045, 0.012, 0.014, 0.035, 0.035, 0.04, chromeMat);
  return g;
}

export function buildViewModel(weapon: WeaponId): THREE.Group {
  const root = new THREE.Group();
  const gun = buildWeaponMesh(weapon);

  // Position weapon naturally in bottom-right first-person perspective
  if (weapon === 'knife') {
    gun.position.set(0.24, -0.24, -0.44);
    gun.rotation.set(0.15, 0.25, -0.25);
  } else if (weapon === 'c4') {
    gun.position.set(0.18, -0.24, -0.46);
    gun.rotation.set(0.35, -0.2, 0);
  } else {
    gun.position.set(0.23, -0.22, -0.48);
    gun.rotation.set(0.02, 0.04, 0);
  }
  root.add(gun);

  // First-person gloved right forearm
  const rightArm = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.075, 0.34), sleeveMat);
  rightArm.position.set(0.31, -0.32, -0.19);
  rightArm.rotation.set(0.18, -0.22, 0);
  root.add(rightArm);

  const rightGlove = new THREE.Mesh(new THREE.BoxGeometry(0.062, 0.06, 0.09), gloveMat);
  rightGlove.position.set(0.24, -0.26, -0.38);
  root.add(rightGlove);

  // Left support hand for two-handed rifles
  if (weapon === 'ak47' || weapon === 'm4a1' || weapon === 'awp') {
    const leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.36), sleeveMat);
    leftArm.position.set(-0.08, -0.33, -0.38);
    leftArm.rotation.set(0.24, 0.56, 0);
    root.add(leftArm);

    const leftGlove = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.056, 0.09), gloveMat);
    leftGlove.position.set(0.16, -0.24, -0.62);
    root.add(leftGlove);
  }

  return root;
}

export interface CharacterRig {
  group: THREE.Group;
  leftLeg: THREE.Mesh;
  rightLeg: THREE.Mesh;
  headGroup: THREE.Group;
  weaponMount: THREE.Group;
  currentWeapon: WeaponId;
}

export function buildCharacterModel(team: Team, weapon: WeaponId): CharacterRig {
  const group = new THREE.Group();

  const pantsColor = team === 'T' ? 0x5c5340 : 0x263547;
  const jacketColor = team === 'T' ? 0x8b7355 : 0x2f435a;
  const vestColor = team === 'T' ? 0x3b352c : 0x1b2634;
  const accentColor = team === 'T' ? 0xb53c28 : 0x3a6ea5;

  const pantsMat = new THREE.MeshStandardMaterial({ color: pantsColor, roughness: 0.88, metalness: 0.04 });
  const jacketMat = new THREE.MeshStandardMaterial({ color: jacketColor, roughness: 0.82, metalness: 0.06 });
  const vestMat = new THREE.MeshStandardMaterial({ color: vestColor, roughness: 0.72, metalness: 0.14 });
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xd9ad8b, roughness: 0.75, metalness: 0.02 });
  const accentMat = new THREE.MeshStandardMaterial({ color: accentColor, roughness: 0.65, metalness: 0.1 });

  // Legs (pivoted near hip so walking swings cleanly, feet touch Y = 0)
  const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.78, 0.24), pantsMat);
  leftLeg.position.set(-0.14, 0.39, 0);
  leftLeg.castShadow = true;
  group.add(leftLeg);

  const rightLeg = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.78, 0.24), pantsMat);
  rightLeg.position.set(0.14, 0.39, 0);
  rightLeg.castShadow = true;
  group.add(rightLeg);

  // Tactical Torso & Kevlar Vest
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.64, 0.3), jacketMat);
  torso.position.set(0, 1.08, 0);
  torso.castShadow = true;
  group.add(torso);

  const vest = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.48, 0.34), vestMat);
  vest.position.set(0, 1.12, 0);
  vest.castShadow = true;
  group.add(vest);

  // Team shoulder insignia
  const patch = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.1, 0.16), accentMat);
  patch.position.set(0, 1.3, 0);
  group.add(patch);

  // Head + Helmet / Bandana
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 1.56, 0);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.3, 0.28), team === 'T' ? skinMat : gripMat);
  head.castShadow = true;
  headGroup.add(head);

  if (team === 'CT') {
    // Kevlar helmet + goggles
    const helmet = new THREE.Mesh(new THREE.BoxGeometry(0.33, 0.18, 0.33), vestMat);
    helmet.position.set(0, 0.1, 0);
    helmet.castShadow = true;
    headGroup.add(helmet);

    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.08, 0.06), accentMat);
    visor.position.set(0, 0.03, -0.15);
    headGroup.add(visor);
  } else {
    // Red/Amber Terrorist headband
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.08, 0.3), accentMat);
    band.position.set(0, 0.09, 0);
    headGroup.add(band);
  }
  group.add(headGroup);

  // Arms + Weapon Mount (facing -Z)
  const leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.48, 0.16), jacketMat);
  leftArm.position.set(-0.34, 1.14, -0.14);
  leftArm.rotation.x = Math.PI / 2.6;
  leftArm.castShadow = true;
  group.add(leftArm);

  const rightArm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.48, 0.16), jacketMat);
  rightArm.position.set(0.34, 1.14, -0.16);
  rightArm.rotation.x = Math.PI / 2.2;
  rightArm.castShadow = true;
  group.add(rightArm);

  const weaponMount = new THREE.Group();
  weaponMount.position.set(0.22, 1.15, -0.35);
  weaponMount.add(buildWeaponMesh(weapon));
  group.add(weaponMount);

  return {
    group,
    leftLeg,
    rightLeg,
    headGroup,
    weaponMount,
    currentWeapon: weapon,
  };
}

export function buildBombWorldModel(): { group: THREE.Group; led: THREE.Mesh } {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.12, 0.44), c4PackMat);
  body.position.y = 0.06;
  body.castShadow = true;
  group.add(body);

  const keypad = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.03, 0.14), steelDarkMat);
  keypad.position.set(0, 0.13, 0);
  group.add(keypad);

  const led = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 10), ledRedMat.clone());
  led.position.set(0.08, 0.15, -0.08);
  group.add(led);

  return { group, led };
}
