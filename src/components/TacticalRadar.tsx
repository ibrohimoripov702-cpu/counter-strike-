import { BOMBSITES, MAP_BLOCKS, type Team } from '../shared/gameData.ts';
import type { BombState, NetPlayer } from '../shared/protocol.ts';

interface TacticalRadarProps {
  localPos: { x: number; z: number; yaw: number };
  myTeam: Team;
  players: NetPlayer[];
  myId: string;
  bomb: BombState;
}

const WORLD_SPAN = 112; // -56..+56

function toRadar(v: number): number {
  return ((v + 56) / WORLD_SPAN) * 100;
}

export function TacticalRadar({ localPos, myTeam, players, myId, bomb }: TacticalRadarProps) {
  const myX = toRadar(localPos.x);
  const myY = toRadar(localPos.z);
  const yawDeg = (-localPos.yaw * 180) / Math.PI;

  return (
    <div className="w-40 h-40 bg-[#0d1115]/90 border border-white/15 rounded-sm relative overflow-hidden shadow-lg">
      <svg viewBox="0 0 100 100" className="w-full h-full">
        {/* Background */}
        <rect x="0" y="0" width="100" height="100" fill="#171b20" />

        {/* Dust 2 structures */}
        {MAP_BLOCKS.map((blk) => {
          if (blk.id === 'b-tunnel-roof' || blk.id === 'ct-bridge-top') return null;
          const x = toRadar(blk.x - blk.w / 2);
          const y = toRadar(blk.z - blk.d / 2);
          const w = (blk.w / WORLD_SPAN) * 100;
          const h = (blk.d / WORLD_SPAN) * 100;
          const fill = blk.walkable ? '#3a342a' : '#706350';
          return <rect key={blk.id} x={x} y={y} width={w} height={h} fill={fill} opacity={0.85} />;
        })}

        {/* Bombsite labels */}
        <text
          x={toRadar(BOMBSITES.A.x)}
          y={toRadar(BOMBSITES.A.z)}
          fill="#ef4444"
          fontSize="8"
          fontWeight="bold"
          textAnchor="middle"
          dominantBaseline="central"
        >
          A
        </text>
        <text
          x={toRadar(BOMBSITES.B.x)}
          y={toRadar(BOMBSITES.B.z)}
          fill="#ef4444"
          fontSize="8"
          fontWeight="bold"
          textAnchor="middle"
          dominantBaseline="central"
        >
          B
        </text>

        {/* Teammates */}
        {players.map((p) => {
          if (!p.alive || p.id === myId || p.team !== myTeam) return null;
          return (
            <circle
              key={p.id}
              cx={toRadar(p.x)}
              cy={toRadar(p.z)}
              r="2.2"
              fill={myTeam === 'T' ? '#e59838' : '#4ea8de'}
            />
          );
        })}

        {/* Bomb marker */}
        {(bomb.state === 'PLANTED' || bomb.state === 'DROPPED' || (bomb.state === 'CARRIED' && myTeam === 'T')) && (
          <rect
            x={toRadar(bomb.x) - 2}
            y={toRadar(bomb.z) - 2}
            width="4"
            height="4"
            fill={bomb.state === 'PLANTED' ? '#ef4444' : '#facc15'}
          />
        )}

        {/* Local player arrow */}
        <g transform={`translate(${myX}, ${myY}) rotate(${yawDeg})`}>
          <polygon points="0,-4 2.8,3 -2.8,3" fill="#4ade80" />
        </g>
      </svg>

      <div className="absolute bottom-1 left-1.5 text-[10px] font-mono-num text-white/65 tracking-tight">
        de_dust2
      </div>
    </div>
  );
}
