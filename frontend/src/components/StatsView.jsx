import React, { useState } from 'react';
import { 
  BarChart3, 
  Flame, 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  Clock, 
  Calendar, 
  CheckCircle2, 
  XCircle, 
  Sparkles, 
  MessageSquare, 
  Activity, 
  Tag, 
  Search,
  Zap,
  Trophy,
  Award,
  Lock,
  Check,
  Shield
} from 'lucide-react';

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

// Helper to map badge ID to Lucide icon component
function getBadgeIcon(badgeId) {
  switch (badgeId) {
    case 'first_checkin': return Sparkles;
    case 'streak_3': return Flame;
    case 'streak_7': return Zap;
    case 'level_5': return Trophy;
    case 'night_owl': return Award;
    case 'schedule_architect': return Shield;
    default: return Trophy;
  }
}

export default function StatsView({ 
  patterns = {}, 
  streaks = {}, 
  checkins = [], 
  chatHistory = [], 
  habits = [],
  gamification = {} 
}) {
  const [chatSearch, setChatSearch] = useState('');

  const filteredChat = (chatHistory || []).filter(msg => 
    (msg.message || '').toLowerCase().includes(chatSearch.toLowerCase()) ||
    (msg.role || '').toLowerCase().includes(chatSearch.toLowerCase())
  );

  const missRateByDay = patterns.miss_rate_by_day || {};
  const reasonClusters = patterns.reason_clusters || {};
  const recentEvents = patterns.recent_events || [];

  const currentLevel = gamification?.current_level || { level: 1, title: "Habit Explorer", badge: "Explorer" };
  const totalXp = gamification?.total_xp || 0;
  const progressPct = gamification?.progress_pct || 0;
  const allBadges = gamification?.all_badges || [];
  const unlockedBadgeIds = gamification?.unlocked_badge_ids || [];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      
      {/* Header */}
      <div className="glass-card p-6 rounded-3xl border border-slate-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
              <BarChart3 className="w-4 h-4" />
            </div>
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight font-['Outfit']">
              Behavior Analytics &amp; Gamification
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Live analytics derived from check-ins, diurnal friction analysis, and weekly habit adherence.
          </p>
        </div>

        {/* Overall Completion Metric Card */}
        <div className="flex items-center gap-4 bg-white/80 border border-slate-200/90 p-3 rounded-2xl shadow-xs">
          <div className="text-right">
            <div className="text-[10px] uppercase font-bold text-slate-400">Overall Success</div>
            <div className="text-xl font-extrabold text-indigo-600">{patterns.overall_completion_rate || 0}%</div>
          </div>
          <div className="h-8 w-px bg-slate-200"></div>
          <div className="text-right">
            <div className="text-[10px] uppercase font-bold text-slate-400">Total Check-ins</div>
            <div className="text-xl font-extrabold text-slate-900">{patterns.total_checkins || 0}</div>
          </div>
        </div>
      </div>

      {/* Gamification Showcase (Level + Badges) */}
      <div className="glass-card p-5 rounded-3xl border border-slate-200/90 space-y-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-indigo-600" />
            <h3 className="text-sm font-bold text-slate-900 font-['Outfit']">Milestone Ranks &amp; Badges</h3>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500">Current Rank:</span>
            <span className="font-bold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-200">
              Level {currentLevel.level} &bull; {currentLevel.title} ({totalXp} XP)
            </span>
          </div>
        </div>

        {/* Badges Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
          {allBadges.map((badge) => {
            const isUnlocked = unlockedBadgeIds.includes(badge.id);
            const BadgeIcon = getBadgeIcon(badge.id);

            return (
              <div
                key={badge.id}
                className={`p-3.5 rounded-2xl border text-center space-y-2 transition ${
                  isUnlocked
                    ? 'bg-indigo-50/60 border-indigo-200 text-slate-900 shadow-xs'
                    : 'bg-white/50 border-slate-200/80 text-slate-400 opacity-60'
                }`}
              >
                <div className="w-10 h-10 mx-auto rounded-xl flex items-center justify-center bg-white border border-slate-200/80 shadow-xs">
                  {isUnlocked ? (
                    <BadgeIcon className="w-5 h-5 text-indigo-600" />
                  ) : (
                    <Lock className="w-4 h-4 text-slate-400" />
                  )}
                </div>
                <div className="text-xs font-bold text-slate-800 truncate">{badge.name}</div>
                <div className="text-[10px] text-slate-500 line-clamp-2 leading-tight">
                  {badge.description}
                </div>
                {isUnlocked ? (
                  <span className="inline-flex items-center gap-1 text-[9px] font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
                    <Check className="w-2.5 h-2.5" />
                    Unlocked
                  </span>
                ) : (
                  <span className="inline-block text-[9px] font-semibold bg-slate-200/80 text-slate-500 px-2 py-0.5 rounded-full">
                    Locked
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Top Grid: Streaks & Trend Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        
        {/* 1. Habit Streaks Card */}
        <div className="glass-card p-5 rounded-3xl border border-slate-200/90 space-y-4 lg:col-span-2 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Flame className="w-4 h-4 text-amber-500" />
              <h3 className="text-sm font-bold text-slate-900 font-['Outfit']">Active Habit Streaks</h3>
            </div>
            <span className="text-[10px] text-slate-400 font-medium font-mono">Computed from checkins</span>
          </div>

          {habits.length === 0 ? (
            <p className="text-xs text-slate-400 py-4 text-center">No habits added yet.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {habits.map((h) => {
                const s = streaks[h.id] || { current_streak: 0, best_streak: 0, total_completions: 0 };
                return (
                  <div
                    key={h.id}
                    className="p-3.5 rounded-2xl bg-white/80 border border-slate-200/90 space-y-2 flex flex-col justify-between shadow-xs"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-xs font-bold text-slate-900">{h.name}</div>
                        <div className="text-[10px] text-slate-500">{h.target_time} ({h.duration_minutes}m)</div>
                      </div>
                      <div className="flex items-center gap-1 bg-amber-50 text-amber-700 font-bold text-xs px-2.5 py-0.5 rounded-full border border-amber-200">
                        <Flame className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                        <span>{s.current_streak}d</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-500 pt-2 border-t border-slate-200/80">
                      <span>Best: <strong className="text-slate-800">{s.best_streak}d</strong></span>
                      <span>Total: <strong className="text-indigo-600">{s.total_completions}</strong></span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 2. 7-Day Trend Card */}
        <div className="glass-card p-5 rounded-3xl border border-slate-200/90 space-y-4 flex flex-col justify-between shadow-xs">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-900 font-['Outfit']">7-Day Momentum Trend</h3>
              </div>
            </div>

            <div className="space-y-3 bg-white/70 p-3.5 rounded-2xl border border-slate-200/80 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-600">Last 7 Days Rate:</span>
                <span className="text-sm font-bold text-indigo-700">{patterns.last_7_days_rate || 0}%</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-indigo-600 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${patterns.last_7_days_rate || 0}%` }}
                ></div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-xs text-slate-500">Prior 7 Days Rate:</span>
                <span className="text-sm font-bold text-slate-700">{patterns.prior_7_days_rate || 0}%</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-slate-400 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${patterns.prior_7_days_rate || 0}%` }}
                ></div>
              </div>
            </div>
          </div>

          {/* Trend Badge */}
          <div className="pt-2">
            {patterns.trend === 'improving' && (
              <div className="flex items-center gap-2 p-2.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                <span>Improving (+5% vs prior week)</span>
              </div>
            )}
            {patterns.trend === 'declining' && (
              <div className="flex items-center gap-2 p-2.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold">
                <TrendingDown className="w-4 h-4 text-rose-600" />
                <span>Friction detected (-5% vs prior week)</span>
              </div>
            )}
            {patterns.trend === 'stable' && (
              <div className="flex items-center gap-2 p-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold">
                <Minus className="w-4 h-4 text-slate-500" />
                <span>Stable consistency</span>
              </div>
            )}
            {patterns.trend === 'no_data' && (
              <div className="p-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-slate-500 text-xs text-center">
                Need more days of data to compute trend.
              </div>
            )}
          </div>

        </div>

      </div>

      {/* Middle Grid: Miss Rate by Day & Recurring Reasons */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        
        {/* Miss Rate by Day of the Week */}
        <div className="glass-card p-5 rounded-3xl border border-slate-200/90 space-y-4 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-indigo-600" />
              <h3 className="text-sm font-bold text-slate-900 font-['Outfit']">Miss Rate by Day of Week</h3>
            </div>
            {patterns.highest_miss_day && (
              <span className="text-[10px] bg-rose-50 text-rose-700 px-2.5 py-0.5 rounded-full font-bold border border-rose-200">
                Peak Miss: {patterns.highest_miss_day}
              </span>
            )}
          </div>

          <div className="space-y-2.5">
            {DAYS.map((d) => {
              const rate = missRateByDay[d] || 0;
              const isHighest = patterns.highest_miss_day === d;

              return (
                <div key={d} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className={`font-medium ${isHighest ? 'text-rose-700 font-bold' : 'text-slate-700'}`}>
                      {d}
                    </span>
                    <span className={`font-semibold ${rate > 30 ? 'text-rose-600' : 'text-slate-600'}`}>
                      {rate}% miss
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-2 rounded-full transition-all duration-500 ${
                        rate > 40 ? 'bg-rose-500' : rate > 15 ? 'bg-amber-500' : 'bg-indigo-600'
                      }`}
                      style={{ width: `${rate}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recurring Reasons Clustering */}
        <div className="glass-card p-5 rounded-3xl border border-slate-200/90 space-y-4 flex flex-col justify-between shadow-xs">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-900 font-['Outfit']">Recurring Friction Reasons</h3>
              </div>
            </div>

            {Object.keys(reasonClusters).length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">
                No missed habits recorded yet! Excellent consistency.
              </p>
            ) : (
              <div className="space-y-2.5">
                {Object.entries(reasonClusters).map(([category, count], idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-2xl bg-white/80 border border-slate-200/90 flex items-center justify-between shadow-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
                      <span className="text-xs font-semibold text-slate-800">{category}</span>
                    </div>
                    <span className="text-xs font-bold bg-white px-2.5 py-0.5 rounded-full text-slate-700 border border-slate-200">
                      {count} occurrence{count !== 1 ? 's' : ''}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="p-3 rounded-2xl bg-indigo-50/80 border border-indigo-200 text-[11px] text-indigo-900">
            <strong className="font-bold text-indigo-950">Lumi Adaptive Recovery: </strong>
            When reasons like "Tiredness" or "Schedule Conflict" repeat, Lumi automatically offers 1-tap remedies (shorter duration, evening shift, or rest day).
          </div>
        </div>

      </div>

      {/* Behavioral Log Feed */}
      <div className="glass-card p-5 rounded-3xl border border-slate-200/90 space-y-3 shadow-xs">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-indigo-600" />
          <h3 className="text-sm font-bold text-slate-900 font-['Outfit']">Behavior Log Stream</h3>
        </div>

        {recentEvents.length === 0 ? (
          <p className="text-xs text-slate-400 py-3 text-center">No behavior events logged yet.</p>
        ) : (
          <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
            {recentEvents.map((evt) => {
              let parsedDetails = {};
              try {
                parsedDetails = JSON.parse(evt.details);
              } catch (e) {
                parsedDetails = { raw: evt.details };
              }

              return (
                <div
                  key={evt.id}
                  className="p-2.5 rounded-2xl bg-white/80 border border-slate-200/90 text-xs flex items-center justify-between shadow-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                      {evt.event_type}
                    </span>
                    <span className="text-slate-800 text-xs">
                      {parsedDetails.name || parsedDetails.habit_name || parsedDetails.action || parsedDetails.reason || JSON.stringify(parsedDetails)}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {evt.created_at}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Permanent Chat History Review */}
      <div className="glass-card p-5 rounded-3xl border border-slate-200/90 space-y-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-indigo-600" />
            <div>
              <h3 className="text-sm font-bold text-slate-900 font-['Outfit']">Permanent Chat History Memory</h3>
              <p className="text-[11px] text-slate-500">All past user &amp; assistant messages are permanently preserved in SQLite.</p>
            </div>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={chatSearch}
              onChange={(e) => setChatSearch(e.target.value)}
              placeholder="Search conversation..."
              className="bg-white/90 border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-400 w-full sm:w-56"
            />
          </div>
        </div>

        <div className="max-h-72 overflow-y-auto space-y-2 pr-1 border border-slate-200/90 rounded-2xl p-3 bg-white/50">
          {filteredChat.length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center">No messages matching query.</p>
          ) : (
            filteredChat.map((item) => (
              <div
                key={item.id}
                className="p-2.5 rounded-xl bg-white border border-slate-200/90 text-xs space-y-1 shadow-xs"
              >
                <div className="flex items-center justify-between text-[10px]">
                  <span className={`font-bold uppercase ${item.role === 'user' ? 'text-indigo-700' : 'text-slate-800'}`}>
                    {item.role}
                  </span>
                  <span className="text-slate-400 font-mono">{item.created_at}</span>
                </div>
                <p className="text-slate-700 whitespace-pre-wrap">{item.message}</p>
              </div>
            ))
          )}
        </div>
      </div>

    </div>
  );
}
