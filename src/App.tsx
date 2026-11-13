import { useCallback, useEffect, useRef, useState } from 'react';
import { LogOut, ShoppingBag, Volume2, VolumeX } from 'lucide-react';
import { WEAPONS, type GameMode, type Team, type WeaponId } from './shared/gameData.ts';
import type {
  ChatMessage,
  ClientToServerMsg,
  KillFeedItem,
  RoomStateSnapshot,
  ServerSummary,
  ServerToClientMsg,
} from './shared/protocol.ts';
import { ServerBrowser } from './components/ServerBrowser.tsx';
import { GameViewport, type LocalHudState } from './components/GameViewport.tsx';
import { TacticalRadar } from './components/TacticalRadar.tsx';
import { BuyMenu } from './components/BuyMenu.tsx';
import { ScoreboardModal } from './components/ScoreboardModal.tsx';
import { soundEngine } from './audio/soundEngine.ts';

function formatClock(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.max(0, sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function App() {
  const [screen, setScreen] = useState<'lobby' | 'game'>('lobby');
  const [connected, setConnected] = useState(false);
  const [servers, setServers] = useState<ServerSummary[]>([]);
  const [playerName, setPlayerName] = useState(() => localStorage.getItem('cs_nick') || 'Askar_UZ');
  const [selectedTeam, setSelectedTeam] = useState<Team | 'AUTO'>('AUTO');
  const [sensitivity, setSensitivity] = useState(1.2);
  const [muted, setMuted] = useState(false);

  const [snapshot, setSnapshot] = useState<RoomStateSnapshot | null>(null);
  const [yourId, setYourId] = useState<string | null>(null);
  const [killFeed, setKillFeed] = useState<KillFeedItem[]>([]);
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [buyMenuOpen, setBuyMenuOpen] = useState(false);
  const [scoreboardOpen, setScoreboardOpen] = useState(false);
  const [bannerText, setBannerText] = useState<string | null>(null);
  const [hud, setHud] = useState<LocalHudState>({
    weapon: 'glock',
    inventory: ['glock', 'knife'],
    ammoInMag: { glock: 20 },
    ammoReserve: { glock: 120 },
    reloading: false,
    scopeLevel: 0,
    plantProgress: 0,
    inBombSite: null,
    nearPlantedBomb: false,
    pointerLocked: false,
    crosshairSpread: 0,
    hitMarkerAt: 0,
    hitMarkerHeadshot: false,
    damageFlashAt: 0,
    localPos: { x: 0, y: 0, z: 46, yaw: 0 },
  });

  const wsRef = useRef<WebSocket | null>(null);
  const snapshotRef = useRef<RoomStateSnapshot | null>(null);
  const yourIdRef = useRef<string | null>(null);
  const pendingWeaponGrantRef = useRef<WeaponId | null>(null);
  const shotEventQueueRef = useRef<
    Array<{
      shooterId: string;
      weapon: WeaponId;
      origin: [number, number, number];
      endPoint: [number, number, number];
      hitPlayerId?: string;
      headshot?: boolean;
    }>
  >([]);
  const damageFlashQueueRef = useRef<number[]>([]);
  const bannerTimerRef = useRef<number | null>(null);

  const showBanner = useCallback((text: string, durationMs = 3600) => {
    setBannerText(text);
    if (bannerTimerRef.current) window.clearTimeout(bannerTimerRef.current);
    bannerTimerRef.current = window.setTimeout(() => setBannerText(null), durationMs);
  }, []);

  const sendWs = useCallback((msg: ClientToServerMsg) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('cs_nick', playerName);
  }, [playerName]);

  useEffect(() => {
    let disposed = false;
    let reconnectTimer = 0;

    function connect() {
      if (disposed) return;
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${proto}//${window.location.host}/ws`);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        ws.send(JSON.stringify({ type: 'servers:subscribe' } satisfies ClientToServerMsg));
      };

      ws.onmessage = (e) => {
        let msg: ServerToClientMsg;
        try {
          msg = JSON.parse(String(e.data)) as ServerToClientMsg;
        } catch {
          return;
        }

        if (msg.type === 'welcome' || msg.type === 'servers:list') {
          setServers(msg.servers);
        } else if (msg.type === 'room:joined') {
          yourIdRef.current = msg.yourId;
          snapshotRef.current = msg.snapshot;
          setYourId(msg.yourId);
          setSnapshot(msg.snapshot);
          setChat(msg.chat);
          setKillFeed(msg.killFeed);
          setScreen('game');
          setBuyMenuOpen(false);
          showBanner(`${msg.snapshot.serverName} — O‘yin boshlandi!`, 3000);
        } else if (msg.type === 'room:state') {
          snapshotRef.current = msg.snapshot;
          setSnapshot(msg.snapshot);
        } else if (msg.type === 'player:shot') {
          shotEventQueueRef.current.push(msg);
        } else if (msg.type === 'player:damaged') {
          if (msg.victimId === yourIdRef.current) {
            damageFlashQueueRef.current.push(Date.now());
          }
        } else if (msg.type === 'kill:event') {
          setKillFeed((prev) => [msg.item, ...prev].slice(0, 6));
        } else if (msg.type === 'bomb:event') {
          if (msg.event === 'planted') {
            showBanner(`C4 BOMBA ${msg.site} NUQTASIGA O‘RNATILDI!`, 4000);
          } else if (msg.event === 'defused') {
            showBanner(`${msg.by || 'CT'} C4 BOMBANI ZARARSIZLANTIRDI!`, 4000);
          } else if (msg.event === 'exploded') {
            soundEngine.playExplosion();
            showBanner('C4 BOMBA PORTLADI!', 4000);
          }
        } else if (msg.type === 'round:event') {
          showBanner(msg.reason, 4000);
        } else if (msg.type === 'chat:message') {
          setChat((prev) => [...prev.slice(-18), msg.msg]);
        } else if (msg.type === 'buy:result') {
          if (msg.ok && msg.item !== 'kevlar' && msg.item !== 'defuse_kit') {
            pendingWeaponGrantRef.current = msg.item as WeaponId;
            soundEngine.playClick(1050, 0.12);
          } else if (msg.ok) {
            soundEngine.playClick(1250, 0.12);
          }
        }
      };

      ws.onclose = () => {
        setConnected(false);
        if (!disposed) {
          reconnectTimer = window.setTimeout(connect, 1500);
        }
      };
    }

    connect();
    return () => {
      disposed = true;
      window.clearTimeout(reconnectTimer);
      wsRef.current?.close();
    };
  }, [showBanner]);

  const handleRefreshServers = async () => {
    try {
      const res = await fetch('/api/servers');
      const data = (await res.json()) as { servers: ServerSummary[] };
      if (Array.isArray(data.servers)) setServers(data.servers);
    } catch {
      sendWs({ type: 'servers:subscribe' });
    }
  };

  const handleCreateServer = async (opts: {
    name: string;
    mode: GameMode;
    maxPlayers: number;
    botsEnabled: boolean;
  }) => {
    const res = await fetch('/api/servers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(opts),
    });
    const data = (await res.json()) as { server?: ServerSummary };
    if (data.server) {
      await handleRefreshServers();
      handleJoinServer(data.server.id);
    }
  };

  const handleJoinServer = (serverId: string) => {
    soundEngine.unlock();
    sendWs({
      type: 'room:join',
      serverId,
      playerName: playerName.trim() || 'Askar_UZ',
      team: selectedTeam === 'AUTO' ? undefined : selectedTeam,
    });
  };

  const handleLeaveGame = () => {
    if (document.pointerLockElement) document.exitPointerLock?.();
    sendWs({ type: 'room:leave' });
    setScreen('lobby');
    setSnapshot(null);
    snapshotRef.current = null;
    handleRefreshServers();
  };

  const handleToggleMute = () => {
    const next = !muted;
    soundEngine.muted = next;
    setMuted(next);
  };

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (chatInput.trim()) {
      sendWs({ type: 'chat:send', text: chatInput.trim() });
    }
    setChatInput('');
    setChatOpen(false);
  };

  if (screen === 'lobby' || !snapshot) {
    return (
      <ServerBrowser
        servers={servers}
        playerName={playerName}
        onChangeName={setPlayerName}
        selectedTeam={selectedTeam}
        onChangeTeam={setSelectedTeam}
        sensitivity={sensitivity}
        onChangeSensitivity={setSensitivity}
        muted={muted}
        onToggleMute={handleToggleMute}
        onJoinServer={handleJoinServer}
        onCreateServer={handleCreateServer}
        onRefreshServers={handleRefreshServers}
        connected={connected}
      />
    );
  }

  const me = snapshot.players.find((p) => p.id === yourId);
  const myTeam: Team = me?.team || 'T';
  const curWeaponSpec = WEAPONS[hud.weapon];
  const curMag = hud.ammoInMag[hud.weapon] ?? 0;
  const curRes = hud.ammoReserve[hud.weapon] ?? 0;
  const nowMs = performance.now();
  const showHitMarker = nowMs - hud.hitMarkerAt < 180;
  const showDamageFlash = nowMs - hud.damageFlashAt < 260;

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#0e1114]">
      {/* 3D WebGL Viewport */}
      <GameViewport
        snapshotRef={snapshotRef}
        yourIdRef={yourIdRef}
        buyMenuOpen={buyMenuOpen}
        chatOpen={chatOpen}
        onToggleBuyMenu={() => setBuyMenuOpen((v) => !v)}
        onToggleScoreboard={setScoreboardOpen}
        onOpenChat={() => setChatOpen(true)}
        onHudSync={setHud}
        onSendMove={(x, y, z, yaw, pitch, crouching, weapon) =>
          sendWs({ type: 'player:move', x, y, z, yaw, pitch, crouching, weapon })
        }
        onSendShoot={(origin, dir, weapon) =>
          sendWs({ type: 'player:shoot', origin, dir, weapon })
        }
        onPlantStart={(site) => sendWs({ type: 'bomb:plant_start', site })}
        onPlantComplete={(site, x, y, z) =>
          sendWs({ type: 'bomb:plant_complete', site, x, y, z })
        }
        onDefuseToggle={(active) => sendWs({ type: 'bomb:defuse_progress', active })}
        pendingWeaponGrantRef={pendingWeaponGrantRef}
        shotEventQueueRef={shotEventQueueRef}
        damageFlashQueueRef={damageFlashQueueRef}
        sensitivity={sensitivity}
      />

      {/* AWP Sniper Scope Overlay */}
      {hud.scopeLevel > 0 && me?.alive && (
        <div className="pointer-events-none fixed inset-0 z-10 flex items-center justify-center">
          <div
            className="w-full h-full"
            style={{
              background:
                'radial-gradient(circle at center, transparent 31%, rgba(5,7,10,0.98) 32.5%)',
            }}
          />
          <div className="absolute inset-x-0 top-1/2 h-px bg-black/85" />
          <div className="absolute inset-y-0 left-1/2 w-px bg-black/85" />
          <div className="absolute w-2 h-2 rounded-full bg-red-600/90" />
          <div className="absolute bottom-24 text-xs font-mono-num text-white/75">
            AWP OPTIKA {hud.scopeLevel === 1 ? '2.5x' : '5.0x'}
          </div>
        </div>
      )}

      {/* Damage Flash Vignette */}
      {showDamageFlash && (
        <div
          className="pointer-events-none fixed inset-0 z-10"
          style={{
            boxShadow: 'inset 0 0 110px rgba(220, 38, 38, 0.72)',
          }}
        />
      )}

      {/* Dynamic Crosshair */}
      {hud.scopeLevel === 0 && me?.alive && !buyMenuOpen && (
        <div className="pointer-events-none fixed inset-0 z-10 flex items-center justify-center">
          <div className="relative w-12 h-12 flex items-center justify-center">
            <div
              className="absolute w-2.5 h-0.5 bg-[#4ade80]"
              style={{ transform: `translateX(-${7 + hud.crosshairSpread}px)` }}
            />
            <div
              className="absolute w-2.5 h-0.5 bg-[#4ade80]"
              style={{ transform: `translateX(${7 + hud.crosshairSpread}px)` }}
            />
            <div
              className="absolute w-0.5 h-2.5 bg-[#4ade80]"
              style={{ transform: `translateY(-${7 + hud.crosshairSpread}px)` }}
            />
            <div
              className="absolute w-0.5 h-2.5 bg-[#4ade80]"
              style={{ transform: `translateY(${7 + hud.crosshairSpread}px)` }}
            />
            {showHitMarker && (
              <div
                className={`text-sm font-bold ${
                  hud.hitMarkerHeadshot ? 'text-red-500 scale-125' : 'text-white'
                }`}
              >
                ✕
              </div>
            )}
          </div>
        </div>
      )}

      {/* Top-Left: Tactical Radar + Quick Controls */}
      <div className="fixed top-4 left-4 z-20 flex flex-col gap-2">
        <TacticalRadar
          localPos={hud.localPos}
          myTeam={myTeam}
          players={snapshot.players}
          myId={yourId || ''}
          bomb={snapshot.bomb}
        />
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setBuyMenuOpen(true)}
            className="px-2.5 py-1.5 text-xs font-semibold bg-[#0d1115]/90 hover:bg-[#1a212a] text-[#e59838] border border-white/15 rounded-sm flex items-center gap-1 cursor-pointer"
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            Do‘kon (B)
          </button>
          <button
            onClick={handleToggleMute}
            title="Ovoz"
            className="p-1.5 bg-[#0d1115]/90 hover:bg-[#1a212a] text-slate-200 border border-white/15 rounded-sm cursor-pointer"
          >
            {muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={handleLeaveGame}
            title="Serverdan chiqish"
            className="px-2 py-1.5 text-xs bg-[#0d1115]/90 hover:bg-red-950/80 text-slate-300 hover:text-white border border-white/15 rounded-sm flex items-center gap-1 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            Chiqish
          </button>
        </div>
      </div>

      {/* Top-Center: Score & Round Timer */}
      <div className="pointer-events-none fixed top-4 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-2">
        <div className="flex items-center bg-[#0d1115]/90 border border-white/15 rounded-sm overflow-hidden">
          <div className="px-4 py-1.5 flex items-center gap-2 border-r border-white/10">
            <span className="text-xs font-semibold text-[#e59838]">T</span>
            <span className="font-mono-num text-lg font-bold text-white">{snapshot.tScore}</span>
          </div>
          <div
            className={`px-5 py-1.5 font-mono-num text-lg font-bold ${
              snapshot.phase === 'BOMB_PLANTED' ? 'text-red-500' : 'text-white'
            }`}
          >
            {snapshot.phase === 'BOMB_PLANTED'
              ? `C4 ${Math.ceil(snapshot.bomb.timer)}s`
              : formatClock(snapshot.roundTimer)}
          </div>
          <div className="px-4 py-1.5 flex items-center gap-2 border-l border-white/10">
            <span className="font-mono-num text-lg font-bold text-white">{snapshot.ctScore}</span>
            <span className="text-xs font-semibold text-[#4ea8de]">CT</span>
          </div>
        </div>

        {snapshot.phase === 'FREEZETIME' && (
          <div className="px-4 py-1 bg-[#0d1115]/90 border border-[#e59838]/50 text-xs font-semibold text-[#e59838] rounded-sm">
            Tayyorlanish: {snapshot.roundTimer}s · Qurol olish uchun B bosing
          </div>
        )}

        {bannerText && (
          <div className="px-5 py-2 bg-[#0d1115]/95 border border-[#e59838]/60 text-sm font-display font-bold text-white rounded-sm shadow-lg">
            {bannerText}
          </div>
        )}
      </div>

      {/* Top-Right: Kill Feed */}
      <div className="pointer-events-none fixed top-4 right-4 z-20 flex flex-col items-end gap-1.5">
        {killFeed.map((item) => (
          <div
            key={item.id}
            className="px-3 py-1 bg-[#0d1115]/88 border border-white/10 rounded-sm text-xs flex items-center gap-2"
          >
            <span className={item.killerTeam === 'T' ? 'text-[#e59838] font-semibold' : 'text-[#4ea8de] font-semibold'}>
              {item.killerName}
            </span>
            <span className="text-slate-400">
              [{WEAPONS[item.weapon]?.name || item.weapon}
              {item.headshot ? ' · BOSH' : ''}]
            </span>
            <span className={item.victimTeam === 'T' ? 'text-[#e59838] font-semibold' : 'text-[#4ea8de] font-semibold'}>
              {item.victimName}
            </span>
          </div>
        ))}
      </div>

      {/* Center Bomb Plant / Defuse Prompt & Progress */}
      {me?.alive && snapshot.mode === 'bomb' && (
        <div className="pointer-events-none fixed bottom-36 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-2">
          {hud.plantProgress > 0 && (
            <div className="w-64 bg-[#0d1115]/95 border border-white/20 p-2.5 rounded-sm">
              <div className="text-xs font-semibold text-[#e59838] mb-1.5 text-center">
                C4 o‘rnatilmoqda ({hud.inBombSite} nuqtasi)...
              </div>
              <div className="w-full h-2 bg-white/10 rounded-sm overflow-hidden">
                <div
                  className="h-full bg-[#e59838]"
                  style={{ width: `${Math.round(hud.plantProgress * 100)}%` }}
                />
              </div>
            </div>
          )}

          {snapshot.bomb.state === 'PLANTED' && snapshot.bomb.defuserId === yourId && (
            <div className="w-64 bg-[#0d1115]/95 border border-[#4ea8de]/50 p-2.5 rounded-sm">
              <div className="text-xs font-semibold text-[#4ea8de] mb-1.5 text-center">
                C4 zararsizlantirilmoqda...
              </div>
              <div className="w-full h-2 bg-white/10 rounded-sm overflow-hidden">
                <div
                  className="h-full bg-[#4ea8de]"
                  style={{ width: `${Math.round(snapshot.bomb.defuseProgress * 100)}%` }}
                />
              </div>
            </div>
          )}

          {me.team === 'T' && me.hasBomb && hud.inBombSite && snapshot.phase === 'LIVE' && hud.plantProgress === 0 && (
            <div className="px-3.5 py-1.5 bg-[#0d1115]/90 border border-[#e59838]/50 text-xs font-semibold text-[#e59838] rounded-sm">
              {hud.inBombSite} nuqtasi — Bomba qo‘yish uchun E tugmasini bosib turing
            </div>
          )}

          {me.team === 'CT' && hud.nearPlantedBomb && snapshot.phase === 'BOMB_PLANTED' && snapshot.bomb.defuserId !== yourId && (
            <div className="px-3.5 py-1.5 bg-[#0d1115]/90 border border-[#4ea8de]/50 text-xs font-semibold text-[#4ea8de] rounded-sm">
              C4 topildi — Zararsizlantirish uchun E tugmasini bosib turing
            </div>
          )}
        </div>
      )}

      {/* Spectator / Dead notice */}
      {me && !me.alive && (
        <div className="pointer-events-none fixed top-24 left-1/2 -translate-x-1/2 z-20 px-4 py-1.5 bg-[#0d1115]/90 border border-white/15 text-xs text-slate-300 rounded-sm">
          {snapshot.mode === 'tdm'
            ? 'Halok bo‘ldingiz — 2.5 soniyadan so‘ng qayta tirilasiz'
            : 'Halok bo‘ldingiz — Jamoadoshingizni kuzatmoqdasiz'}
        </div>
      )}

      {/* Bottom-Left: Chat + HP & Armor */}
      <div className="fixed bottom-4 left-4 z-20 flex flex-col gap-2.5 max-w-sm">
        <div className="pointer-events-none flex flex-col gap-1 text-xs">
          {chat.slice(-5).map((m) => (
            <div key={m.id} className="px-2 py-0.5 bg-black/55 rounded-sm text-slate-200">
              <span
                className={
                  m.system
                    ? 'text-[#84cc16] font-semibold'
                    : m.team === 'T'
                    ? 'text-[#e59838] font-semibold'
                    : 'text-[#4ea8de] font-semibold'
                }
              >
                {m.sender}:{' '}
              </span>
              <span>{m.text}</span>
            </div>
          ))}
        </div>

        {chatOpen && (
          <form onSubmit={handleSendChat} className="flex gap-1.5">
            <input
              type="text"
              autoFocus
              maxLength={140}
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onBlur={() => setChatOpen(false)}
              placeholder="Xabar yozing..."
              className="w-64 px-3 py-1.5 text-xs bg-[#0d1115]/95 border border-[#e59838] text-white rounded-sm focus:outline-none"
            />
          </form>
        )}

        <div className="flex items-center gap-4 px-4 py-2.5 bg-[#0d1115]/90 border border-white/15 rounded-sm">
          <div>
            <div className="text-[10px] text-slate-400">JON (HP)</div>
            <div
              className={`font-mono-num text-2xl font-bold ${
                (me?.hp ?? 0) <= 25 ? 'text-red-500' : 'text-[#e59838]'
              }`}
            >
              {me?.hp ?? 0}
            </div>
          </div>
          <div className="h-8 w-px bg-white/10" />
          <div>
            <div className="text-[10px] text-slate-400">ZIRH</div>
            <div className="font-mono-num text-2xl font-bold text-[#e59838]">
              {me?.armor ?? 0}
            </div>
          </div>
          {me?.hasBomb && (
            <>
              <div className="h-8 w-px bg-white/10" />
              <div className="text-xs font-bold text-red-400">C4 SIZDA</div>
            </>
          )}
          {me?.hasDefuseKit && (
            <>
              <div className="h-8 w-px bg-white/10" />
              <div className="text-xs font-bold text-[#4ea8de]">DEFUSE</div>
            </>
          )}
        </div>
      </div>

      {/* Bottom-Center: Pointer Lock Hint */}
      {!hud.pointerLocked && !buyMenuOpen && !chatOpen && (
        <div className="pointer-events-none fixed bottom-4 left-1/2 -translate-x-1/2 z-20 px-4 py-1.5 bg-[#0d1115]/90 border border-white/15 rounded-sm text-xs text-slate-300 whitespace-nowrap">
          Nishon olish uchun ekranga bosing · B — Qurol do‘koni · E — Bomba · Tab — Natijalar
        </div>
      )}

      {/* Bottom-Right: Money, Ammo & Weapon Slots */}
      <div className="fixed bottom-4 right-4 z-20 flex flex-col items-end gap-2">
        <div className="flex items-center gap-1.5">
          {hud.inventory.map((wId, idx) => (
            <div
              key={wId}
              className={`px-2.5 py-1 text-xs font-mono-num rounded-sm border ${
                hud.weapon === wId
                  ? 'bg-[#e59838]/25 border-[#e59838] text-white font-bold'
                  : 'bg-[#0d1115]/85 border-white/10 text-slate-400'
              }`}
            >
              [{WEAPONS[wId]?.slot ?? idx + 1}] {WEAPONS[wId]?.name}
            </div>
          ))}
        </div>

        <div className="flex items-center gap-4 px-4 py-2.5 bg-[#0d1115]/90 border border-white/15 rounded-sm">
          <div className="text-right">
            <div className="text-[10px] text-slate-400">MABLAG‘</div>
            <div className="font-mono-num text-xl font-bold text-[#84cc16]">
              ${(me?.money ?? 0).toLocaleString()}
            </div>
          </div>
          <div className="h-8 w-px bg-white/10" />
          <div className="text-right min-w-[92px]">
            <div className="text-[10px] text-slate-400">
              {hud.reloading ? 'QAYTA O‘QLANMOQDA...' : curWeaponSpec?.name}
            </div>
            <div className="font-mono-num text-2xl font-bold text-[#e59838]">
              {curWeaponSpec && curWeaponSpec.magSize > 0 ? `${curMag} / ${curRes}` : '∞'}
            </div>
          </div>
        </div>
      </div>

      {/* Buy Menu Modal */}
      {buyMenuOpen && me && (
        <BuyMenu
          money={me.money}
          team={myTeam}
          hasDefuseKit={me.hasDefuseKit}
          armor={me.armor}
          onBuy={(item) => sendWs({ type: 'player:buy', item })}
          onClose={() => setBuyMenuOpen(false)}
        />
      )}

      {/* Tab Scoreboard */}
      {scoreboardOpen && <ScoreboardModal snapshot={snapshot} yourId={yourId} />}
    </div>
  );
}
