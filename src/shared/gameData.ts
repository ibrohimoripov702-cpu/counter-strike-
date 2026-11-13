export type Team = 'T' | 'CT';
export type GameMode = 'bomb' | 'tdm';
export type RoundPhase = 'FREEZETIME' | 'LIVE' | 'BOMB_PLANTED' | 'ROUND_END';
export type WeaponId = 'knife' | 'glock' | 'usp' | 'deagle' | 'ak47' | 'm4a1' | 'awp' | 'c4';
export type WeaponSlot = 1 | 2 | 3 | 4;

export interface WeaponSpec {
  id: WeaponId;
  name: string;
  slot: WeaponSlot;
  price: number;
  damage: number;
  headshotMult: number;
  fireRateMs: number;
  reloadTimeMs: number;
  magSize: number;
  reserveAmmo: number;
  automatic: boolean;
  spread: number;
  recoil: number;
  range: number;
  moveSpeedMult: number;
  canScope?: boolean;
  teamRestriction?: Team;
  suppressed?: boolean;
}

export const WEAPONS: Record<WeaponId, WeaponSpec> = {
  knife: {
    id: 'knife',
    name: 'Pichoq',
    slot: 3,
    price: 0,
    damage: 55,
    headshotMult: 1.8,
    fireRateMs: 420,
    reloadTimeMs: 0,
    magSize: 0,
    reserveAmmo: 0,
    automatic: false,
    spread: 0,
    recoil: 0.01,
    range: 3.1,
    moveSpeedMult: 1.12,
  },
  glock: {
    id: 'glock',
    name: 'Glock-18',
    slot: 2,
    price: 0,
    damage: 25,
    headshotMult: 3.2,
    fireRateMs: 180,
    reloadTimeMs: 1900,
    magSize: 20,
    reserveAmmo: 120,
    automatic: false,
    spread: 0.018,
    recoil: 0.022,
    range: 90,
    moveSpeedMult: 1.04,
  },
  usp: {
    id: 'usp',
    name: 'USP Tactical',
    slot: 2,
    price: 0,
    damage: 30,
    headshotMult: 3.3,
    fireRateMs: 210,
    reloadTimeMs: 1900,
    magSize: 12,
    reserveAmmo: 100,
    automatic: false,
    spread: 0.011,
    recoil: 0.02,
    range: 95,
    moveSpeedMult: 1.04,
    suppressed: true,
  },
  deagle: {
    id: 'deagle',
    name: 'Desert Eagle',
    slot: 2,
    price: 650,
    damage: 54,
    headshotMult: 3.6,
    fireRateMs: 360,
    reloadTimeMs: 2100,
    magSize: 7,
    reserveAmmo: 35,
    automatic: false,
    spread: 0.012,
    recoil: 0.065,
    range: 120,
    moveSpeedMult: 1.0,
  },
  ak47: {
    id: 'ak47',
    name: 'AK-47',
    slot: 1,
    price: 2500,
    damage: 36,
    headshotMult: 3.8,
    fireRateMs: 105,
    reloadTimeMs: 2300,
    magSize: 30,
    reserveAmmo: 90,
    automatic: true,
    spread: 0.018,
    recoil: 0.036,
    range: 140,
    moveSpeedMult: 0.92,
  },
  m4a1: {
    id: 'm4a1',
    name: 'M4A1 Carbine',
    slot: 1,
    price: 3100,
    damage: 32,
    headshotMult: 3.6,
    fireRateMs: 95,
    reloadTimeMs: 2200,
    magSize: 30,
    reserveAmmo: 90,
    automatic: true,
    spread: 0.013,
    recoil: 0.026,
    range: 140,
    moveSpeedMult: 0.94,
    suppressed: true,
  },
  awp: {
    id: 'awp',
    name: 'AWP Sniper',
    slot: 1,
    price: 4750,
    damage: 115,
    headshotMult: 3.8,
    fireRateMs: 1450,
    reloadTimeMs: 3100,
    magSize: 10,
    reserveAmmo: 30,
    automatic: false,
    spread: 0.001,
    recoil: 0.095,
    range: 220,
    moveSpeedMult: 0.84,
    canScope: true,
  },
  c4: {
    id: 'c4',
    name: 'C4 Bomba',
    slot: 4,
    price: 0,
    damage: 0,
    headshotMult: 1,
    fireRateMs: 500,
    reloadTimeMs: 0,
    magSize: 1,
    reserveAmmo: 0,
    automatic: false,
    spread: 0,
    recoil: 0,
    range: 0,
    moveSpeedMult: 1.05,
  },
};

export type MaterialKind =
  | 'sandWall'
  | 'sandDark'
  | 'crate'
  | 'crateDark'
  | 'doorWood'
  | 'doorMetal'
  | 'floorSand'
  | 'floorStone'
  | 'archTrim';

export interface MapBlock {
  id: string;
  x: number; // center X
  y: number; // bottom Y
  z: number; // center Z
  w: number; // width X
  h: number; // height Y
  d: number; // depth Z
  material: MaterialKind;
  walkable?: boolean;
  siteDecal?: 'A' | 'B';
}

export interface MapRamp {
  id: string;
  x: number;
  z: number;
  w: number;
  d: number;
  yStart: number; // height at min axis (x - w/2 or z - d/2)
  yEnd: number;   // height at max axis (x + w/2 or z + d/2)
  axis: 'x' | 'z';
  material: MaterialKind;
}

export interface BombSite {
  id: 'A' | 'B';
  label: string;
  x: number;
  y: number;
  z: number;
  radius: number;
}

export const BOMBSITES: Record<'A' | 'B', BombSite> = {
  A: { id: 'A', label: 'A Nuqtasi', x: 39, y: 2.4, z: -39, radius: 8.0 },
  B: { id: 'B', label: 'B Nuqtasi', x: -41, y: 0, z: -39, radius: 8.0 },
};

export const SPAWN_POINTS: Record<Team, Array<{ x: number; y: number; z: number; yaw: number }>> = {
  T: [
    { x: -6, y: 0, z: 48, yaw: 0 },
    { x: -2, y: 0, z: 48, yaw: 0 },
    { x: 2, y: 0, z: 48, yaw: 0 },
    { x: -4, y: 0, z: 45, yaw: 0 },
    { x: 4, y: 0, z: 45, yaw: 0 },
  ],
  CT: [
    { x: 2, y: 0, z: -45, yaw: Math.PI },
    { x: 6, y: 0, z: -45, yaw: Math.PI },
    { x: 10, y: 0, z: -45, yaw: Math.PI },
    { x: 4, y: 0, z: -42, yaw: Math.PI },
    { x: 8, y: 0, z: -42, yaw: Math.PI },
  ],
};

// Iconic de_dust2 layout (-56..+56 in X and Z)
export const MAP_BLOCKS: MapBlock[] = [
  // Outer perimeter sandstone walls (6.5m tall)
  { id: 'wall-n', x: 0, y: 0, z: -55, w: 112, h: 7.5, d: 2, material: 'sandWall' },
  { id: 'wall-s', x: 0, y: 0, z: 55, w: 112, h: 7.5, d: 2, material: 'sandWall' },
  { id: 'wall-w', x: -55, y: 0, z: 0, w: 2, h: 7.5, d: 112, material: 'sandWall' },
  { id: 'wall-e', x: 55, y: 0, z: 0, w: 2, h: 7.5, d: 112, material: 'sandWall' },

  // --- BOMBSITE A ELEVATED PLATFORM (NE corner) ---
  { id: 'a-plat', x: 39, y: 0, z: -39, w: 30, h: 2.4, d: 28, material: 'floorStone', walkable: true, siteDecal: 'A' },
  // A Site cover crates
  { id: 'a-crate-1', x: 37, y: 2.4, z: -38, w: 2.2, h: 2.2, d: 2.2, material: 'crate', walkable: true },
  { id: 'a-crate-2', x: 39.2, y: 2.4, z: -38, w: 2.2, h: 2.2, d: 2.2, material: 'crate', walkable: true },
  { id: 'a-crate-3', x: 38.1, y: 4.6, z: -38, w: 2.0, h: 2.0, d: 2.0, material: 'crateDark', walkable: true },
  { id: 'a-crate-4', x: 45, y: 2.4, z: -45, w: 2.4, h: 2.0, d: 2.4, material: 'crateDark', walkable: true },
  { id: 'a-goose-box', x: 50, y: 2.4, z: -49, w: 3.5, h: 2.6, d: 2.2, material: 'sandDark', walkable: true },

  // --- A SHORT / CATWALK ELEVATED DECK ---
  { id: 'catwalk-deck', x: 18, y: 0, z: -26, w: 12, h: 2.4, d: 22, material: 'floorStone', walkable: true },
  { id: 'catwalk-parapet', x: 12.2, y: 2.4, z: -26, w: 0.7, h: 1.0, d: 22, material: 'sandDark' },
  { id: 'catwalk-connect', x: 24, y: 0, z: -32, w: 8, h: 2.4, d: 12, material: 'floorStone', walkable: true },
  // Wall separating Short from CT Spawn / Mid
  { id: 'a-short-wall', x: 12, y: 0, z: -37, w: 2, h: 6.0, d: 22, material: 'sandWall' },
  // Xbox (iconic Mid-to-Short boost box)
  { id: 'xbox', x: 9.2, y: 0, z: -13, w: 2.4, h: 2.1, d: 2.4, material: 'crateDark', walkable: true },

  // --- LONG A & LONG DOORS (East side) ---
  // Divider wall between Mid & Long A
  { id: 'long-mid-wall-1', x: 25, y: 0, z: -5, w: 2.5, h: 6.5, d: 34, material: 'sandWall' },
  { id: 'long-mid-wall-2', x: 25, y: 0, z: 28, w: 2.5, h: 6.5, d: 18, material: 'sandWall' },
  // Long Doors House walls (with 6m opening at X: 36..42, Z: 24)
  { id: 'long-house-w', x: 31, y: 0, z: 24, w: 10, h: 6.2, d: 2.2, material: 'sandDark' },
  { id: 'long-house-e', x: 49, y: 0, z: 24, w: 10, h: 6.2, d: 2.2, material: 'sandDark' },
  { id: 'long-door-l', x: 37.2, y: 0, z: 24, w: 1.6, h: 3.6, d: 0.4, material: 'doorWood' },
  // Blue dumpster / Car cover in Long A
  { id: 'long-car', x: 48, y: 0, z: -8, w: 3.4, h: 1.6, d: 5.5, material: 'crateDark', walkable: true },
  { id: 'long-pit-wall', x: 45, y: 0, z: 12, w: 2.6, h: 1.4, d: 8, material: 'sandDark', walkable: true },
  { id: 'long-corner-box', x: 30, y: 0, z: -16, w: 2.4, h: 2.2, d: 2.4, material: 'crate', walkable: true },

  // --- MID & MID DOORS ---
  // Mid Doors Frame (Z = -10) with center gap X: -4..+4
  { id: 'mid-wall-w', x: -13, y: 0, z: -10, w: 18, h: 6.5, d: 2.4, material: 'sandWall' },
  { id: 'mid-wall-e', x: 14, y: 0, z: -10, w: 18, h: 6.5, d: 2.4, material: 'sandWall' },
  // Iconic Double Doors in Mid (slightly cracked open so AWP can peek!)
  { id: 'mid-door-l', x: -2.4, y: 0, z: -10, w: 2.8, h: 4.2, d: 0.45, material: 'doorWood' },
  { id: 'mid-door-r', x: 2.6, y: 0, z: -10, w: 2.8, h: 4.2, d: 0.45, material: 'doorWood' },
  // Mid Arch Bridge (overhead visual + CT Spawn shelter)
  { id: 'ct-bridge-top', x: 10, y: 4.4, z: -36, w: 16, h: 1.6, d: 10, material: 'archTrim' },
  // Palm / Mid crates
  { id: 'mid-crate-1', x: -5, y: 0, z: 4, w: 2.2, h: 1.9, d: 2.2, material: 'crate', walkable: true },
  { id: 'mid-crate-2', x: 7, y: 0, z: 16, w: 2.4, h: 2.1, d: 2.4, material: 'crateDark', walkable: true },

  // --- T SPAWN & SUICIDE ---
  { id: 't-spawn-wall-l', x: -16, y: 0, z: 41, w: 16, h: 5.5, d: 2.2, material: 'sandWall' },
  { id: 't-spawn-wall-r', x: 16, y: 0, z: 41, w: 16, h: 5.5, d: 2.2, material: 'sandWall' },
  { id: 't-spawn-crate', x: -12, y: 0, z: 48, w: 2.5, h: 2.0, d: 2.5, material: 'crate', walkable: true },

  // --- BOMBSITE B & B TUNNELS (West side) ---
  // Divider wall between Mid & B Tunnels
  { id: 'b-mid-wall-s', x: -23, y: 0, z: 12, w: 2.4, h: 6.5, d: 34, material: 'sandWall' },
  { id: 'b-mid-wall-n', x: -23, y: 0, z: -38, w: 2.4, h: 6.5, d: 26, material: 'sandWall' },
  // Tunnel Roof & Archways (X: -54..-24, Z: -10..+24)
  { id: 'b-tunnel-roof', x: -39, y: 5.0, z: 6, w: 30, h: 1.5, d: 32, material: 'sandDark' },
  { id: 'b-tunnel-pillar', x: -36, y: 0, z: 6, w: 4.0, h: 5.0, d: 4.0, material: 'sandWall' },
  // B Site Entrance wall (Z = -22, doorway X: -45..-37)
  { id: 'b-entry-w', x: -50, y: 0, z: -22, w: 10, h: 6.5, d: 2.4, material: 'sandWall' },
  { id: 'b-entry-e', x: -30, y: 0, z: -22, w: 14, h: 6.5, d: 2.4, material: 'sandWall' },
  // B Site Ground Marker
  { id: 'b-site-pad', x: -41, y: 0, z: -39, w: 16, h: 0.08, d: 16, material: 'floorStone', walkable: true, siteDecal: 'B' },
  // B Site Cover Crates & Double Stack
  { id: 'b-crate-1', x: -40, y: 0, z: -36, w: 2.3, h: 2.1, d: 2.3, material: 'crate', walkable: true },
  { id: 'b-crate-2', x: -40, y: 2.1, z: -36, w: 2.1, h: 1.9, d: 2.1, material: 'crateDark', walkable: true },
  { id: 'b-crate-3', x: -48, y: 0, z: -43, w: 3.0, h: 2.2, d: 2.4, material: 'crateDark', walkable: true },
  { id: 'b-plat-back', x: -50, y: 0, z: -48, w: 8, h: 1.4, d: 10, material: 'floorStone', walkable: true },
  // B Doors (connecting B Site X: -23, Z: -26..-18) -> gap at Z: -25..-18
  { id: 'b-door-panel', x: -23, y: 0, z: -19.5, w: 0.45, h: 4.0, d: 2.6, material: 'doorMetal' },

  // --- CT SPAWN COVER ---
  { id: 'ct-crate-1', x: -6, y: 0, z: -38, w: 2.4, h: 2.1, d: 2.4, material: 'crate', walkable: true },
  { id: 'ct-crate-2', x: 16, y: 0, z: -46, w: 2.4, h: 2.1, d: 2.4, material: 'crateDark', walkable: true },
];

export const MAP_RAMPS: MapRamp[] = [
  // A Ramp (from Long A Z: -18 up to Bombsite A Z: -25)
  { id: 'ramp-a-long', x: 39, z: -21.5, w: 28, d: 7, yStart: 2.4, yEnd: 0, axis: 'z', material: 'floorStone' },
  // A Short Stairs (from Mid Z: -8 up to Catwalk Z: -15)
  { id: 'ramp-a-short', x: 18, z: -11.5, w: 12, d: 7, yStart: 2.4, yEnd: 0, axis: 'z', material: 'floorStone' },
  // CT Ramp to A Site (from CT X: 18 up to A Plat X: 24)
  { id: 'ramp-ct-a', x: 21, z: -42, w: 6, d: 14, yStart: 0, yEnd: 2.4, axis: 'x', material: 'floorStone' },
];

export interface Waypoint {
  id: string;
  x: number;
  y: number;
  z: number;
  zone: string;
}

export const BOT_WAYPOINTS: Waypoint[] = [
  { id: 't_spawn', x: -2, y: 0, z: 46, zone: 'T Baza' },
  { id: 't_mid', x: 0, y: 0, z: 24, zone: 'Yuqori Mid' },
  { id: 'mid_center', x: 0, y: 0, z: 2, zone: 'Mid' },
  { id: 'mid_doors', x: 0, y: 0, z: -15, zone: 'Mid Eshiklari' },
  { id: 'short_stairs', x: 18, y: 1.5, z: -13, zone: 'A Short' },
  { id: 'catwalk', x: 19, y: 2.4, z: -28, zone: 'Catwalk' },
  { id: 'a_site', x: 39, y: 2.4, z: -39, zone: 'A Nuqtasi' },
  { id: 'long_doors', x: 40, y: 0, z: 24, zone: 'Long Eshiklari' },
  { id: 'long_a', x: 42, y: 0, z: 0, zone: 'Long A' },
  { id: 'a_ramp', x: 40, y: 1.2, z: -21, zone: 'A Rampa' },
  { id: 'b_tunnels_out', x: -39, y: 0, z: 26, zone: 'B Tunnel Kirish' },
  { id: 'b_tunnels_in', x: -41, y: 0, z: -4, zone: 'B Tunnellar' },
  { id: 'b_site', x: -41, y: 0, z: -38, zone: 'B Nuqtasi' },
  { id: 'b_doors', x: -16, y: 0, z: -23, zone: 'B Eshiklari' },
  { id: 'ct_mid', x: -4, y: 0, z: -30, zone: 'CT Mid' },
  { id: 'ct_spawn', x: 6, y: 0, z: -43, zone: 'CT Baza' },
];

export function getGroundHeightAt(x: number, z: number, currentY: number): number {
  let ground = 0;

  for (const ramp of MAP_RAMPS) {
    const minX = ramp.x - ramp.w / 2;
    const maxX = ramp.x + ramp.w / 2;
    const minZ = ramp.z - ramp.d / 2;
    const maxZ = ramp.z + ramp.d / 2;
    if (x >= minX && x <= maxX && z >= minZ && z <= maxZ) {
      const t =
        ramp.axis === 'x'
          ? (x - minX) / ramp.w
          : (z - minZ) / ramp.d;
      const h = ramp.yStart + (ramp.yEnd - ramp.yStart) * Math.max(0, Math.min(1, t));
      if (h <= currentY + 0.9 && h > ground) {
        ground = h;
      }
    }
  }

  for (const blk of MAP_BLOCKS) {
    if (!blk.walkable) continue;
    const halfW = blk.w / 2 + 0.25;
    const halfD = blk.d / 2 + 0.25;
    if (Math.abs(x - blk.x) <= halfW && Math.abs(z - blk.z) <= halfD) {
      const topY = blk.y + blk.h;
      if (topY <= currentY + 0.85 && topY > ground) {
        ground = topY;
      }
    }
  }

  return ground;
}

export function resolveMapCollision(
  x: number,
  y: number,
  z: number,
  radius = 0.45,
  playerHeight = 1.75
): { x: number; z: number } {
  let nx = Math.max(-53.2, Math.min(53.2, x));
  let nz = Math.max(-53.2, Math.min(53.2, z));

  for (const blk of MAP_BLOCKS) {
    const topY = blk.y + blk.h;
    const botY = blk.y;
    // Skip if player is standing above block top or completely below block bottom
    if (y >= topY - 0.55 || y + playerHeight <= botY + 0.05) {
      continue;
    }

    const halfW = blk.w / 2 + radius;
    const halfD = blk.d / 2 + radius;
    const dx = nx - blk.x;
    const dz = nz - blk.z;

    if (Math.abs(dx) < halfW && Math.abs(dz) < halfD) {
      const overlapX = halfW - Math.abs(dx);
      const overlapZ = halfD - Math.abs(dz);
      if (overlapX < overlapZ) {
        nx += dx >= 0 ? overlapX : -overlapX;
      } else {
        nz += dz >= 0 ? overlapZ : -overlapZ;
      }
    }
  }

  return { x: nx, z: nz };
}

export function rayIntersectsMap(
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
  maxDist: number
): number | null {
  let closest = maxDist;
  let hit = false;

  for (const blk of MAP_BLOCKS) {
    const minX = blk.x - blk.w / 2;
    const maxX = blk.x + blk.w / 2;
    const minY = blk.y;
    const maxY = blk.y + blk.h;
    const minZ = blk.z - blk.d / 2;
    const maxZ = blk.z + blk.d / 2;

    const invDx = dx !== 0 ? 1 / dx : 1e9;
    const invDy = dy !== 0 ? 1 / dy : 1e9;
    const invDz = dz !== 0 ? 1 / dz : 1e9;

    const t1 = (minX - ox) * invDx;
    const t2 = (maxX - ox) * invDx;
    const t3 = (minY - oy) * invDy;
    const t4 = (maxY - oy) * invDy;
    const t5 = (minZ - oz) * invDz;
    const t6 = (maxZ - oz) * invDz;

    const tmin = Math.max(Math.min(t1, t2), Math.min(t3, t4), Math.min(t5, t6));
    const tmax = Math.min(Math.max(t1, t2), Math.max(t3, t4), Math.max(t5, t6));

    if (tmax >= 0 && tmin <= tmax && tmin >= 0 && tmin < closest) {
      closest = tmin;
      hit = true;
    }
  }

  return hit ? closest : null;
}
