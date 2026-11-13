import type { GameMode, RoundPhase, Team, WeaponId } from './gameData.ts';

export interface ServerSummary {
  id: string;
  name: string;
  map: string;
  mode: GameMode;
  players: number;
  humans: number;
  maxPlayers: number;
  botsEnabled: boolean;
  tScore: number;
  ctScore: number;
  phase: RoundPhase;
}

export interface NetPlayer {
  id: string;
  name: string;
  team: Team;
  isBot: boolean;
  alive: boolean;
  hp: number;
  armor: number;
  hasHelmet: boolean;
  hasDefuseKit: boolean;
  hasBomb: boolean;
  money: number;
  kills: number;
  deaths: number;
  weapon: WeaponId;
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  crouching: boolean;
}

export interface BombState {
  state: 'CARRIED' | 'DROPPED' | 'PLANTED' | 'DEFUSED' | 'EXPLODED';
  carrierId: string | null;
  site: 'A' | 'B' | null;
  x: number;
  y: number;
  z: number;
  timer: number; // seconds remaining until detonation
  defuseProgress: number; // 0..1
  defuserId: string | null;
}

export interface KillFeedItem {
  id: string;
  killerName: string;
  killerTeam: Team;
  victimName: string;
  victimTeam: Team;
  weapon: WeaponId;
  headshot: boolean;
  timestamp: number;
}

export interface ChatMessage {
  id: string;
  sender: string;
  team: Team | 'SPEC';
  text: string;
  system?: boolean;
  timestamp: number;
}

export interface RoomStateSnapshot {
  serverId: string;
  serverName: string;
  mode: GameMode;
  phase: RoundPhase;
  roundNumber: number;
  roundTimer: number;
  tScore: number;
  ctScore: number;
  roundWinner: Team | null;
  roundReason: string;
  bomb: BombState;
  players: NetPlayer[];
}

export type ClientToServerMsg =
  | { type: 'servers:subscribe' }
  | { type: 'room:join'; serverId: string; playerName: string; team?: Team }
  | { type: 'room:leave' }
  | { type: 'room:switch_team'; team: Team }
  | { type: 'player:move'; x: number; y: number; z: number; yaw: number; pitch: number; crouching: boolean; weapon: WeaponId }
  | { type: 'player:shoot'; origin: [number, number, number]; dir: [number, number, number]; weapon: WeaponId }
  | { type: 'player:buy'; item: WeaponId | 'kevlar' | 'defuse_kit' }
  | { type: 'bomb:plant_start'; site: 'A' | 'B' }
  | { type: 'bomb:plant_complete'; site: 'A' | 'B'; x: number; y: number; z: number }
  | { type: 'bomb:defuse_progress'; active: boolean }
  | { type: 'chat:send'; text: string };

export type ServerToClientMsg =
  | { type: 'welcome'; clientId: string; servers: ServerSummary[] }
  | { type: 'servers:list'; servers: ServerSummary[] }
  | { type: 'room:joined'; yourId: string; snapshot: RoomStateSnapshot; chat: ChatMessage[]; killFeed: KillFeedItem[] }
  | { type: 'room:state'; snapshot: RoomStateSnapshot }
  | { type: 'player:shot'; shooterId: string; weapon: WeaponId; origin: [number, number, number]; endPoint: [number, number, number]; hitPlayerId?: string; headshot?: boolean; damage?: number }
  | { type: 'player:damaged'; victimId: string; attackerId: string; hp: number; armor: number; headshot: boolean }
  | { type: 'kill:event'; item: KillFeedItem }
  | { type: 'bomb:event'; event: 'planted' | 'defused' | 'exploded' | 'plant_sound'; site?: 'A' | 'B'; by?: string; x?: number; y?: number; z?: number }
  | { type: 'round:event'; winner: Team | null; reason: string; tScore: number; ctScore: number }
  | { type: 'chat:message'; msg: ChatMessage }
  | { type: 'buy:result'; ok: boolean; item: string; money: number; message?: string }
  | { type: 'error'; message: string };
