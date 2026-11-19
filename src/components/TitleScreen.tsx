import { useEffect } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { soundEngine } from '../audio/soundEngine';
import { TITLE_KEY_ART_URL } from '../data/gameData';

interface TitleScreenProps {
  onStart: () => void;
  muted: boolean;
  onToggleMute: () => void;
}

export function TitleScreen({ onStart, muted, onToggleMute }: TitleScreenProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        soundEngine.unlock();
        soundEngine.playUiClick();
        onStart();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onStart]);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#06080C] select-none">
      {/* Photorealistic Military CG Key Art */}
      <img
        src={TITLE_KEY_ART_URL}
        alt="Zero Delta Photorealistic Military CG Extraction Key Art"
        referrerPolicy="no-referrer"
        className="absolute inset-0 w-full h-full object-cover object-center brightness-[0.88] contrast-[1.12] saturate-[0.86]"
      />

      {/* Dark Gritty Chiaroscuro Scrim & Film Vignette keeping right-side tactical squad crisp */}
      <div className="absolute inset-0 bg-gradient-to-r from-[#05070B] via-[#070A10]/86 to-transparent pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#05070B] via-transparent to-[#05070B]/55 pointer-events-none" />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(circle at 68% 48%, transparent 32%, rgba(4,6,10,0.72) 100%)' }}
      />

      {/* 2.39:1 Cutscene Letterbox Matte Bars */}
      <div className="absolute top-0 inset-x-0 h-5 bg-[#04060A] border-b border-white/5 z-10 pointer-events-none" />
      <div className="absolute bottom-0 inset-x-0 h-5 bg-[#04060A] border-t border-white/5 z-10 pointer-events-none" />

      {/* Top-Right Audio Toggle */}
      <div className="absolute top-8 right-6 z-20">
        <button
          onClick={() => {
            soundEngine.unlock();
            onToggleMute();
          }}
          className="flex items-center gap-2 px-3.5 py-2 rounded-sm bg-[#0D121B]/95 border border-slate-700/80 text-xs font-medium text-slate-200 hover:border-emerald-500/70 hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          {muted ? <VolumeX className="w-4 h-4 text-slate-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
          <span>{muted ? '音效已静音' : '战术音效开启'}</span>
        </button>
      </div>

      {/* Left-Third Title Lockup & CTA */}
      <div className="relative z-10 h-full flex flex-col justify-center px-10 md:px-20 max-w-2xl">
        {/* Bespoke Inline SVG Tactical Delta Emblem & Lockup */}
        <div className="mb-6 flex items-center gap-4">
          <svg width="56" height="56" viewBox="0 0 56 56" fill="none" aria-hidden="true" className="shrink-0">
            <polygon points="28,4 52,48 4,48" stroke="#10B981" strokeWidth="2.5" fill="rgba(16,185,129,0.12)" />
            <polygon points="28,14 43,42 13,42" stroke="#F59E0B" strokeWidth="1.5" fill="none" />
            <line x1="28" y1="22" x2="28" y2="38" stroke="#F8FAFC" strokeWidth="2" />
            <circle cx="28" cy="28" r="2.5" fill="#10B981" />
          </svg>
          <div>
            <div className="text-xs font-mono-tabular tracking-[0.22em] text-emerald-400 font-bold">
              G.T.I. SPECIAL OPERATIONS // ZERO DELTA
            </div>
            <div className="text-xs text-slate-400 mt-0.5">
              PBR 写实军事 CG · 秘密大坝与海外高危战区特种撤离
            </div>
          </div>
        </div>

        <h1 className="font-display text-5xl md:text-7xl font-extrabold tracking-tight text-white leading-[1.04] text-balance mb-4">
          零号八宝粥 · 秘密大坝
        </h1>

        <p className="text-slate-300 text-base md:text-lg leading-relaxed max-w-lg mb-8">
          PBR 影视级重装特种作战与硬核 20 枪械改枪台，空降高危封锁战区。自定义配备激光目标指示器、M18 战术烟幕弹与便携无线电信号干扰器等非致命军用装备，抢夺高价值情报锁入安全箱并强行突围。
        </p>

        <div className="flex items-center gap-4">
          <button
            onClick={() => {
              soundEngine.unlock();
              soundEngine.playUiClick();
              onStart();
            }}
            className="df-chamfer px-8 py-4 bg-[#00E59B] hover:bg-[#34F5B5] text-slate-950 font-extrabold text-base tracking-wider transition-colors shadow-lg shadow-emerald-950/50 whitespace-nowrap shrink-0 cursor-pointer"
          >
            进入烽火地带大厅
          </button>
          <span className="text-xs text-slate-400 font-mono-tabular">
            按 Enter 或 Space 立即开始
          </span>
        </div>

        {/* Single flat control-hint line */}
        <div className="mt-12 pt-5 border-t border-slate-800/80 text-xs text-slate-400 font-mono-tabular flex flex-wrap items-center gap-x-4 gap-y-1">
          <span>WASD 移动</span>
          <span aria-hidden="true">·</span>
          <span>左键射击 / 右键瞄准</span>
          <span aria-hidden="true">·</span>
          <span>Q / E / X 战术装备</span>
          <span aria-hidden="true">·</span>
          <span>F 搜刮</span>
          <span aria-hidden="true">·</span>
          <span>Tab 安全箱</span>
          <span aria-hidden="true">·</span>
          <span>Esc 暂停</span>
        </div>
      </div>
    </div>
  );
}
