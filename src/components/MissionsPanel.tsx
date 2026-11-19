import { useMemo, useState } from 'react';
import { Award, CheckCircle2, Coins, Crosshair, MapPin, ShieldCheck } from 'lucide-react';
import { MAPS, TACTICAL_MEDALS } from '../data/gameData';
import { getMissionProgressSummary, MissionStatusItem } from '../storage/profileStore';
import { MapId, MissionCategory, PlayerProfile, TacticalMedalId } from '../types/game';

type MissionFilter = 'all' | 'in_progress' | 'claimable' | 'claimed';

interface MissionsPanelProps {
  profile: PlayerProfile;
  onClaimMission: (missionId: string) => void;
  onClaimAllMissions: () => void;
  onFocusMissionMap: (mapId?: MapId) => void;
}

const CATEGORY_LABELS: Record<MissionCategory, string> = {
  extraction: '撤离行动',
  combat: '战区清剿',
  recon_gear: '战术器材',
  boss: '首领斩首',
};

function MedalVectorEmblem({
  medalId,
  color,
  earned,
}: {
  medalId: TacticalMedalId;
  color: string;
  earned: boolean;
}) {
  const stroke = earned ? color : '#475569';
  const fill = earned ? color : '#1E293B';
  const ribbonColor = earned ? color : '#334155';

  return (
    <svg
      width="40"
      height="44"
      viewBox="0 0 40 44"
      fill="none"
      aria-hidden="true"
      className="shrink-0"
    >
      {/* Top tactical ribbon */}
      <path d="M12 2H28V12L20 15L12 12V2Z" fill={ribbonColor} fillOpacity={earned ? 0.28 : 0.35} stroke={stroke} strokeWidth="1.4" />
      <line x1="17" y1="2" x2="17" y2="13.5" stroke={stroke} strokeWidth="1.2" strokeOpacity={0.75} />
      <line x1="23" y1="2" x2="23" y2="13.5" stroke={stroke} strokeWidth="1.2" strokeOpacity={0.75} />

      {/* Outer octagonal military medal plate */}
      <polygon
        points="20,14 31,19 33,30 20,41 7,30 9,19"
        fill={fill}
        fillOpacity={earned ? 0.16 : 0.4}
        stroke={stroke}
        strokeWidth="1.7"
      />

      {/* Inner variant motif per medal family */}
      {medalId === 'medal_boss_slayer' && (
        <path d="M20 20L24.5 29H15.5L20 20ZM15 32H25" stroke={stroke} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      )}
      {medalId === 'medal_orbital_ace' && (
        <path d="M20 19L23 26L28 27L23 29L20 35L17 29L12 27L17 26L20 19Z" stroke={stroke} strokeWidth="1.4" fill={fill} fillOpacity={earned ? 0.3 : 0.1} />
      )}
      {medalId === 'medal_high_roller' && (
        <polygon points="20,20 27,27 20,34 13,27" stroke={stroke} strokeWidth="1.6" fill={fill} fillOpacity={earned ? 0.25 : 0.1} />
      )}
      {medalId !== 'medal_boss_slayer' &&
        medalId !== 'medal_orbital_ace' &&
        medalId !== 'medal_high_roller' && (
          <path d="M14 25.5L20 20.5L26 25.5M15.5 30.5L20 26.5L24.5 30.5" stroke={stroke} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        )}
    </svg>
  );
}

export function MissionsPanel({
  profile,
  onClaimMission,
  onClaimAllMissions,
  onFocusMissionMap,
}: MissionsPanelProps) {
  const [filter, setFilter] = useState<MissionFilter>('all');

  const summary = useMemo(() => getMissionProgressSummary(profile), [profile]);
  const allMedals = useMemo(() => Object.values(TACTICAL_MEDALS), []);
  const medalInventory = profile.medalInventory || {};
  const earnedMedalTypesCount = useMemo(
    () => allMedals.filter((m) => (medalInventory[m.id] || 0) > 0).length,
    [allMedals, medalInventory]
  );

  const overallPct = Math.round(
    (summary.completedCount / Math.max(1, summary.totalMissions)) * 100
  );

  const filteredItems = useMemo(() => {
    const sorted = [...summary.items].sort((a, b) => {
      if (a.claimable !== b.claimable) return a.claimable ? -1 : 1;
      if (a.claimed !== b.claimed) return a.claimed ? 1 : -1;
      return b.pct - a.pct;
    });

    if (filter === 'claimable') return sorted.filter((i) => i.claimable);
    if (filter === 'in_progress') return sorted.filter((i) => !i.completed);
    if (filter === 'claimed') return sorted.filter((i) => i.claimed);
    return sorted;
  }, [summary.items, filter]);

  const filterOptions: Array<{ id: MissionFilter; label: string; count: number }> = [
    { id: 'all', label: '全部任务', count: summary.totalMissions },
    { id: 'claimable', label: '待领奖', count: summary.claimableCount },
    {
      id: 'in_progress',
      label: '进行中',
      count: summary.totalMissions - summary.completedCount,
    },
    { id: 'claimed', label: '已领归档', count: summary.claimedCount },
  ];

  const renderStatusText = (item: MissionStatusItem) => {
    if (item.claimable) {
      return (
        <span className="text-xs font-semibold text-[#00E59B] flex items-center gap-1 whitespace-nowrap">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>目标达成 · 可领奖</span>
        </span>
      );
    }
    if (item.claimed) {
      return <span className="text-xs text-slate-500 whitespace-nowrap">已完成 · 已归档</span>;
    }
    return (
      <span className="text-xs font-mono-tabular text-amber-400 whitespace-nowrap">
        进行中 · {item.pct}%
      </span>
    );
  };

  return (
    <div className="h-full overflow-y-auto p-6 bg-[#090C11]">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* TOP KPI SUMMARY STRIP */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-[#101622] border border-slate-800 p-4 df-chamfer-sm flex flex-col justify-between gap-2">
            <div className="text-xs text-slate-400">已完成任务进度</div>
            <div className="flex items-baseline justify-between gap-2">
              <div className="text-2xl font-mono-tabular font-bold text-white">
                {summary.completedCount}
                <span className="text-sm text-slate-500 ml-1">/ {summary.totalMissions}</span>
              </div>
              <span className="text-xs font-mono-tabular text-[#00E59B] font-semibold">
                {overallPct}%
              </span>
            </div>
            <div className="h-1.5 w-full bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-[#00E59B] transition-all duration-200"
                style={{ width: `${overallPct}%` }}
              />
            </div>
          </div>

          <div className="bg-[#101622] border border-slate-800 p-4 df-chamfer-sm flex flex-col justify-between gap-1.5">
            <div className="text-xs text-slate-400 flex items-center gap-1.5">
              <Award className="w-3.5 h-3.5 text-amber-400" />
              <span>已获战术勋章</span>
            </div>
            <div className="text-2xl font-mono-tabular font-bold text-amber-400">
              {summary.totalMedals} <span className="text-xs font-normal text-slate-400">枚</span>
            </div>
            <div className="text-xs text-slate-400 font-mono-tabular">
              已解锁制式勋章 {earnedMedalTypesCount} / {allMedals.length} 种
            </div>
          </div>

          <div className="bg-[#101622] border border-slate-800 p-4 df-chamfer-sm flex flex-col justify-between gap-1.5">
            <div className="text-xs text-slate-400 flex items-center gap-1.5">
              <Coins className="w-3.5 h-3.5 text-emerald-400" />
              <span>累计任务奖金</span>
            </div>
            <div className="text-2xl font-mono-tabular font-bold text-emerald-400">
              +{summary.totalMissionCreditsEarned.toLocaleString()}
            </div>
            <div className="text-xs text-slate-400">哈夫币已自动汇入特勤处账户</div>
          </div>

          <div className="bg-[#101622] border border-slate-800 p-4 df-chamfer-sm flex flex-col justify-between gap-2">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>待领取任务奖励</span>
              <span className="font-mono-tabular text-white font-semibold">
                {summary.claimableCount} 项
              </span>
            </div>
            <button
              type="button"
              disabled={summary.claimableCount === 0}
              onClick={onClaimAllMissions}
              className="w-full py-2.5 px-4 bg-[#00E59B] hover:bg-[#34F5B5] disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-bold text-xs tracking-wide transition-colors cursor-pointer disabled:cursor-not-allowed whitespace-nowrap"
            >
              {summary.claimableCount > 0
                ? `一键领取全部 (${summary.claimableCount})`
                : '暂无可领取任务奖励'}
            </button>
          </div>
        </div>

        {/* MISSION LIST HEADER & FILTER BAR */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-3">
          <div>
            <h2 className="text-lg font-bold text-white">战区撤离与战术委托清单</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              完成每次战区撤离与实战目标后自动累计进度，达标即可领取额外战术勋章与哈夫币赏金。
            </p>
          </div>

          <div className="flex items-center gap-1 p-1 bg-[#101622] border border-slate-800">
            {filterOptions.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setFilter(opt.id)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  filter === opt.id
                    ? 'bg-[#00E59B] text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {opt.label} ({opt.count})
              </button>
            ))}
          </div>
        </div>

        {/* MISSION CARDS GRID */}
        {filteredItems.length === 0 ? (
          <div className="py-12 bg-[#101622] border border-dashed border-slate-800 text-center space-y-2">
            <div className="text-sm font-semibold text-slate-300">当前筛选分类下暂无任务记录</div>
            <div className="text-xs text-slate-500">
              切换至「全部任务」查看进行中的战区撤离指标，或立即部署战区积累进度。
            </div>
            {filter !== 'all' && (
              <button
                type="button"
                onClick={() => setFilter('all')}
                className="mt-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 font-medium cursor-pointer"
              >
                查看全部任务
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filteredItems.map((item) => {
              const { mission } = item;
              const medal = TACTICAL_MEDALS[mission.rewardMedalId];
              const mapName = mission.mapId ? MAPS[mission.mapId]?.name : '全战区通用';

              return (
                <div
                  key={mission.id}
                  className={`p-5 bg-[#101622] border transition-colors flex flex-col justify-between gap-4 ${
                    item.claimable
                      ? 'border-[#00E59B]/75'
                      : item.claimed
                        ? 'border-slate-800/70 opacity-80'
                        : 'border-slate-800'
                  }`}
                >
                  <div className="space-y-3">
                    {/* Top Unboxed Metadata + Status */}
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 text-xs text-slate-400 min-w-0">
                        <span className="text-slate-300 font-medium shrink-0">
                          {CATEGORY_LABELS[mission.category]}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="truncate">{mission.issuer}</span>
                        <span aria-hidden="true">·</span>
                        <span className="text-sky-300 shrink-0">{mapName}</span>
                      </div>
                      {renderStatusText(item)}
                    </div>

                    {/* Title & Description */}
                    <div>
                      <h3 className="text-base font-bold text-white">{mission.title}</h3>
                      <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                        {mission.description}
                      </p>
                    </div>

                    {/* Real-time Progress Bar */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-mono-tabular">
                        <span className="text-slate-400">实时进度</span>
                        <span className="text-white font-semibold">
                          {item.current.toLocaleString()} / {item.target.toLocaleString()}{' '}
                          <span className="text-slate-400 font-normal">{mission.unitLabel}</span>
                        </span>
                      </div>
                      <div className="h-2 w-full bg-[#090C11] border border-slate-800/90 overflow-hidden">
                        <div
                          className="h-full transition-all duration-200"
                          style={{
                            width: `${item.pct}%`,
                            backgroundColor: item.completed ? '#00E59B' : '#F59E0B',
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Reward & Interactive Action Footer */}
                  <div className="pt-3 border-t border-slate-800/90 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <MedalVectorEmblem
                        medalId={medal.id}
                        color={medal.color}
                        earned={item.claimed}
                      />
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-white truncate">
                          {medal.name}{' '}
                          <span className="font-mono-tabular text-amber-300">
                            ×{mission.rewardMedalCount}
                          </span>
                        </div>
                        <div className="text-xs font-mono-tabular text-emerald-400 mt-0.5">
                          +{mission.rewardCredits.toLocaleString()} 哈夫币赏金
                        </div>
                      </div>
                    </div>

                    {item.claimable ? (
                      <button
                        type="button"
                        onClick={() => onClaimMission(mission.id)}
                        className="px-4 py-2 bg-[#00E59B] hover:bg-[#34F5B5] text-slate-950 font-bold text-xs tracking-wide transition-colors cursor-pointer whitespace-nowrap shrink-0"
                      >
                        领取勋章与奖金
                      </button>
                    ) : item.claimed ? (
                      <span className="px-3 py-1.5 bg-[#0A0E16] border border-slate-800 text-slate-400 text-xs font-medium whitespace-nowrap shrink-0 flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                        <span>奖励已发放</span>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onFocusMissionMap(mission.mapId)}
                        className="px-3.5 py-2 bg-[#0A0E16] hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 flex items-center gap-1.5"
                      >
                        {mission.mapId ? (
                          <>
                            <MapPin className="w-3.5 h-3.5 text-[#00E59B]" />
                            <span>锁定「{MAPS[mission.mapId].name}」出击</span>
                          </>
                        ) : (
                          <>
                            <Crosshair className="w-3.5 h-3.5 text-[#00E59B]" />
                            <span>前往战区执行</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* TACTICAL MEDAL HONOR VAULT */}
        <div className="pt-2 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
            <div>
              <h3 className="text-base font-bold text-white">特勤处战术勋章陈列柜</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                每枚战术勋章均记录干员在八宝粥高危撤离行动中的真实战功。
              </p>
            </div>
            <span className="text-xs font-mono-tabular text-amber-400">
              总勋章数：{summary.totalMedals} 枚
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {allMedals.map((medal) => {
              const count = medalInventory[medal.id] || 0;
              const earned = count > 0;
              return (
                <div
                  key={medal.id}
                  className={`p-4 bg-[#101622] border flex items-start gap-3 ${
                    earned ? 'border-slate-700' : 'border-slate-800/70 opacity-65'
                  }`}
                >
                  <MedalVectorEmblem medalId={medal.id} color={medal.color} earned={earned} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className="text-[11px] font-medium truncate"
                        style={{ color: earned ? medal.color : '#64748B' }}
                      >
                        {medal.rankLabel}
                      </span>
                      <span className="text-xs font-mono-tabular font-bold text-white shrink-0">
                        {earned ? `×${count}` : '未获'}
                      </span>
                    </div>
                    <div className="text-sm font-bold text-white mt-0.5 truncate">
                      {medal.name}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                      {medal.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
