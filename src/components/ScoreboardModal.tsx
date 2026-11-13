import type { NetPlayer, RoomStateSnapshot } from '../shared/protocol.ts';
import { WEAPONS } from '../shared/gameData.ts';

interface ScoreboardModalProps {
  snapshot: RoomStateSnapshot;
  yourId: string | null;
}

function TeamTable({
  title,
  accentClass,
  players,
  yourId,
  score,
}: {
  title: string;
  accentClass: string;
  players: NetPlayer[];
  yourId: string | null;
  score: number;
}) {
  const sorted = [...players].sort((a, b) => b.kills - a.kills || a.deaths - b.deaths);

  return (
    <div className="bg-[#12161c] border border-white/10 rounded-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 bg-white/5 border-b border-white/10">
        <span className={`font-display font-bold text-sm tracking-wide ${accentClass}`}>
          {title}
        </span>
        <span className="font-mono-num text-sm font-bold text-white">
          Ochko: {score}
        </span>
      </div>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-slate-400 border-b border-white/10">
            <th className="text-left py-2 px-4 font-medium">O‘yinchi</th>
            <th className="text-left py-2 px-2 font-medium">Qurol</th>
            <th className="text-right py-2 px-2 font-medium">Pul</th>
            <th className="text-right py-2 px-2 font-medium">O‘ldirish</th>
            <th className="text-right py-2 px-4 font-medium">O‘lim</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((p) => {
            const isMe = p.id === yourId;
            return (
              <tr
                key={p.id}
                className={`border-b border-white/5 last:border-0 ${
                  isMe ? 'bg-white/10 text-white' : p.alive ? 'text-slate-200' : 'text-slate-500'
                }`}
              >
                <td className="py-2 px-4 font-medium truncate max-w-[170px]">
                  {p.name}
                  {p.hasBomb ? ' · C4' : ''}
                  {!p.alive ? ' (Halok)' : ''}
                </td>
                <td className="py-2 px-2 text-slate-400">
                  {WEAPONS[p.weapon]?.name || p.weapon}
                </td>
                <td className="py-2 px-2 text-right font-mono-num text-[#84cc16]">
                  ${p.money}
                </td>
                <td className="py-2 px-2 text-right font-mono-num font-semibold">
                  {p.kills}
                </td>
                <td className="py-2 px-4 text-right font-mono-num">
                  {p.deaths}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function ScoreboardModal({ snapshot, yourId }: ScoreboardModalProps) {
  const tPlayers = snapshot.players.filter((p) => p.team === 'T');
  const ctPlayers = snapshot.players.filter((p) => p.team === 'CT');

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/55 pointer-events-none">
      <div className="w-full max-w-4xl bg-[#0e1116]/95 border border-white/15 rounded-sm p-5 shadow-2xl">
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-white/10">
          <div>
            <h3 className="font-display text-lg font-bold text-white">{snapshot.serverName}</h3>
            <p className="text-xs text-slate-400">
              de_dust2 · {snapshot.mode === 'bomb' ? 'Bomba O‘rnatish' : 'Jamoaviy Jang'} · Raund #{snapshot.roundNumber}
            </p>
          </div>
          <div className="font-mono-num text-sm text-slate-300">
            T {snapshot.tScore} : {snapshot.ctScore} CT
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <TeamTable
            title="Terroristlar (T)"
            accentClass="text-[#e59838]"
            players={tPlayers}
            yourId={yourId}
            score={snapshot.tScore}
          />
          <TeamTable
            title="Maxsus Kuchlar (CT)"
            accentClass="text-[#4ea8de]"
            players={ctPlayers}
            yourId={yourId}
            score={snapshot.ctScore}
          />
        </div>
      </div>
    </div>
  );
}
