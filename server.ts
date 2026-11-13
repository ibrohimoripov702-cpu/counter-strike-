import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import {
  BOMBSITES,
  BOT_WAYPOINTS,
  getGroundHeightAt,
  resolveMapCollision,
  rayIntersectsMap,
  SPAWN_POINTS,
  WEAPONS,
  type GameMode,
  type RoundPhase,
  type Team,
  type WeaponId,
} from './src/shared/gameData.ts';
import type {
  BombState,
  ChatMessage,
  ClientToServerMsg,
  KillFeedItem,
  NetPlayer,
  RoomStateSnapshot,
  ServerSummary,
  ServerToClientMsg,
} from './src/shared/protocol.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface ServerPlayer extends NetPlayer {
  ws?: WebSocket;
  respawnAt?: number;
  lastShotAt: number;
  botTargetWpIndex: number;
  botTargetSite: 'A' | 'B';
  botStrafeDir: number;
  botStrafeTimer: number;
  botPlantProgress: number;
  botReactionCooldown: number;
}

interface GameRoom {
  id: string;
  name: string;
  mode: GameMode;
  maxPlayers: number;
  botsEnabled: boolean;
  startingMoney: number;
  phase: RoundPhase;
  roundNumber: number;
  roundTimer: number;
  tScore: number;
  ctScore: number;
  roundWinner: Team | null;
  roundReason: string;
  bomb: BombState;
  players: Map<string, ServerPlayer>;
  chat: ChatMessage[];
  killFeed: KillFeedItem[];
  defusingPlayerId: string | null;
  createdAt: number;
}

const BOT_NAMES_T = ['Abu_Bakar', 'Qora_Burgut', 'Sniper_UZ', 'Temur_99', 'Sherzod_Pro', 'Alisher_AK'];
const BOT_NAMES_CT = ['Alpha_UZ', 'Bexruz_CT', 'Jasur_SWAT', 'Otabek_AWP', 'Sardor_Def', 'Kobra_01'];

let idCounter = 1;
function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}_${Date.now().toString(36)}_${idCounter}`;
}

const rooms = new Map<string, GameRoom>();
const lobbySubscribers = new Set<WebSocket>();
const clientToRoom = new Map<string, string>();
const clientSockets = new Map<string, WebSocket>();

function createInitialBomb(): BombState {
  return {
    state: 'CARRIED',
    carrierId: null,
    site: null,
    x: 0,
    y: 0,
    z: 0,
    timer: 40,
    defuseProgress: 0,
    defuserId: null,
  };
}

function createRoom(opts: {
  id?: string;
  name: string;
  mode: GameMode;
  maxPlayers: number;
  botsEnabled: boolean;
  startingMoney?: number;
}): GameRoom {
  const id = opts.id || nextId('srv');
  const room: GameRoom = {
    id,
    name: opts.name,
    mode: opts.mode,
    maxPlayers: Math.max(2, Math.min(16, opts.maxPlayers)),
    botsEnabled: opts.botsEnabled,
    startingMoney: opts.startingMoney ?? (opts.mode === 'tdm' ? 16000 : 3500),
    phase: opts.mode === 'tdm' ? 'LIVE' : 'FREEZETIME',
    roundNumber: 1,
    roundTimer: opts.mode === 'tdm' ? 300 : 3,
    tScore: 0,
    ctScore: 0,
    roundWinner: null,
    roundReason: '',
    bomb: createInitialBomb(),
    players: new Map(),
    chat: [
      {
        id: nextId('msg'),
        sender: 'Server',
        team: 'SPEC',
        text: `${opts.name} serveriga xush kelibsiz! Xarita: de_dust2.`,
        system: true,
        timestamp: Date.now(),
      },
    ],
    killFeed: [],
    defusingPlayerId: null,
    createdAt: Date.now(),
  };

  rooms.set(id, room);
  if (room.botsEnabled) {
    reconcileBots(room);
  }
  resetRound(room, true);
  return room;
}

function spawnPlayerAtTeam(player: ServerPlayer, indexInTeam: number, keepEquipment: boolean): void {
  const spawns = SPAWN_POINTS[player.team];
  const sp = spawns[indexInTeam % spawns.length];
  const jitterX = (Math.random() - 0.5) * 1.2;
  const jitterZ = (Math.random() - 0.5) * 1.2;
  player.x = sp.x + jitterX;
  player.y = sp.y;
  player.z = sp.z + jitterZ;
  player.yaw = sp.yaw;
  player.pitch = 0;
  player.crouching = false;
  player.alive = true;
  player.hp = 100;
  player.hasBomb = false;
  player.botPlantProgress = 0;

  if (!keepEquipment) {
    player.armor = 0;
    player.hasHelmet = false;
    player.hasDefuseKit = false;
    player.weapon = player.team === 'T' ? 'glock' : 'usp';
  }
}

function assignBotWeapon(bot: ServerPlayer, mode: GameMode): void {
  if (mode === 'tdm' || bot.money >= 4750) {
    const r = Math.random();
    if (r < 0.25) {
      bot.weapon = 'awp';
      bot.money = Math.max(0, bot.money - 4750);
    } else if (r < 0.78) {
      bot.weapon = bot.team === 'T' ? 'ak47' : 'm4a1';
      bot.money = Math.max(0, bot.money - 2500);
    } else {
      bot.weapon = 'deagle';
      bot.money = Math.max(0, bot.money - 650);
    }
    bot.armor = 100;
    bot.hasHelmet = true;
    if (bot.team === 'CT' && Math.random() < 0.5) {
      bot.hasDefuseKit = true;
    }
  } else if (bot.money >= 2500) {
    bot.weapon = bot.team === 'T' ? 'ak47' : 'm4a1';
    bot.money -= 2500;
    bot.armor = 100;
  } else if (bot.money >= 650) {
    bot.weapon = 'deagle';
    bot.money -= 650;
  } else {
    bot.weapon = bot.team === 'T' ? 'glock' : 'usp';
  }
}

function reconcileBots(room: GameRoom): void {
  const humans = Array.from(room.players.values()).filter((p) => !p.isBot);
  const bots = Array.from(room.players.values()).filter((p) => p.isBot);

  if (!room.botsEnabled) {
    for (const b of bots) {
      room.players.delete(b.id);
    }
    return;
  }

  const targetTotal = Math.min(room.maxPlayers, Math.max(6, humans.length + 4));
  const targetPerTeam = Math.floor(targetTotal / 2);

  const countTeam = (team: Team) =>
    Array.from(room.players.values()).filter((p) => p.team === team).length;

  // Remove extra bots if over target
  for (const team of ['T', 'CT'] as Team[]) {
    while (countTeam(team) > targetPerTeam) {
      const botToRemove = Array.from(room.players.values()).find(
        (p) => p.isBot && p.team === team
      );
      if (!botToRemove) break;
      room.players.delete(botToRemove.id);
    }
  }

  // Add missing bots
  for (const team of ['T', 'CT'] as Team[]) {
    let idx = 0;
    while (countTeam(team) < targetPerTeam && room.players.size < room.maxPlayers) {
      const names = team === 'T' ? BOT_NAMES_T : BOT_NAMES_CT;
      const usedNames = new Set(Array.from(room.players.values()).map((p) => p.name));
      const candidate = names.find((n) => !usedNames.has(n)) || `Bot_${team}_${idx + 1}`;
      idx += 1;
      const botId = nextId('bot');
      const sp = SPAWN_POINTS[team][0];
      const bot: ServerPlayer = {
        id: botId,
        name: candidate,
        team,
        isBot: true,
        alive: true,
        hp: 100,
        armor: 100,
        hasHelmet: true,
        hasDefuseKit: team === 'CT' && Math.random() < 0.5,
        hasBomb: false,
        money: room.startingMoney,
        kills: 0,
        deaths: 0,
        weapon: team === 'T' ? 'ak47' : 'm4a1',
        x: sp.x,
        y: sp.y,
        z: sp.z,
        yaw: sp.yaw,
        pitch: 0,
        crouching: false,
        lastShotAt: 0,
        botTargetWpIndex: team === 'T' ? 1 : 14,
        botTargetSite: Math.random() < 0.5 ? 'A' : 'B',
        botStrafeDir: Math.random() < 0.5 ? 1 : -1,
        botStrafeTimer: 0,
        botPlantProgress: 0,
        botReactionCooldown: 0,
      };
      assignBotWeapon(bot, room.mode);
      room.players.set(botId, bot);
    }
  }
}

function resetRound(room: GameRoom, initial = false): void {
  if (!initial) {
    room.roundNumber += 1;
  }
  room.phase = room.mode === 'tdm' ? 'LIVE' : 'FREEZETIME';
  room.roundTimer = room.mode === 'tdm' ? 300 : 3;
  room.roundWinner = null;
  room.roundReason = '';
  room.defusingPlayerId = null;
  room.bomb = createInitialBomb();

  if (room.botsEnabled) {
    reconcileBots(room);
  }

  let tIdx = 0;
  let ctIdx = 0;
  const tPlayers: ServerPlayer[] = [];

  for (const p of room.players.values()) {
    const keepEq = !initial && p.alive;
    if (p.team === 'T') {
      spawnPlayerAtTeam(p, tIdx++, keepEq);
      tPlayers.push(p);
      p.botTargetSite = Math.random() < 0.55 ? 'A' : 'B';
      p.botTargetWpIndex = p.botTargetSite === 'A' ? 7 : 10;
    } else {
      spawnPlayerAtTeam(p, ctIdx++, keepEq);
      p.botTargetSite = Math.random() < 0.55 ? 'A' : 'B';
      p.botTargetWpIndex = p.botTargetSite === 'A' ? 6 : 12;
    }
    if (p.isBot && !keepEq) {
      assignBotWeapon(p, room.mode);
    }
  }

  // Give C4 to a Terrorist in bomb mode (prefer human T if available)
  if (room.mode === 'bomb' && tPlayers.length > 0) {
    const humanT = tPlayers.find((p) => !p.isBot);
    const carrier = humanT || tPlayers[0];
    carrier.hasBomb = true;
    room.bomb.state = 'CARRIED';
    room.bomb.carrierId = carrier.id;
  }
}

function getServerSummary(room: GameRoom): ServerSummary {
  const all = Array.from(room.players.values());
  const humans = all.filter((p) => !p.isBot).length;
  return {
    id: room.id,
    name: room.name,
    map: 'de_dust2',
    mode: room.mode,
    players: all.length,
    humans,
    maxPlayers: room.maxPlayers,
    botsEnabled: room.botsEnabled,
    tScore: room.tScore,
    ctScore: room.ctScore,
    phase: room.phase,
  };
}

function getRoomSnapshot(room: GameRoom): RoomStateSnapshot {
  const players: NetPlayer[] = Array.from(room.players.values()).map((p) => ({
    id: p.id,
    name: p.name,
    team: p.team,
    isBot: p.isBot,
    alive: p.alive,
    hp: p.hp,
    armor: p.armor,
    hasHelmet: p.hasHelmet,
    hasDefuseKit: p.hasDefuseKit,
    hasBomb: p.hasBomb,
    money: p.money,
    kills: p.kills,
    deaths: p.deaths,
    weapon: p.weapon,
    x: p.x,
    y: p.y,
    z: p.z,
    yaw: p.yaw,
    pitch: p.pitch,
    crouching: p.crouching,
  }));

  return {
    serverId: room.id,
    serverName: room.name,
    mode: room.mode,
    phase: room.phase,
    roundNumber: room.roundNumber,
    roundTimer: Math.max(0, Math.ceil(room.roundTimer)),
    tScore: room.tScore,
    ctScore: room.ctScore,
    roundWinner: room.roundWinner,
    roundReason: room.roundReason,
    bomb: { ...room.bomb },
    players,
  };
}

function sendMsg(ws: WebSocket | undefined, msg: ServerToClientMsg): void {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify(msg));
}

function broadcastRoom(room: GameRoom, msg: ServerToClientMsg): void {
  const payload = JSON.stringify(msg);
  for (const p of room.players.values()) {
    if (p.ws && p.ws.readyState === WebSocket.OPEN) {
      p.ws.send(payload);
    }
  }
}

function broadcastServersList(): void {
  const list = Array.from(rooms.values()).map(getServerSummary);
  const payload = JSON.stringify({ type: 'servers:list', servers: list } satisfies ServerToClientMsg);
  for (const ws of lobbySubscribers) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
    }
  }
}

function rayIntersectSphereOrCylinder(
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
  cx: number,
  cy: number,
  cz: number,
  radius: number
): number | null {
  const vx = ox - cx;
  const vy = oy - cy;
  const vz = oz - cz;
  const b = vx * dx + vy * dy + vz * dz;
  const c = vx * vx + vy * vy + vz * vz - radius * radius;
  const disc = b * b - c;
  if (disc < 0) return null;
  const t = -b - Math.sqrt(disc);
  return t >= 0 ? t : null;
}

function handleShot(
  room: GameRoom,
  shooter: ServerPlayer,
  origin: [number, number, number],
  dir: [number, number, number],
  weaponId: WeaponId
): void {
  if (!shooter.alive) return;
  if (room.phase === 'FREEZETIME') return;
  const spec = WEAPONS[weaponId];
  if (!spec || weaponId === 'c4') return;

  const len = Math.hypot(dir[0], dir[1], dir[2]) || 1;
  const dx = dir[0] / len;
  const dy = dir[1] / len;
  const dz = dir[2] / len;

  const wallHitDist = rayIntersectsMap(origin[0], origin[1], origin[2], dx, dy, dz, spec.range);
  const maxCheckDist = wallHitDist !== null ? wallHitDist : spec.range;

  let hitTarget: ServerPlayer | null = null;
  let bestDist = maxCheckDist;
  let isHeadshot = false;

  for (const target of room.players.values()) {
    if (!target.alive || target.id === shooter.id || target.team === shooter.team) continue;

    const eyeHeight = target.crouching ? 1.15 : 1.56;
    // Check head sphere first
    const headDist = rayIntersectSphereOrCylinder(
      origin[0],
      origin[1],
      origin[2],
      dx,
      dy,
      dz,
      target.x,
      target.y + eyeHeight,
      target.z,
      0.28
    );

    if (headDist !== null && headDist < bestDist) {
      bestDist = headDist;
      hitTarget = target;
      isHeadshot = true;
      continue;
    }

    // Check torso upper & lower spheres
    const chestDist = rayIntersectSphereOrCylinder(
      origin[0],
      origin[1],
      origin[2],
      dx,
      dy,
      dz,
      target.x,
      target.y + (target.crouching ? 0.72 : 1.05),
      target.z,
      0.42
    );
    if (chestDist !== null && chestDist < bestDist) {
      bestDist = chestDist;
      hitTarget = target;
      isHeadshot = false;
      continue;
    }

    const hipDist = rayIntersectSphereOrCylinder(
      origin[0],
      origin[1],
      origin[2],
      dx,
      dy,
      dz,
      target.x,
      target.y + 0.55,
      target.z,
      0.4
    );
    if (hipDist !== null && hipDist < bestDist) {
      bestDist = hipDist;
      hitTarget = target;
      isHeadshot = false;
    }
  }

  const endPoint: [number, number, number] = [
    origin[0] + dx * bestDist,
    origin[1] + dy * bestDist,
    origin[2] + dz * bestDist,
  ];

  let dealtDamage = 0;
  if (hitTarget) {
    let rawDmg = spec.damage * (isHeadshot ? spec.headshotMult : 1);
    if (hitTarget.armor > 0 && (!isHeadshot || hitTarget.hasHelmet)) {
      const absorbed = rawDmg * 0.35;
      hitTarget.armor = Math.max(0, Math.round(hitTarget.armor - absorbed * 0.5));
      rawDmg -= absorbed;
    }
    dealtDamage = Math.max(1, Math.round(rawDmg));
    hitTarget.hp = Math.max(0, hitTarget.hp - dealtDamage);

    broadcastRoom(room, {
      type: 'player:damaged',
      victimId: hitTarget.id,
      attackerId: shooter.id,
      hp: hitTarget.hp,
      armor: hitTarget.armor,
      headshot: isHeadshot,
    });

    if (hitTarget.hp <= 0) {
      handlePlayerKilled(room, shooter, hitTarget, weaponId, isHeadshot);
    }
  }

  broadcastRoom(room, {
    type: 'player:shot',
    shooterId: shooter.id,
    weapon: weaponId,
    origin,
    endPoint,
    hitPlayerId: hitTarget?.id,
    headshot: isHeadshot,
    damage: dealtDamage,
  });
}

function handlePlayerKilled(
  room: GameRoom,
  killer: ServerPlayer,
  victim: ServerPlayer,
  weapon: WeaponId,
  headshot: boolean
): void {
  victim.alive = false;
  victim.deaths += 1;
  killer.kills += 1;
  killer.money = Math.min(16000, killer.money + (weapon === 'knife' ? 1500 : 300));

  if (room.mode === 'tdm') {
    victim.respawnAt = Date.now() + 2500;
    if (killer.team === 'T') room.tScore += 1;
    else room.ctScore += 1;
  }

  // Drop C4 if victim had it
  if (victim.hasBomb) {
    victim.hasBomb = false;
    room.bomb.state = 'DROPPED';
    room.bomb.carrierId = null;
    room.bomb.x = victim.x;
    room.bomb.y = victim.y;
    room.bomb.z = victim.z;
  }

  // Stop defusing if victim was defusing
  if (room.defusingPlayerId === victim.id) {
    room.defusingPlayerId = null;
    room.bomb.defuserId = null;
    room.bomb.defuseProgress = 0;
  }

  const item: KillFeedItem = {
    id: nextId('kill'),
    killerName: killer.name,
    killerTeam: killer.team,
    victimName: victim.name,
    victimTeam: victim.team,
    weapon,
    headshot,
    timestamp: Date.now(),
  };
  room.killFeed = [item, ...room.killFeed].slice(0, 8);
  broadcastRoom(room, { type: 'kill:event', item });

  if (room.mode === 'bomb' && (room.phase === 'LIVE' || room.phase === 'BOMB_PLANTED')) {
    checkBombRoundElimination(room);
  }
}

function endRound(room: GameRoom, winner: Team, reason: string): void {
  if (room.phase === 'ROUND_END') return;
  room.phase = 'ROUND_END';
  room.roundWinner = winner;
  room.roundReason = reason;
  room.roundTimer = 4.5;

  if (winner === 'T') room.tScore += 1;
  else room.ctScore += 1;

  for (const p of room.players.values()) {
    const bonus = p.team === winner ? 3250 : 1900;
    p.money = Math.min(16000, p.money + bonus);
  }

  broadcastRoom(room, {
    type: 'round:event',
    winner,
    reason,
    tScore: room.tScore,
    ctScore: room.ctScore,
  });
}

function checkBombRoundElimination(room: GameRoom): void {
  const players = Array.from(room.players.values());
  const tAlive = players.filter((p) => p.team === 'T' && p.alive).length;
  const ctAlive = players.filter((p) => p.team === 'CT' && p.alive).length;

  if (ctAlive === 0 && room.phase === 'LIVE') {
    endRound(room, 'T', 'Barcha Maxsus Kuchlar yo‘q qilindi');
  } else if (ctAlive === 0 && room.phase === 'BOMB_PLANTED') {
    endRound(room, 'T', 'Maxsus Kuchlar yo‘q qilindi');
  } else if (tAlive === 0 && room.phase === 'LIVE') {
    endRound(room, 'CT', 'Barcha Terroristlar zararsizlantirildi');
  }
}

function stepBots(room: GameRoom, dt: number): void {
  if (room.phase === 'FREEZETIME') return;
  const allPlayers = Array.from(room.players.values());

  for (const bot of allPlayers) {
    if (!bot.isBot || !bot.alive) continue;

    // 1. Pick up dropped C4 if T bot
    if (
      room.mode === 'bomb' &&
      bot.team === 'T' &&
      room.bomb.state === 'DROPPED' &&
      !bot.hasBomb
    ) {
      const distToBomb = Math.hypot(bot.x - room.bomb.x, bot.z - room.bomb.z);
      if (distToBomb < 2.2) {
        bot.hasBomb = true;
        room.bomb.state = 'CARRIED';
        room.bomb.carrierId = bot.id;
      }
    }

    // 2. Check for visible enemy
    let nearestEnemy: ServerPlayer | null = null;
    let nearestDist = 55;
    for (const other of allPlayers) {
      if (!other.alive || other.team === bot.team) continue;
      const dist = Math.hypot(other.x - bot.x, other.y - bot.y, other.z - bot.z);
      if (dist < nearestDist) {
        const ox = bot.x;
        const oy = bot.y + 1.5;
        const oz = bot.z;
        const tx = other.x;
        const ty = other.y + 1.4;
        const tz = other.z;
        const d = Math.hypot(tx - ox, ty - oy, tz - oz) || 1;
        const blocked = rayIntersectsMap(
          ox,
          oy,
          oz,
          (tx - ox) / d,
          (ty - oy) / d,
          (tz - oz) / d,
          d - 0.3
        );
        if (blocked === null) {
          nearestDist = dist;
          nearestEnemy = other;
        }
      }
    }

    if (nearestEnemy) {
      // Face enemy & fire
      const dx = nearestEnemy.x - bot.x;
      const dz = nearestEnemy.z - bot.z;
      const dy = nearestEnemy.y + 1.35 - (bot.y + 1.5);
      const flatDist = Math.hypot(dx, dz) || 1;
      bot.yaw = Math.atan2(-dx, -dz);
      bot.pitch = Math.atan2(dy, flatDist);

      bot.botStrafeTimer -= dt;
      if (bot.botStrafeTimer <= 0) {
        bot.botStrafeDir = Math.random() < 0.5 ? 1 : -1;
        bot.botStrafeTimer = 0.7 + Math.random() * 0.9;
      }

      // Strafe while fighting
      const strafeAngle = bot.yaw + (Math.PI / 2) * bot.botStrafeDir;
      const moveSpeed = 3.2;
      const nextX = bot.x - Math.sin(strafeAngle) * moveSpeed * dt;
      const nextZ = bot.z - Math.cos(strafeAngle) * moveSpeed * dt;
      const resolved = resolveMapCollision(nextX, bot.y, nextZ);
      bot.x = resolved.x;
      bot.z = resolved.z;
      bot.y = getGroundHeightAt(bot.x, bot.z, bot.y);

      const now = Date.now();
      const spec = WEAPONS[bot.weapon];
      const botFireCooldown = Math.max(spec.fireRateMs * 2.2, 260);
      if (now - bot.lastShotAt > botFireCooldown) {
        bot.lastShotAt = now;
        const aimError = bot.weapon === 'awp' ? 0.032 : 0.055;
        const sdx = dx / Math.hypot(dx, dy, dz) + (Math.random() - 0.5) * aimError;
        const sdy = dy / Math.hypot(dx, dy, dz) + (Math.random() - 0.5) * aimError * 0.6;
        const sdz = dz / Math.hypot(dx, dy, dz) + (Math.random() - 0.5) * aimError;
        handleShot(room, bot, [bot.x, bot.y + 1.5, bot.z], [sdx, sdy, sdz], bot.weapon);
      }
      continue;
    }

    // 3. Bomb Objective logic
    let goalX = 0;
    let goalZ = 0;
    let atObjective = false;

    if (room.mode === 'bomb' && room.bomb.state === 'PLANTED') {
      goalX = room.bomb.x;
      goalZ = room.bomb.z;
      const distToBomb = Math.hypot(goalX - bot.x, goalZ - bot.z);
      if (bot.team === 'CT' && distToBomb < 2.6) {
        atObjective = true;
        if (!room.defusingPlayerId || room.defusingPlayerId === bot.id) {
          room.defusingPlayerId = bot.id;
          room.bomb.defuserId = bot.id;
        }
      } else if (bot.team === 'T' && distToBomb < 6.5) {
        atObjective = true;
      }
    } else if (room.mode === 'bomb' && bot.hasBomb && room.phase === 'LIVE') {
      const site = BOMBSITES[bot.botTargetSite];
      const distToSite = Math.hypot(site.x - bot.x, site.z - bot.z);
      if (distToSite < site.radius - 1.5) {
        atObjective = true;
        bot.botPlantProgress += dt;
        if (bot.botPlantProgress >= 2.8) {
          bot.hasBomb = false;
          room.phase = 'BOMB_PLANTED';
          room.bomb.state = 'PLANTED';
          room.bomb.carrierId = null;
          room.bomb.site = site.id;
          room.bomb.x = bot.x;
          room.bomb.y = bot.y;
          room.bomb.z = bot.z;
          room.bomb.timer = 40;
          room.bomb.defuseProgress = 0;
          broadcastRoom(room, {
            type: 'bomb:event',
            event: 'planted',
            site: site.id,
            by: bot.name,
            x: bot.x,
            y: bot.y,
            z: bot.z,
          });
        }
      } else {
        const wp = BOT_WAYPOINTS[bot.botTargetWpIndex] || site;
        goalX = wp.x;
        goalZ = wp.z;
        if (Math.hypot(wp.x - bot.x, wp.z - bot.z) < 3.2) {
          if (bot.botTargetSite === 'A') {
            bot.botTargetWpIndex = 6; // a_site
          } else {
            bot.botTargetWpIndex = 12; // b_site
          }
        }
      }
    } else {
      const wp = BOT_WAYPOINTS[bot.botTargetWpIndex] || BOT_WAYPOINTS[2];
      goalX = wp.x;
      goalZ = wp.z;
      if (Math.hypot(goalX - bot.x, goalZ - bot.z) < 3.2) {
        const tRoute = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
        const ctRoute = [15, 14, 13, 12, 6, 5, 3, 2, 9];
        const pool = bot.team === 'T' ? tRoute : ctRoute;
        bot.botTargetWpIndex = pool[Math.floor(Math.random() * pool.length)];
      }
    }

    if (!atObjective) {
      const dx = goalX - bot.x;
      const dz = goalZ - bot.z;
      const dist = Math.hypot(dx, dz) || 1;
      bot.yaw = Math.atan2(-dx, -dz);
      bot.pitch = 0;
      const speed = 4.6;
      const nx = bot.x + (dx / dist) * speed * dt;
      const nz = bot.z + (dz / dist) * speed * dt;
      const resolved = resolveMapCollision(nx, bot.y, nz);
      // If stuck on wall, jitter waypoint
      if (Math.hypot(resolved.x - bot.x, resolved.z - bot.z) < speed * dt * 0.2) {
        bot.botTargetWpIndex = Math.floor(Math.random() * BOT_WAYPOINTS.length);
      }
      bot.x = resolved.x;
      bot.z = resolved.z;
      bot.y = getGroundHeightAt(bot.x, bot.z, bot.y);
    }
  }
}

function tickRooms(): void {
  const dt = 0.1;
  const now = Date.now();

  for (const room of rooms.values()) {
    // Handle TDM respawns
    if (room.mode === 'tdm') {
      let tIdx = 0;
      let ctIdx = 0;
      for (const p of room.players.values()) {
        if (!p.alive && p.respawnAt && now >= p.respawnAt) {
          p.respawnAt = undefined;
          spawnPlayerAtTeam(p, p.team === 'T' ? tIdx++ : ctIdx++, true);
        }
      }
    }

    // Human T picking up dropped C4
    if (room.mode === 'bomb' && room.bomb.state === 'DROPPED') {
      for (const p of room.players.values()) {
        if (!p.isBot && p.alive && p.team === 'T') {
          if (Math.hypot(p.x - room.bomb.x, p.z - room.bomb.z) < 2.2) {
            p.hasBomb = true;
            room.bomb.state = 'CARRIED';
            room.bomb.carrierId = p.id;
            break;
          }
        }
      }
    }

    // Update carried bomb coords
    if (room.bomb.state === 'CARRIED' && room.bomb.carrierId) {
      const carrier = room.players.get(room.bomb.carrierId);
      if (carrier && carrier.alive) {
        room.bomb.x = carrier.x;
        room.bomb.y = carrier.y;
        room.bomb.z = carrier.z;
      }
    }

    // Round phase timers
    if (room.mode === 'bomb') {
      if (room.phase === 'FREEZETIME') {
        room.roundTimer -= dt;
        if (room.roundTimer <= 0) {
          room.phase = 'LIVE';
          room.roundTimer = 115;
        }
      } else if (room.phase === 'LIVE') {
        room.roundTimer -= dt;
        if (room.roundTimer <= 0) {
          endRound(room, 'CT', 'Vaqt tugadi — hudud himoya qilindi');
        }
      } else if (room.phase === 'BOMB_PLANTED') {
        room.bomb.timer -= dt;
        room.roundTimer = room.bomb.timer;

        // Defuse progress
        if (room.defusingPlayerId) {
          const defuser = room.players.get(room.defusingPlayerId);
          if (
            !defuser ||
            !defuser.alive ||
            defuser.team !== 'CT' ||
            Math.hypot(defuser.x - room.bomb.x, defuser.z - room.bomb.z) > 3.5
          ) {
            room.defusingPlayerId = null;
            room.bomb.defuserId = null;
            room.bomb.defuseProgress = 0;
          } else {
            const defuseDuration = defuser.hasDefuseKit ? 4.5 : 8.0;
            room.bomb.defuseProgress = Math.min(
              1,
              room.bomb.defuseProgress + dt / defuseDuration
            );
            if (room.bomb.defuseProgress >= 1) {
              room.bomb.state = 'DEFUSED';
              room.defusingPlayerId = null;
              room.bomb.defuserId = null;
              broadcastRoom(room, {
                type: 'bomb:event',
                event: 'defused',
                by: defuser.name,
                site: room.bomb.site ?? 'A',
              });
              endRound(room, 'CT', `${defuser.name} bombani zararsizlantirdi!`);
            }
          }
        }

        if (room.bomb.timer <= 0 && room.phase === 'BOMB_PLANTED') {
          room.bomb.state = 'EXPLODED';
          for (const p of room.players.values()) {
            if (p.alive) {
              const dist = Math.hypot(p.x - room.bomb.x, p.z - room.bomb.z);
              if (dist < 22) {
                p.hp = 0;
                p.alive = false;
              }
            }
          }
          broadcastRoom(room, {
            type: 'bomb:event',
            event: 'exploded',
            site: room.bomb.site ?? 'A',
            x: room.bomb.x,
            y: room.bomb.y,
            z: room.bomb.z,
          });
          endRound(room, 'T', 'Bomba portladi — nishon yo‘q qilindi!');
        }
      } else if (room.phase === 'ROUND_END') {
        room.roundTimer -= dt;
        if (room.roundTimer <= 0) {
          resetRound(room, false);
        }
      }
    } else {
      // TDM round loop
      room.roundTimer -= dt;
      if (room.roundTimer <= 0) {
        const winner: Team = room.tScore >= room.ctScore ? 'T' : 'CT';
        room.tScore = 0;
        room.ctScore = 0;
        broadcastRoom(room, {
          type: 'round:event',
          winner,
          reason: 'Jamoaviy jang yakunlandi! Yangi o‘yin boshlandi.',
          tScore: 0,
          ctScore: 0,
        });
        resetRound(room, false);
      }
    }

    // Step AI bots
    stepBots(room, dt);

    // Broadcast authoritative room snapshot
    const hasHumans = Array.from(room.players.values()).some((p) => !p.isBot);
    if (hasHumans) {
      broadcastRoom(room, {
        type: 'room:state',
        snapshot: getRoomSnapshot(room),
      });
    }
  }
}

// Pre-seed iconic CS 1.6 servers
createRoom({
  id: 'uz_dust2_classic',
  name: 'Toshkent Dust2 Classic [5v5]',
  mode: 'bomb',
  maxPlayers: 10,
  botsEnabled: true,
  startingMoney: 3500,
});
createRoom({
  id: 'uz_awp_deagle',
  name: 'Dust2 Pro AWP & Deagle [$16K]',
  mode: 'bomb',
  maxPlayers: 12,
  botsEnabled: true,
  startingMoney: 16000,
});
createRoom({
  id: 'uz_tdm_arena',
  name: 'Jamoaviy Jang (TDM) Dust2',
  mode: 'tdm',
  maxPlayers: 12,
  botsEnabled: true,
  startingMoney: 16000,
});

async function startServer() {
  const app = express();
  app.use(express.json());

  app.get('/api/servers', (_req, res) => {
    const servers = Array.from(rooms.values()).map(getServerSummary);
    res.json({ servers });
  });

  app.post('/api/servers', (req, res) => {
    const body = req.body as {
      name?: string;
      mode?: GameMode;
      maxPlayers?: number;
      botsEnabled?: boolean;
    };
    const name = String(body?.name || '').trim().slice(0, 40) || 'Yangi Dust2 Server';
    const mode: GameMode = body?.mode === 'tdm' ? 'tdm' : 'bomb';
    const maxPlayers = Number(body?.maxPlayers) || 10;
    const botsEnabled = body?.botsEnabled !== false;

    const room = createRoom({
      name,
      mode,
      maxPlayers,
      botsEnabled,
      startingMoney: mode === 'tdm' ? 16000 : 3500,
    });
    broadcastServersList();
    res.status(201).json({ server: getServerSummary(room) });
  });

  if (process.env.NODE_ENV === 'production') {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws) => {
    const clientId = nextId('plr');
    clientSockets.set(clientId, ws);
    lobbySubscribers.add(ws);

    sendMsg(ws, {
      type: 'welcome',
      clientId,
      servers: Array.from(rooms.values()).map(getServerSummary),
    });

    ws.on('message', (raw) => {
      let msg: ClientToServerMsg;
      try {
        msg = JSON.parse(String(raw)) as ClientToServerMsg;
      } catch {
        return;
      }

      if (msg.type === 'servers:subscribe') {
        lobbySubscribers.add(ws);
        sendMsg(ws, {
          type: 'servers:list',
          servers: Array.from(rooms.values()).map(getServerSummary),
        });
        return;
      }

      if (msg.type === 'room:join') {
        const room = rooms.get(msg.serverId);
        if (!room) {
          sendMsg(ws, { type: 'error', message: 'Server topilmadi.' });
          return;
        }

        // Leave any previous room
        const prevRoomId = clientToRoom.get(clientId);
        if (prevRoomId) {
          const prevRoom = rooms.get(prevRoomId);
          if (prevRoom) {
            prevRoom.players.delete(clientId);
            reconcileBots(prevRoom);
          }
        }

        const tCount = Array.from(room.players.values()).filter(
          (p) => !p.isBot && p.team === 'T'
        ).length;
        const ctCount = Array.from(room.players.values()).filter(
          (p) => !p.isBot && p.team === 'CT'
        ).length;
        const chosenTeam: Team = msg.team || (tCount <= ctCount ? 'T' : 'CT');

        // Make room by removing a bot on chosen team if full
        if (room.players.size >= room.maxPlayers) {
          const botToKick =
            Array.from(room.players.values()).find((p) => p.isBot && p.team === chosenTeam) ||
            Array.from(room.players.values()).find((p) => p.isBot);
          if (botToKick) {
            room.players.delete(botToKick.id);
          } else {
            sendMsg(ws, { type: 'error', message: 'Server to‘la!' });
            return;
          }
        }

        const cleanName = String(msg.playerName || 'Askar').trim().slice(0, 20) || 'Askar';
        const sp = SPAWN_POINTS[chosenTeam][0];
        const newPlayer: ServerPlayer = {
          id: clientId,
          name: cleanName,
          team: chosenTeam,
          isBot: false,
          alive: true,
          hp: 100,
          armor: 100,
          hasHelmet: true,
          hasDefuseKit: false,
          hasBomb: false,
          money: room.startingMoney,
          kills: 0,
          deaths: 0,
          weapon: chosenTeam === 'T' ? 'glock' : 'usp',
          x: sp.x,
          y: sp.y,
          z: sp.z,
          yaw: sp.yaw,
          pitch: 0,
          crouching: false,
          ws,
          lastShotAt: 0,
          botTargetWpIndex: 0,
          botTargetSite: 'A',
          botStrafeDir: 1,
          botStrafeTimer: 0,
          botPlantProgress: 0,
          botReactionCooldown: 0,
        };

        // Transfer bomb if a T bot has it and round is just starting
        if (room.mode === 'bomb' && chosenTeam === 'T' && room.bomb.state === 'CARRIED' && room.bomb.carrierId) {
          const currentCarrier = room.players.get(room.bomb.carrierId);
          if (currentCarrier && currentCarrier.isBot && room.phase === 'FREEZETIME') {
            currentCarrier.hasBomb = false;
            newPlayer.hasBomb = true;
            room.bomb.carrierId = newPlayer.id;
          }
        }

        room.players.set(clientId, newPlayer);
        clientToRoom.set(clientId, room.id);
        reconcileBots(room);

        const sysChat: ChatMessage = {
          id: nextId('msg'),
          sender: 'Tizim',
          team: 'SPEC',
          text: `${cleanName} (${chosenTeam}) o‘yinga qo‘shildi.`,
          system: true,
          timestamp: Date.now(),
        };
        room.chat = [...room.chat.slice(-24), sysChat];

        sendMsg(ws, {
          type: 'room:joined',
          yourId: clientId,
          snapshot: getRoomSnapshot(room),
          chat: room.chat,
          killFeed: room.killFeed,
        });
        broadcastRoom(room, { type: 'chat:message', msg: sysChat });
        broadcastServersList();
        return;
      }

      const roomId = clientToRoom.get(clientId);
      if (!roomId) return;
      const room = rooms.get(roomId);
      if (!room) return;
      const player = room.players.get(clientId);
      if (!player) return;

      if (msg.type === 'room:leave') {
        room.players.delete(clientId);
        clientToRoom.delete(clientId);
        if (room.bomb.carrierId === clientId) {
          room.bomb.state = 'DROPPED';
          room.bomb.carrierId = null;
        }
        reconcileBots(room);
        broadcastServersList();
        return;
      }

      if (msg.type === 'room:switch_team') {
        if (player.team !== msg.team) {
          if (player.hasBomb) {
            player.hasBomb = false;
            room.bomb.state = 'DROPPED';
            room.bomb.carrierId = null;
          }
          player.team = msg.team;
          spawnPlayerAtTeam(player, 0, false);
          reconcileBots(room);
        }
        return;
      }

      if (msg.type === 'player:move') {
        if (!player.alive) return;
        if (room.phase === 'FREEZETIME') {
          player.yaw = msg.yaw;
          player.pitch = msg.pitch;
          player.weapon = msg.weapon;
          return;
        }
        player.x = msg.x;
        player.y = msg.y;
        player.z = msg.z;
        player.yaw = msg.yaw;
        player.pitch = msg.pitch;
        player.crouching = msg.crouching;
        player.weapon = msg.weapon;
        return;
      }

      if (msg.type === 'player:shoot') {
        handleShot(room, player, msg.origin, msg.dir, msg.weapon);
        return;
      }

      if (msg.type === 'player:buy') {
        if (!player.alive) return;
        if (msg.item === 'kevlar') {
          const cost = 1000;
          if (player.money >= cost) {
            player.money -= cost;
            player.armor = 100;
            player.hasHelmet = true;
            sendMsg(ws, { type: 'buy:result', ok: true, item: 'kevlar', money: player.money });
          } else {
            sendMsg(ws, { type: 'buy:result', ok: false, item: 'kevlar', money: player.money, message: 'Mablag‘ yetarli emas' });
          }
          return;
        }
        if (msg.item === 'defuse_kit') {
          if (player.team !== 'CT') return;
          const cost = 400;
          if (player.money >= cost && !player.hasDefuseKit) {
            player.money -= cost;
            player.hasDefuseKit = true;
            sendMsg(ws, { type: 'buy:result', ok: true, item: 'defuse_kit', money: player.money });
          }
          return;
        }
        const spec = WEAPONS[msg.item];
        if (!spec) return;
        if (player.money >= spec.price) {
          player.money -= spec.price;
          player.weapon = spec.id;
          sendMsg(ws, { type: 'buy:result', ok: true, item: spec.id, money: player.money });
        } else {
          sendMsg(ws, {
            type: 'buy:result',
            ok: false,
            item: spec.id,
            money: player.money,
            message: 'Mablag‘ yetarli emas',
          });
        }
        return;
      }

      if (msg.type === 'bomb:plant_start') {
        if (player.team === 'T' && player.hasBomb && room.phase === 'LIVE') {
          broadcastRoom(room, { type: 'bomb:event', event: 'plant_sound', site: msg.site });
        }
        return;
      }

      if (msg.type === 'bomb:plant_complete') {
        if (
          room.mode === 'bomb' &&
          room.phase === 'LIVE' &&
          player.alive &&
          player.team === 'T' &&
          player.hasBomb
        ) {
          player.hasBomb = false;
          player.money = Math.min(16000, player.money + 300);
          room.phase = 'BOMB_PLANTED';
          room.bomb.state = 'PLANTED';
          room.bomb.carrierId = null;
          room.bomb.site = msg.site;
          room.bomb.x = msg.x;
          room.bomb.y = msg.y;
          room.bomb.z = msg.z;
          room.bomb.timer = 40;
          room.bomb.defuseProgress = 0;

          broadcastRoom(room, {
            type: 'bomb:event',
            event: 'planted',
            site: msg.site,
            by: player.name,
            x: msg.x,
            y: msg.y,
            z: msg.z,
          });
        }
        return;
      }

      if (msg.type === 'bomb:defuse_progress') {
        if (room.phase !== 'BOMB_PLANTED' || player.team !== 'CT' || !player.alive) return;
        if (msg.active) {
          const dist = Math.hypot(player.x - room.bomb.x, player.z - room.bomb.z);
          if (dist <= 3.5 && (!room.defusingPlayerId || room.defusingPlayerId === player.id)) {
            room.defusingPlayerId = player.id;
            room.bomb.defuserId = player.id;
          }
        } else if (room.defusingPlayerId === player.id) {
          room.defusingPlayerId = null;
          room.bomb.defuserId = null;
          room.bomb.defuseProgress = 0;
        }
        return;
      }

      if (msg.type === 'chat:send') {
        const text = String(msg.text || '').trim().slice(0, 140);
        if (!text) return;
        const chatMsg: ChatMessage = {
          id: nextId('msg'),
          sender: player.name,
          team: player.team,
          text,
          timestamp: Date.now(),
        };
        room.chat = [...room.chat.slice(-24), chatMsg];
        broadcastRoom(room, { type: 'chat:message', msg: chatMsg });
      }
    });

    ws.on('close', () => {
      lobbySubscribers.delete(ws);
      clientSockets.delete(clientId);
      const roomId = clientToRoom.get(clientId);
      if (roomId) {
        clientToRoom.delete(clientId);
        const room = rooms.get(roomId);
        if (room) {
          const p = room.players.get(clientId);
          if (p?.hasBomb) {
            room.bomb.state = 'DROPPED';
            room.bomb.carrierId = null;
            room.bomb.x = p.x;
            room.bomb.y = p.y;
            room.bomb.z = p.z;
          }
          room.players.delete(clientId);
          reconcileBots(room);
          broadcastServersList();
        }
      }
    });
  });

  setInterval(tickRooms, 100);

  const PORT = Number(process.env.PORT) || 3000;
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`CS 1.6 Dust 2 Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
