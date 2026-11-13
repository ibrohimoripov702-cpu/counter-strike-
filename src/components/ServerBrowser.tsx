import { useState } from 'react';
import { Crosshair, Plus, RefreshCw, Shield, Users, Volume2, VolumeX } from 'lucide-react';
import type { GameMode, Team } from '../shared/gameData.ts';
import type { ServerSummary } from '../shared/protocol.ts';

interface ServerBrowserProps {
  servers: ServerSummary[];
  playerName: string;
  onChangeName: (name: string) => void;
  selectedTeam: Team | 'AUTO';
  onChangeTeam: (t: Team | 'AUTO') => void;
  sensitivity: number;
  onChangeSensitivity: (s: number) => void;
  muted: boolean;
  onToggleMute: () => void;
  onJoinServer: (serverId: string) => void;
  onCreateServer: (opts: {
    name: string;
    mode: GameMode;
    maxPlayers: number;
    botsEnabled: boolean;
  }) => Promise<void>;
  onRefreshServers: () => void;
  connected: boolean;
}

export function ServerBrowser({
  servers,
  playerName,
  onChangeName,
  selectedTeam,
  onChangeTeam,
  sensitivity,
  onChangeSensitivity,
  muted,
  onToggleMute,
  onJoinServer,
  onCreateServer,
  onRefreshServers,
  connected,
}: ServerBrowserProps) {
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('Mening Dust2 Serverim');
  const [newMode, setNewMode] = useState<GameMode>('bomb');
  const [newMaxPlayers, setNewMaxPlayers] = useState(10);
  const [newBots, setNewBots] = useState(true);
  const [creating, setCreating] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || creating) return;
    setCreating(true);
    try {
      await onCreateServer({
        name: newName.trim(),
        mode: newMode,
        maxPlayers: newMaxPlayers,
        botsEnabled: newBots,
      });
      setShowCreate(false);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#0e1114] text-[#f1f3f5] flex flex-col overflow-y-auto">
      {/* 3-Zone Top Bar */}
      <header className="w-full border-b border-white/10 bg-[#12161b]">
        <div className="max-w-[1200px] mx-auto px-6 py-4 flex items-center justify-between gap-8">
          <a
            href="#top"
            className="font-display text-xl font-bold tracking-wide text-white whitespace-nowrap shrink-0"
          >
            Counter-Strike 1.6
          </a>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-400">
            <a href="#servers" className="hover:text-white transition-colors whitespace-nowrap shrink-0">
              Serverlar
            </a>
            <a href="#arsenal" className="hover:text-white transition-colors whitespace-nowrap shrink-0">
              Qurollar
            </a>
            <a href="#controls" className="hover:text-white transition-colors whitespace-nowrap shrink-0">
              Boshqaruv
            </a>
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => setShowCreate(true)}
              className="px-4 py-2 text-xs font-semibold bg-[#e59838] hover:bg-[#d68826] text-[#0e1114] rounded-sm transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Server yaratish
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-[1200px] w-full mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left 8 Columns: Server Browser */}
        <section id="servers" className="lg:col-span-8 flex flex-col gap-6">
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-white/10 pb-4">
            <div>
              <h1 className="font-display text-3xl font-bold text-white tracking-tight">
                Dust 2 Onlayn Serverlar
              </h1>
              <p className="text-sm text-slate-400 mt-1">
                de_dust2 xaritasi · Bomba o‘rnatish va jamoaviy janglar ·{' '}
                {connected ? 'Tarmoq faol' : 'Ulanmoqda...'}
              </p>
            </div>
            <button
              onClick={onRefreshServers}
              className="px-3.5 py-2 text-xs font-medium text-slate-200 bg-[#171c22] hover:bg-[#1f262e] border border-white/10 rounded-sm flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Yangilash
            </button>
          </div>

          {/* Server Table */}
          <div className="bg-[#13171d] border border-white/10 rounded-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-slate-400 border-b border-white/10 bg-[#171c22]">
                  <th className="text-left py-3 px-4 font-medium">Server nomi</th>
                  <th className="text-left py-3 px-3 font-medium">Rejim</th>
                  <th className="text-right py-3 px-3 font-medium">Hisob</th>
                  <th className="text-right py-3 px-3 font-medium">O‘yinchilar</th>
                  <th className="text-right py-3 px-4 font-medium">Harakat</th>
                </tr>
              </thead>
              <tbody>
                {servers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-slate-400 text-sm">
                      Serverlar yuklanmoqda...
                    </td>
                  </tr>
                ) : (
                  servers.map((srv) => (
                    <tr
                      key={srv.id}
                      className="border-b border-white/5 last:border-0 hover:bg-white/[0.03] transition-colors"
                    >
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-white">{srv.name}</div>
                        <div className="text-xs text-slate-400 mt-0.5">
                          {srv.map} · {srv.humans} jonli o‘yinchi ·{' '}
                          {srv.botsEnabled ? 'Botlar yoqilgan' : 'Faqat o‘yinchilar'}
                        </div>
                      </td>
                      <td className="py-3.5 px-3 text-xs text-slate-300">
                        {srv.mode === 'bomb' ? 'Bomba (C4)' : 'Jamoaviy Jang'}
                      </td>
                      <td className="py-3.5 px-3 text-right font-mono-num text-xs">
                        <span className="text-[#e59838]">{srv.tScore}</span>
                        <span className="text-slate-500 mx-1">:</span>
                        <span className="text-[#4ea8de]">{srv.ctScore}</span>
                      </td>
                      <td className="py-3.5 px-3 text-right font-mono-num text-xs text-slate-200">
                        {srv.players}/{srv.maxPlayers}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => onJoinServer(srv.id)}
                          className="px-4 py-1.5 text-xs font-semibold bg-[#222933] hover:bg-[#e59838] hover:text-[#0e1114] text-white border border-white/15 rounded-sm transition-colors whitespace-nowrap cursor-pointer"
                        >
                          Qo‘shilish
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Arsenal overview */}
          <div id="arsenal" className="pt-2">
            <h2 className="font-display text-lg font-bold text-white mb-3">
              Asosiy qurollar arsenali
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { name: 'AWP Sniper', info: '$4,750 · 2x optika', dmg: '115 zarar' },
                { name: 'AK-47', info: '$2,500 · Terrorist', dmg: '36 zarar' },
                { name: 'M4A1 Carbine', info: '$3,100 · Maxsus Kuchlar', dmg: '32 zarar' },
                { name: 'Desert Eagle', info: '$650 · .50 kalibr', dmg: '54 zarar' },
              ].map((w) => (
                <div
                  key={w.name}
                  className="bg-[#13171d] border border-white/10 rounded-sm p-3.5"
                >
                  <div className="font-semibold text-sm text-white">{w.name}</div>
                  <div className="text-xs text-slate-400 mt-1">{w.info}</div>
                  <div className="font-mono-num text-xs text-[#e59838] mt-1.5">{w.dmg}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Right 4 Columns: Player Settings & Controls */}
        <aside className="lg:col-span-4 flex flex-col gap-5">
          <div className="bg-[#13171d] border border-white/10 rounded-sm p-5 flex flex-col gap-4">
            <h2 className="font-display text-lg font-bold text-white">Askar sozlamalari</h2>

            <div>
              <label className="block text-xs text-slate-400 mb-1.5" htmlFor="player-callsign">
                O‘yinchi ismi
              </label>
              <input
                id="player-callsign"
                type="text"
                maxLength={20}
                value={playerName}
                onChange={(e) => onChangeName(e.target.value)}
                placeholder="Ismingizni kiriting"
                className="w-full px-3 py-2 text-sm bg-[#0e1114] border border-white/15 rounded-sm text-white focus:outline-none focus:border-[#e59838]"
              />
            </div>

            <div>
              <div className="text-xs text-slate-400 mb-1.5">Jamoani tanlang</div>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { id: 'AUTO' as const, label: 'Avto' },
                  { id: 'T' as const, label: 'Terrorist' },
                  { id: 'CT' as const, label: 'CT Kuchlar' },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => onChangeTeam(opt.id)}
                    className={`py-2 px-2 text-xs font-semibold rounded-sm border transition-colors cursor-pointer ${
                      selectedTeam === opt.id
                        ? opt.id === 'T'
                          ? 'bg-[#e59838]/20 border-[#e59838] text-[#e59838]'
                          : opt.id === 'CT'
                          ? 'bg-[#4ea8de]/20 border-[#4ea8de] text-[#4ea8de]'
                          : 'bg-white/15 border-white/40 text-white'
                        : 'bg-[#0e1114] border-white/10 text-slate-400 hover:text-white'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
                <span>Sichqoncha sezgirligi</span>
                <span className="font-mono-num text-white">{sensitivity.toFixed(1)}</span>
              </div>
              <input
                type="range"
                min="0.4"
                max="3.0"
                step="0.1"
                value={sensitivity}
                onChange={(e) => onChangeSensitivity(Number(e.target.value))}
                className="w-full accent-[#e59838]"
              />
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-white/10">
              <span className="text-xs text-slate-300">Ovoz effektlari</span>
              <button
                onClick={onToggleMute}
                className="px-3 py-1.5 text-xs bg-[#0e1114] border border-white/15 rounded-sm flex items-center gap-1.5 text-slate-200 hover:border-white/30 cursor-pointer"
              >
                {muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                {muted ? 'O‘chiq' : 'Yoqilgan'}
              </button>
            </div>

            {servers[0] && (
              <button
                onClick={() => onJoinServer(servers[0].id)}
                className="w-full py-2.5 text-sm font-bold bg-[#e59838] hover:bg-[#d68826] text-[#0e1114] rounded-sm transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <Crosshair className="w-4 h-4" />
                Tezkor o‘yinni boshlash
              </button>
            )}
          </div>

          <div id="controls" className="bg-[#13171d] border border-white/10 rounded-sm p-5">
            <h3 className="font-display text-sm font-bold text-white mb-3 flex items-center gap-2">
              <Shield className="w-4 h-4 text-[#e59838]" />
              Tugmalar qo‘llanmasi
            </h3>
            <dl className="grid grid-cols-2 gap-y-2 text-xs">
              <dt className="text-slate-400">Harakat</dt>
              <dd className="font-mono-num text-right text-slate-200">W A S D</dd>
              <dt className="text-slate-400">Otish / Nishon</dt>
              <dd className="font-mono-num text-right text-slate-200">Chap / O‘ng tugma</dd>
              <dt className="text-slate-400">Qurol do‘koni</dt>
              <dd className="font-mono-num text-right text-slate-200">B</dd>
              <dt className="text-slate-400">Bomba qo‘yish / yechish</dt>
              <dd className="font-mono-num text-right text-slate-200">E (bosib turing)</dd>
              <dt className="text-slate-400">Qayta o‘qlash</dt>
              <dd className="font-mono-num text-right text-slate-200">R</dd>
              <dt className="text-slate-400">Qurollar</dt>
              <dd className="font-mono-num text-right text-slate-200">1 · 2 · 3 · 4</dd>
              <dt className="text-slate-400">Sakrash / O‘tirish</dt>
              <dd className="font-mono-num text-right text-slate-200">Space / Ctrl</dd>
              <dt className="text-slate-400">Natijalar / Chat</dt>
              <dd className="font-mono-num text-right text-slate-200">Tab / Enter</dd>
            </dl>
          </div>
        </aside>
      </main>

      {/* Create Server Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <form
            onSubmit={handleCreate}
            className="w-full max-w-md bg-[#13171d] border border-white/15 rounded-sm p-6 flex flex-col gap-4"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="font-display text-lg font-bold text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-[#e59838]" />
                Yangi onlayn server yaratish
              </h3>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="text-xs text-slate-400 hover:text-white cursor-pointer"
              >
                Yopish
              </button>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Server nomi</label>
              <input
                type="text"
                maxLength={40}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                required
                className="w-full px-3 py-2 text-sm bg-[#0e1114] border border-white/15 rounded-sm text-white focus:outline-none focus:border-[#e59838]"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1.5">O‘yin rejimi</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setNewMode('bomb')}
                  className={`py-2 px-3 text-xs font-semibold rounded-sm border cursor-pointer ${
                    newMode === 'bomb'
                      ? 'bg-[#e59838]/20 border-[#e59838] text-[#e59838]'
                      : 'bg-[#0e1114] border-white/10 text-slate-300'
                  }`}
                >
                  Bomba O‘rnatish (C4)
                </button>
                <button
                  type="button"
                  onClick={() => setNewMode('tdm')}
                  className={`py-2 px-3 text-xs font-semibold rounded-sm border cursor-pointer ${
                    newMode === 'tdm'
                      ? 'bg-[#4ea8de]/20 border-[#4ea8de] text-[#4ea8de]'
                      : 'bg-[#0e1114] border-white/10 text-slate-300'
                  }`}
                >
                  Jamoaviy Jang (TDM)
                </button>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                <span>Maksimal o‘yinchilar</span>
                <span className="font-mono-num text-white">{newMaxPlayers}</span>
              </div>
              <input
                type="range"
                min="4"
                max="16"
                step="2"
                value={newMaxPlayers}
                onChange={(e) => setNewMaxPlayers(Number(e.target.value))}
                className="w-full accent-[#e59838]"
              />
            </div>

            <label className="flex items-center gap-2.5 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={newBots}
                onChange={(e) => setNewBots(e.target.checked)}
                className="accent-[#e59838]"
              />
              Bo‘sh o‘rinlarni aqlli botlar bilan to‘ldirish
            </label>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="px-4 py-2 text-xs text-slate-300 hover:text-white cursor-pointer"
              >
                Bekor qilish
              </button>
              <button
                type="submit"
                disabled={creating}
                className="px-4 py-2 text-xs font-bold bg-[#e59838] hover:bg-[#d68826] text-[#0e1114] rounded-sm transition-colors cursor-pointer"
              >
                {creating ? 'Yaratilmoqda...' : 'Serverni ochish'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
