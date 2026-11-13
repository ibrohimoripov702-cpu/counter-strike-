import { useEffect } from 'react';
import { WEAPONS, type Team, type WeaponId } from '../shared/gameData.ts';

interface BuyMenuProps {
  money: number;
  team: Team;
  hasDefuseKit: boolean;
  armor: number;
  onBuy: (item: WeaponId | 'kevlar' | 'defuse_kit') => void;
  onClose: () => void;
}

export function BuyMenu({ money, team, hasDefuseKit, armor, onBuy, onClose }: BuyMenuProps) {
  const pistolDefault: WeaponId = team === 'T' ? 'glock' : 'usp';

  const items: Array<{
    key: string;
    id: WeaponId | 'kevlar' | 'defuse_kit';
    label: string;
    desc: string;
    price: number;
    disabled?: boolean;
  }> = [
    {
      key: '1',
      id: 'ak47',
      label: 'AK-47 Kalashnikov',
      desc: 'Yuqori zarar · 30/90 o‘q · Avtomat',
      price: WEAPONS.ak47.price,
    },
    {
      key: '2',
      id: 'm4a1',
      label: 'M4A1 Carbine',
      desc: 'Ovoz pasaytirgichli · 30/90 o‘q · Aniq',
      price: WEAPONS.m4a1.price,
    },
    {
      key: '3',
      id: 'awp',
      label: 'AWP Magnum Sniper',
      desc: '1 o‘qda yo‘q qiladi · 2 bosqichli optika',
      price: WEAPONS.awp.price,
    },
    {
      key: '4',
      id: 'deagle',
      label: 'Desert Eagle .50',
      desc: 'Og‘ir to‘pponcha · 7/35 o‘q · Boshga halokatli',
      price: WEAPONS.deagle.price,
    },
    {
      key: '5',
      id: pistolDefault,
      label: WEAPONS[pistolDefault].name,
      desc: 'Standart xizmat to‘pponchasi',
      price: 0,
    },
    {
      key: '6',
      id: 'kevlar',
      label: 'Kevlar + Shlem',
      desc: '100% zirh va bosh himoyasi',
      price: 1000,
      disabled: armor >= 100,
    },
  ];

  if (team === 'CT') {
    items.push({
      key: '7',
      id: 'defuse_kit',
      label: 'Zararsizlantirish to‘plami',
      desc: 'C4 bombani 4.5 soniyada yechadi',
      price: 400,
      disabled: hasDefuseKit,
    });
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      const match = items.find((it) => it.key === e.key);
      if (match && money >= match.price && !match.disabled) {
        onBuy(match.id);
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [money, armor, hasDefuseKit, team, onBuy, onClose]);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/65">
      <div className="w-full max-w-2xl bg-[#13171d] border border-white/15 rounded-sm p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-5">
          <div>
            <h2 className="font-display text-xl font-bold text-white tracking-wide">
              Qurol-yarog‘ do‘koni
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Sotib olish uchun qurolni tanlang · Yopish uchun B yoki Esc bosing
            </p>
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-400">Mavjud mablag‘</div>
            <div className="font-mono-num text-xl font-bold text-[#84cc16]">
              ${money.toLocaleString()}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {items.map((item) => {
            const affordable = money >= item.price && !item.disabled;
            return (
              <button
                key={item.id}
                onClick={() => {
                  if (affordable) {
                    onBuy(item.id);
                    onClose();
                  }
                }}
                disabled={!affordable}
                className={`text-left p-3.5 rounded-sm border transition-colors flex items-center justify-between gap-3 ${
                  affordable
                    ? 'bg-[#1a2028] border-white/10 hover:border-[#e59838] hover:bg-[#222933] cursor-pointer'
                    : 'bg-[#12151a] border-white/5 opacity-45 cursor-not-allowed'
                }`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono-num text-xs text-slate-400">[{item.key}]</span>
                    <span className="font-semibold text-sm text-white truncate">{item.label}</span>
                  </div>
                  <div className="text-xs text-slate-400 mt-1 truncate">{item.desc}</div>
                </div>
                <div className="font-mono-num text-sm font-bold text-[#e59838] shrink-0">
                  {item.disabled ? 'Mavjud' : item.price === 0 ? 'Bepul' : `$${item.price}`}
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-5 pt-4 border-t border-white/10 flex items-center justify-between">
          <span className="text-xs text-slate-400">
            1–4 raqamlari bilan qurol almashtiring · O‘ng tugma: AWP optikasi
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold bg-white/10 hover:bg-white/15 text-white rounded-sm transition-colors cursor-pointer"
          >
            O‘yinga qaytish
          </button>
        </div>
      </div>
    </div>
  );
}
