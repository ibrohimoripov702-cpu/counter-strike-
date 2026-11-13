import * as THREE from 'three';
import type { MaterialKind } from '../shared/gameData.ts';

function makeCanvas(w = 256, h = 256): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  return [c, ctx];
}

function finalizeTexture(
  canvas: HTMLCanvasElement,
  anisotropy: number,
  repeatX = 1,
  repeatY = 1
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = anisotropy;
  tex.needsUpdate = true;
  return tex;
}

function createSandWallTexture(anisotropy: number, dark = false): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(256, 256);
  ctx.fillStyle = dark ? '#a88c66' : '#c9ad82';
  ctx.fillRect(0, 0, 256, 256);

  // Stucco & sandstone grain
  for (let i = 0; i < 3200; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const v = Math.random() > 0.5 ? 'rgba(255,244,220,0.09)' : 'rgba(70,52,32,0.09)';
    ctx.fillStyle = v;
    ctx.fillRect(x, y, 2, 2);
  }

  // Subtle horizontal mortar & masonry blocks
  ctx.strokeStyle = dark ? 'rgba(65,48,28,0.28)' : 'rgba(95,72,44,0.22)';
  ctx.lineWidth = 2;
  const rows = 8;
  const rowH = 256 / rows;
  for (let r = 0; r < rows; r++) {
    const y = r * rowH;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(256, y);
    ctx.stroke();

    const offset = r % 2 === 0 ? 0 : 32;
    for (let x = offset; x < 256; x += 64) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + rowH);
      ctx.stroke();
    }
  }

  // Bottom dust weathering gradient
  const grad = ctx.createLinearGradient(0, 180, 0, 256);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(60,44,26,0.22)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 180, 256, 76);

  return finalizeTexture(c, anisotropy);
}

function createSandFloorTexture(anisotropy: number, stone = false): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(256, 256);
  ctx.fillStyle = stone ? '#b8a282' : '#d2b78d';
  ctx.fillRect(0, 0, 256, 256);

  for (let i = 0; i < 4500; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,245,220,0.12)' : 'rgba(88,68,42,0.1)';
    ctx.fillRect(x, y, 2, 2);
  }

  if (stone) {
    ctx.strokeStyle = 'rgba(72,58,40,0.22)';
    ctx.lineWidth = 2;
    for (let i = 0; i <= 256; i += 64) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 256);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(256, i);
      ctx.stroke();
    }
  }

  return finalizeTexture(c, anisotropy, stone ? 4 : 26, stone ? 4 : 26);
}

function createCrateTexture(anisotropy: number, dark = false): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(256, 256);
  ctx.fillStyle = dark ? '#585b42' : '#8b6a41';
  ctx.fillRect(0, 0, 256, 256);

  // Wood plank lines
  ctx.strokeStyle = 'rgba(30,22,12,0.45)';
  ctx.lineWidth = 3;
  for (let y = 32; y < 256; y += 32) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(256, y);
    ctx.stroke();
  }

  // Outer frame + diagonal brace (classic CS 1.6 crate!)
  ctx.strokeStyle = dark ? '#3e402e' : '#654a29';
  ctx.lineWidth = 22;
  ctx.strokeRect(11, 11, 234, 234);

  ctx.lineWidth = 18;
  ctx.beginPath();
  ctx.moveTo(22, 22);
  ctx.lineTo(234, 234);
  ctx.stroke();

  // Inner edge highlight
  ctx.strokeStyle = 'rgba(255,235,195,0.15)';
  ctx.lineWidth = 2;
  ctx.strokeRect(22, 22, 212, 212);

  return finalizeTexture(c, anisotropy);
}

function createDoorTexture(anisotropy: number, metal = false): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(256, 256);
  ctx.fillStyle = metal ? '#525b61' : '#6e492a';
  ctx.fillRect(0, 0, 256, 256);

  ctx.strokeStyle = metal ? '#31373b' : '#402712';
  ctx.lineWidth = 8;
  ctx.strokeRect(8, 8, 240, 240);

  if (metal) {
    // Rivets & ribs
    ctx.fillStyle = '#7c878e';
    for (let y = 24; y < 240; y += 44) {
      ctx.fillRect(20, y, 216, 6);
    }
  } else {
    // Vertical planks
    ctx.lineWidth = 3;
    for (let x = 32; x < 256; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, 12);
      ctx.lineTo(x, 244);
      ctx.stroke();
    }
  }

  return finalizeTexture(c, anisotropy);
}

export function createSiteDecalTexture(site: 'A' | 'B', anisotropy: number): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(256, 256);
  ctx.clearRect(0, 0, 256, 256);

  ctx.strokeStyle = 'rgba(186, 48, 32, 0.85)';
  ctx.lineWidth = 14;
  ctx.strokeRect(18, 18, 220, 220);

  ctx.fillStyle = 'rgba(186, 48, 32, 0.85)';
  ctx.font = 'bold 148px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(site, 128, 134);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = anisotropy;
  return tex;
}

export function createMaterialLibrary(renderer: THREE.WebGLRenderer) {
  const aniso = renderer.capabilities.getMaxAnisotropy();

  const sandWallTex = createSandWallTexture(aniso, false);
  const sandDarkTex = createSandWallTexture(aniso, true);
  const floorSandTex = createSandFloorTexture(aniso, false);
  const floorStoneTex = createSandFloorTexture(aniso, true);
  const crateTex = createCrateTexture(aniso, false);
  const crateDarkTex = createCrateTexture(aniso, true);
  const doorWoodTex = createDoorTexture(aniso, false);
  const doorMetalTex = createDoorTexture(aniso, true);

  const materials: Record<MaterialKind, THREE.MeshStandardMaterial> = {
    sandWall: new THREE.MeshStandardMaterial({ map: sandWallTex, roughness: 0.9, metalness: 0.02 }),
    sandDark: new THREE.MeshStandardMaterial({ map: sandDarkTex, roughness: 0.92, metalness: 0.02 }),
    floorSand: new THREE.MeshStandardMaterial({ map: floorSandTex, roughness: 0.95, metalness: 0.0 }),
    floorStone: new THREE.MeshStandardMaterial({ map: floorStoneTex, roughness: 0.85, metalness: 0.04 }),
    crate: new THREE.MeshStandardMaterial({ map: crateTex, roughness: 0.82, metalness: 0.06 }),
    crateDark: new THREE.MeshStandardMaterial({ map: crateDarkTex, roughness: 0.78, metalness: 0.1 }),
    doorWood: new THREE.MeshStandardMaterial({ map: doorWoodTex, roughness: 0.78, metalness: 0.05 }),
    doorMetal: new THREE.MeshStandardMaterial({ map: doorMetalTex, roughness: 0.42, metalness: 0.72 }),
    archTrim: new THREE.MeshStandardMaterial({ map: sandDarkTex, roughness: 0.88, metalness: 0.04 }),
  };

  return {
    materials,
    aniso,
    dispose: () => {
      [
        sandWallTex,
        sandDarkTex,
        floorSandTex,
        floorStoneTex,
        crateTex,
        crateDarkTex,
        doorWoodTex,
        doorMetalTex,
      ].forEach((t) => t.dispose());
      Object.values(materials).forEach((m) => m.dispose());
    },
  };
}
