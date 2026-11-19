import { Award, ShieldCheck, Skull, Trophy, Wrench } from 'lucide-react';
import { soundEngine } from '../audio/soundEngine';
import {
  MAPS,
  OPERATORS,
  RARITY_CONFIG,
  WEAPONS,
  formatWeightKg,
  getItemWeight,
  getWeaponJamRiskInfo,
} from '../data/gameData';
import { getMissionProgressSummary } from '../storage/profileStore';
import { PlayerProfile, RaidOutcome } from '../types/game';

interface RaidSummaryModalProps {
  outcome: RaidOutcome;
  profile: PlayerProfile;
  onReturnBase: () => void;
  onRedeploy: () => void;
}

export function RaidSummaryModal({ outcome, profile, onReturnBase, onRedeploy }: RaidSummaryModalProps) {
  const missionSummary = getMissionProgressSummary(profile);
  const op = OPERATORS[outcome.operatorId];
  const mapDef = MAPS[outcome.mapId || 'zero_dam'] || MAPS.zero_dam;
  const keptItems = outcome.extracted
    ? [...outcome.safeBoxLoot, ...outcome.backpackLoot]
    : [...outcome.safeBoxLoot];

  const mins = Math.floor(outcome.durationSec / 60);
  const secs = Math.floor(outcome.durationSec % 60);
  const lostBackpackValue =
    outcome.lostBackpackValue ??
    (outcome.extracted ? 0 : outcome.backpackLoot.reduce((sum, item) => sum + item.value, 0));
  const lostBackpackCount = outcome.lostBackpackCount ?? (outcome.extracted ? 0 : outcome.backpackLoot.length);
  const assetLossPenalty = outcome.assetLossPenalty ?? (outcome.extracted ? 0 : outcome.lostLoadoutValue);
  const totalAssetLoss = lostBackpackValue + assetLossPenalty;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#060911]/92 p-6 overflow-y-auto">
      <div className="w-full max-w-3xl bg-[#131A26] border border-slate-700/80 rounded-lg overflow-hidden shadow-2xl">
        {/* Header Banner */}
        <div
          className={`px-8 py-6 border-b border-slate-800 flex items-center justify-between gap-4 ${
            outcome.extracted ? 'bg-emerald-950/30' : 'bg-rose-950/35'
          }`}
        >
          <div className="flex items-center gap-4">
            <div
              className={`w-12 h-12 rounded-md flex items-center justify-center shrink-0 ${
                outcome.extracted ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
              }`}
            >
              {outcome.extracted ? <Trophy className="w-6 h-6" /> : <Skull className="w-6 h-6" />}
            </div>
            <div>
              <h2 className="font-display text-3xl font-extrabold tracking-wide text-white">
                {outcome.extracted ? '撤离成功 · MISSION EXTRACTED' : '撤离失败 · 资产受损'}
              </h2>
              <p className="text-sm text-slate-300 mt-0.5">{outcome.reason}</p>
            </div>
          </div>

          <div className="text-right shrink-0">
            {outcome.extracted ? (
              <>
                <div className="text-xs text-slate-400">带出资产总值</div>
                <div className="text-2xl font-mono-tabular font-bold text-amber-400">
                  +{outcome.totalExtractedValue.toLocaleString()} 哈夫币
                </div>
              </>
            ) : (
              <>
                <div className="text-xs text-rose-300">本次行动资产丢失总计</div>
                <div className="text-2xl font-mono-tabular font-bold text-rose-400">
                  -{totalAssetLoss.toLocaleString()} 哈夫币
                </div>
                {outcome.totalExtractedValue > 0 && (
                  <div className="text-[11px] font-mono-tabular text-amber-300 mt-0.5">
                    安全箱保底 +{outcome.totalExtractedValue.toLocaleString()} 哈夫币
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Combat Telemetry Strip */}
        <div className="grid grid-cols-4 border-b border-slate-800 divide-x divide-slate-800 bg-[#0F1520]">
          <div className="px-6 py-4">
            <div className="text-xs text-slate-400">出战干员 · {mapDef.name}</div>
            <div className="text-base font-semibold text-white mt-1">{op.name}</div>
          </div>
          <div className="px-6 py-4">
            <div className="text-xs text-slate-400">行动耗时（限时 20:00）</div>
            <div className="text-base font-mono-tabular font-semibold text-white mt-1">
              {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
            </div>
          </div>
          <div className="px-6 py-4">
            <div className="text-xs text-slate-400">消灭敌军</div>
            <div className="text-base font-mono-tabular font-semibold text-white mt-1">
              {outcome.kills} 名 {outcome.bossKilled ? `(含首领${mapDef.bossName.split(' · ')[0]})` : ''}
            </div>
          </div>
          <div className="px-6 py-4">
            <div className="text-xs text-slate-400">{outcome.extracted ? '撤离电闸状态' : '资产扣除惩罚'}</div>
            <div
              className={`text-base font-mono-tabular font-semibold mt-1 ${
                outcome.extracted ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {outcome.extracted
                ? '已拉闸 · 坚守 03:00'
                : `-${assetLossPenalty.toLocaleString()} 哈夫币`}
            </div>
          </div>
        </div>

        {/* Secured Loot List */}
        <div className="p-6">
          {!outcome.extracted && (
            <div className="mb-4 p-3.5 rounded-md bg-rose-950/35 border border-rose-500/45 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2 text-rose-200 font-bold mb-1.5">
                <span>
                  资产丢失明细（{outcome.leverPulled ? '已拉闸但未能完成 03:00 撤离坚守' : '未完成拉闸与撤离'}）
                </span>
                <span className="font-mono-tabular text-rose-300">
                  总损失 -{totalAssetLoss.toLocaleString()} 哈夫币
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] font-mono-tabular text-rose-100/90">
                <div className="bg-[#180C12] border border-rose-500/30 rounded px-2.5 py-1.5">
                  背包物资全部遗失：{lostBackpackCount} 件（-{lostBackpackValue.toLocaleString()} 哈夫币）
                </div>
                <div className="bg-[#180C12] border border-rose-500/30 rounded px-2.5 py-1.5">
                  战备与资产账户扣除：-{assetLossPenalty.toLocaleString()} 哈夫币
                </div>
                <div className="bg-[#180C12] border border-rose-500/30 rounded px-2.5 py-1.5">
                  主武器战损打捞：额外扣除 -12% 耐久
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>
                {outcome.extracted
                  ? `安全带出战利品（${keptItems.length} 件已自动存入基地仓库）`
                  : `安全箱紧急保底物资（${keptItems.length} 件已保留至仓库，背包物资全部遗失）`}
              </span>
            </div>
          </div>

          {keptItems.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-500 border border-dashed border-slate-800 rounded-md">
              本次行动未带出任何物资
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-56 overflow-y-auto pr-1">
              {keptItems.map((item) => {
                const cfg = RARITY_CONFIG[item.rarity];
                const isSafe = outcome.safeBoxLoot.some((s) => s.uid === item.uid);
                const itemWeight = getItemWeight(item.templateId, item.weight);
                return (
                  <div
                    key={item.uid}
                    style={{ borderColor: cfg.border, backgroundColor: cfg.bg }}
                    className="p-3 rounded-md border flex flex-col justify-between"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-white truncate">{item.name}</span>
                      {isSafe && (
                        <span className="text-[11px] font-mono-tabular text-amber-300 shrink-0">安全箱</span>
                      )}
                    </div>
                    <div className="flex items-center justify-between mt-2 text-xs">
                      <span style={{ color: cfg.color }}>
                        {cfg.label} · {formatWeightKg(itemWeight)}
                      </span>
                      <span className="font-mono-tabular text-slate-200">{item.value.toLocaleString()}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Weapon Wear & Mission Progress Telemetry Strip */}
          {typeof outcome.endingWeaponDurability === 'number' && outcome.weaponId && (
            <div className="mt-4 p-3 rounded-md bg-[#0E1520] border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
              {(() => {
                const wName = WEAPONS[outcome.weaponId!]?.name || '主武器';
                const risk = getWeaponJamRiskInfo(outcome.endingWeaponDurability!);
                return (
                  <>
                    <div className="flex items-center gap-2 text-slate-200">
                      <Wrench className="w-4 h-4 shrink-0" style={{ color: risk.color }} />
                      <span>
                        战后枪械工况 · <strong className="text-white">{wName}</strong> 剩余耐久{' '}
                        <strong className="font-mono-tabular" style={{ color: risk.color }}>
                          {outcome.endingWeaponDurability!.toFixed(1)}%
                        </strong>
                        {outcome.jamsExperienced ? (
                          <span className="text-rose-400 font-mono-tabular ml-2">
                            (本局卡壳 {outcome.jamsExperienced} 次)
                          </span>
                        ) : null}
                      </span>
                    </div>
                    <div className="font-mono-tabular text-xs" style={{ color: risk.color }}>
                      {outcome.endingWeaponDurability! < 80
                        ? '建议前往「武器修复工作台」使用零件维修以防下次卡壳'
                        : risk.label}
                    </div>
                  </>
                );
              })()}
            </div>
          )}

          <div className="mt-3 p-3 rounded-md bg-[#0E1520] border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-slate-200">
              <Award className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                特勤处行动任务总进度：已完成{' '}
                <strong className="font-mono-tabular text-[#00E59B]">
                  {missionSummary.completedCount}/{missionSummary.totalMissions}
                </strong>{' '}
                项
              </span>
            </div>
            <div className="font-mono-tabular text-slate-300">
              {missionSummary.claimableCount > 0 ? (
                <span className="text-[#00E59B] font-bold">
                  {missionSummary.claimableCount} 项任务可返回基地领取战术勋章与哈夫币奖金
                </span>
              ) : (
                <span className="text-slate-400">
                  已获战术勋章 {missionSummary.totalMedals} 枚 · 返回基地可查看实时进度
                </span>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="mt-5 pt-5 border-t border-slate-800 flex items-center justify-end gap-3">
            <button
              onClick={() => {
                soundEngine.playUiClick();
                onReturnBase();
              }}
              className="px-5 py-2.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              返回战备基地
            </button>
            <button
              onClick={() => {
                soundEngine.playUiClick();
                onRedeploy();
              }}
              className="px-6 py-2.5 rounded-md bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-sm font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              再次部署战区
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
