import { Crosshair, Eye, RotateCcw, Settings, ShieldAlert, Sliders, Volume2, VolumeX, X } from 'lucide-react';
import { soundEngine } from '../audio/soundEngine';
import { DEFAULT_CONTROL_SETTINGS } from '../storage/settingsStore';
import { ControlTriggerMode, ScopeTier, TacticalControlSettings } from '../types/game';

interface TacticalSettingsModalProps {
  settings: TacticalControlSettings;
  onChange: (next: TacticalControlSettings) => void;
  onClose: () => void;
  muted: boolean;
  onToggleMute: () => void;
  inRaid?: boolean;
  activeScopeTier?: ScopeTier;
  onAbandonRaid?: () => void;
}

export function TacticalSettingsModal({
  settings,
  onChange,
  onClose,
  muted,
  onToggleMute,
  inRaid = false,
  activeScopeTier,
  onAbandonRaid,
}: TacticalSettingsModalProps) {
  const update = <K extends keyof TacticalControlSettings>(key: K, val: TacticalControlSettings[K]) => {
    onChange({ ...settings, [key]: val });
  };

  const renderModeToggle = (
    current: ControlTriggerMode,
    onSelect: (mode: ControlTriggerMode) => void,
    holdLabel: string,
    toggleLabel: string
  ) => (
    <div className="grid grid-cols-2 gap-1.5">
      {(
        [
          { id: 'hold', label: holdLabel },
          { id: 'toggle', label: toggleLabel },
        ] as const
      ).map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => {
            soundEngine.playUiClick();
            onSelect(opt.id);
          }}
          className={`px-3 py-1.5 text-xs font-semibold border transition-colors cursor-pointer whitespace-nowrap ${
            current === opt.id
              ? 'bg-[#00E59B] border-[#00E59B] text-slate-950 font-bold'
              : 'bg-[#090D16] border-slate-700/80 text-slate-300 hover:border-slate-500 hover:text-white'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );

  const renderSlider = (opts: {
    label: string;
    value: number;
    min: number;
    max: number;
    step: number;
    display: string;
    highlight?: boolean;
    hint?: string;
    onInput: (v: number) => void;
  }) => (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs gap-2">
        <span className="text-slate-200 font-medium flex items-center gap-2 min-w-0">
          <span className="truncate">{opts.label}</span>
          {opts.highlight && (
            <span className="text-[10px] font-mono-tabular text-[#00E59B] font-bold shrink-0">
              当前装配
            </span>
          )}
        </span>
        <span className="font-mono-tabular font-bold text-white shrink-0">{opts.display}</span>
      </div>
      <input
        type="range"
        min={opts.min}
        max={opts.max}
        step={opts.step}
        value={opts.value}
        onChange={(e) => opts.onInput(parseFloat(e.target.value))}
        className="w-full h-1.5 bg-slate-800 accent-[#00E59B] cursor-pointer"
      />
      {opts.hint && <div className="text-[10px] text-slate-400">{opts.hint}</div>}
    </div>
  );

  return (
    <div
      className={`absolute inset-0 z-40 flex items-center justify-center p-4 sm:p-6 ${
        inRaid ? 'bg-[#060911]/55' : 'bg-[#060911]/80'
      }`}
    >
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col bg-[#0F1623]/96 border border-slate-700 df-chamfer shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0 flex-wrap">
            <Settings className="w-4 h-4 text-[#00E59B] shrink-0" />
            <h2 className="text-sm sm:text-base font-bold text-white whitespace-nowrap">
              战术操控与视角设置
            </h2>
            {inRaid && (
              <span className="text-[11px] font-mono-tabular text-amber-300 font-semibold">
                实时战区 · 游戏不可暂停，调参时敌人仍在移动
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              soundEngine.playUiClick();
              onClose();
            }}
            aria-label="关闭设置"
            className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 cursor-pointer shrink-0 whitespace-nowrap"
          >
            <X className="w-3.5 h-3.5" />
            <span>{inRaid ? '返回战斗 (Esc)' : '关闭'}</span>
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-5 overflow-y-auto space-y-5">
          {/* Section 1: 探头与开镜操作 */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-[#00E59B] tracking-wide border-b border-slate-800/90 pb-1.5">
              <Crosshair className="w-3.5 h-3.5" />
              <span>探头与开镜操作模式</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Lean / Peek Settings */}
              <div className="p-3.5 bg-[#0A0F1A] border border-slate-800 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-xs font-bold text-white">侧身探头（[Z] 左 / [C] 右）</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      掩体边缘侧身倾斜视角与枪口，也支持鼠标侧键
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playUiClick();
                      update('leanEnabled', !settings.leanEnabled);
                    }}
                    className={`px-2.5 py-1 text-[11px] font-bold border cursor-pointer shrink-0 ${
                      settings.leanEnabled
                        ? 'bg-[#102922] border-[#00E59B] text-[#00E59B]'
                        : 'bg-[#090D15] border-slate-700 text-slate-400'
                    }`}
                  >
                    {settings.leanEnabled ? '已启用' : '已关闭'}
                  </button>
                </div>

                {settings.leanEnabled && (
                  <>
                    <div className="space-y-1.5">
                      <div className="text-[11px] text-slate-300">探头触发方式</div>
                      {renderModeToggle(
                        settings.leanMode,
                        (m) => update('leanMode', m),
                        '长按探头（松开回正）',
                        '点击切换（再按回正）'
                      )}
                    </div>
                    {renderSlider({
                      label: '探头侧移与倾角幅度',
                      value: settings.leanIntensity,
                      min: 0.6,
                      max: 1.4,
                      step: 0.05,
                      display: `${Math.round(settings.leanIntensity * 100)}%`,
                      onInput: (v) => update('leanIntensity', v),
                    })}
                  </>
                )}
              </div>

              {/* ADS Mode */}
              <div className="p-3.5 bg-[#0A0F1A] border border-slate-800 space-y-3 flex flex-col justify-between">
                <div className="space-y-2.5">
                  <div>
                    <div className="text-xs font-bold text-white">右键开镜方式（ADS）</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      第一人称与第三人称精准瞄准通用，修改后实时生效
                    </div>
                  </div>
                  {renderModeToggle(
                    settings.adsMode,
                    (m) => update('adsMode', m),
                    '长按右键开镜',
                    '点击右键切换开镜'
                  )}
                </div>

                <div className="pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 leading-relaxed">
                  提示：点击切换模式下，再次点击右键、换弹或进入冲刺时会自动收镜，方便近距离快速转火。
                </div>
              </div>
            </div>
          </section>

          {/* Section 2: 镜头与不同倍镜灵敏度 */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-sky-400 tracking-wide border-b border-slate-800/90 pb-1.5">
              <Sliders className="w-3.5 h-3.5" />
              <span>镜头与各倍镜独立灵敏度</span>
            </div>

            <div className="p-3.5 bg-[#0A0F1A] border border-slate-800 space-y-3.5">
              {renderSlider({
                label: '全局基础转向灵敏度',
                value: settings.baseSensitivity,
                min: 0.3,
                max: 2.5,
                step: 0.05,
                display: `${settings.baseSensitivity.toFixed(2)}×`,
                hint: '控制第一人称整体鼠标转向速率，并与下方各倍镜倍率叠加生效',
                onInput: (v) => update('baseSensitivity', v),
              })}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3.5 pt-2 border-t border-slate-800/80">
                {renderSlider({
                  label: '腰射 / 机械瞄具灵敏度',
                  value: settings.ironSensitivity,
                  min: 0.3,
                  max: 2.0,
                  step: 0.05,
                  display: `${Math.round(settings.ironSensitivity * 100)}%`,
                  highlight: activeScopeTier === 'iron',
                  onInput: (v) => update('ironSensitivity', v),
                })}
                {renderSlider({
                  label: '1x 红点 / 全息倍镜灵敏度',
                  value: settings.scope1xSensitivity,
                  min: 0.25,
                  max: 2.0,
                  step: 0.05,
                  display: `${Math.round(settings.scope1xSensitivity * 100)}%`,
                  highlight: activeScopeTier === '1x',
                  onInput: (v) => update('scope1xSensitivity', v),
                })}
                {renderSlider({
                  label: '4x ACOG 中倍镜灵敏度',
                  value: settings.scope4xSensitivity,
                  min: 0.2,
                  max: 1.8,
                  step: 0.05,
                  display: `${Math.round(settings.scope4xSensitivity * 100)}%`,
                  highlight: activeScopeTier === '4x',
                  onInput: (v) => update('scope4xSensitivity', v),
                })}
                {renderSlider({
                  label: '8x 高倍狙击镜灵敏度',
                  value: settings.scope8xSensitivity,
                  min: 0.15,
                  max: 1.6,
                  step: 0.05,
                  display: `${Math.round(settings.scope8xSensitivity * 100)}%`,
                  highlight: activeScopeTier === '8x',
                  onInput: (v) => update('scope8xSensitivity', v),
                })}
              </div>
            </div>
          </section>

          {/* Section 3: 视角大小调节 (FOV & Third-Person View Scale) */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-400 tracking-wide border-b border-slate-800/90 pb-1.5">
              <Eye className="w-3.5 h-3.5" />
              <span>视角大小与视距调节</span>
            </div>

            <div className="p-3.5 bg-[#0A0F1A] border border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3.5">
              {renderSlider({
                label: '第一人称视角大小（FOV）',
                value: settings.fpFov,
                min: 60,
                max: 110,
                step: 1,
                display: `${Math.round(settings.fpFov)}°`,
                hint: '数值越大视野越广，数值越小目标更大更易锁头',
                onInput: (v) => update('fpFov', v),
              })}
              {renderSlider({
                label: '第三人称默认视距缩放',
                value: settings.tpZoom,
                min: 0.7,
                max: 1.45,
                step: 0.05,
                display: `${settings.tpZoom.toFixed(2)}×`,
                hint: '调节第三人称镜头拉近/拉远，战斗中也可用鼠标滚轮微调',
                onInput: (v) => update('tpZoom', v),
              })}
            </div>
          </section>
        </div>

        {/* Footer Controls */}
        <div className="px-5 py-3.5 border-t border-slate-800 bg-[#0B101A] flex items-center justify-between gap-3 flex-wrap shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                soundEngine.playUiClick();
                onChange({ ...DEFAULT_CONTROL_SETTINGS });
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#121A28] hover:bg-[#1A2538] border border-slate-700 text-xs text-slate-300 cursor-pointer whitespace-nowrap"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>恢复默认</span>
            </button>
            <button
              type="button"
              onClick={() => {
                soundEngine.unlock();
                onToggleMute();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#121A28] hover:bg-[#1A2538] border border-slate-700 text-xs text-slate-200 cursor-pointer whitespace-nowrap"
            >
              {muted ? (
                <>
                  <VolumeX className="w-3.5 h-3.5 text-slate-400" />
                  <span>已静音</span>
                </>
              ) : (
                <>
                  <Volume2 className="w-3.5 h-3.5 text-[#00E59B]" />
                  <span>音效开启</span>
                </>
              )}
            </button>
          </div>

          <div className="flex items-center gap-2">
            {inRaid && onAbandonRaid && (
              <button
                type="button"
                onClick={() => {
                  soundEngine.playUiClick();
                  onAbandonRaid();
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-950/85 hover:bg-rose-900 border border-rose-500/50 text-xs font-medium text-rose-200 cursor-pointer whitespace-nowrap"
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>放弃行动并结算安全箱</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                soundEngine.playUiClick();
                onClose();
              }}
              className="px-4 py-1.5 bg-[#00E59B] hover:bg-[#34F5B5] text-slate-950 font-bold text-xs cursor-pointer whitespace-nowrap"
            >
              {inRaid ? '继续战斗' : '保存并关闭'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
