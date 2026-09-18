import React, { useState } from 'react';
import { 
  CheckSquare, 
  Flame, 
  Clock, 
  Calendar, 
  Plus, 
  CheckCircle2, 
  XCircle, 
  Trash2, 
  Sparkles, 
  ArrowRight,
  RefreshCw,
  Trophy,
  Zap,
  Target,
  User,
  X
} from 'lucide-react';
import AvatarCompanion from './AvatarCompanion';

export default function HabitsView({ 
  habits = [], 
  onCheckin, 
  onAddHabit,
  onCreateHabit, 
  onDeleteHabit,
  onArchiveHabit, 
  onOpenChatWithPrompt, 
  proactiveSuggestion,
  gamification = {},
  personality = 'enthusiastic'
}) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [newHabitName, setNewHabitName] = useState('');
  const [newHabitTime, setNewHabitTime] = useState('08:00');
  const [newHabitDuration, setNewHabitDuration] = useState(30);
  const [newHabitFrequency, setNewHabitFrequency] = useState('daily');

  const [missModalHabit, setMissModalHabit] = useState(null);
  const [missReason, setMissReason] = useState('');

  const currentLevel = gamification?.current_level || { level: 1, title: "Habit Explorer", badge: "Explorer" };
  const totalXp = gamification?.total_xp || 0;
  const progressPct = gamification?.progress_pct || 0;
  const xpToNext = gamification?.xp_to_next || 0;
  const dailyQuests = gamification?.daily_quests || [];

  const handleAddHabitFn = onAddHabit || onCreateHabit;
  const handleDeleteHabitFn = onDeleteHabit || onArchiveHabit;

  const handleCreateSubmit = (e) => {
    e.preventDefault();
    if (!newHabitName.trim()) return;
    if (handleAddHabitFn) {
      handleAddHabitFn({
        name: newHabitName.trim(),
        target_time: newHabitTime,
        duration_minutes: parseInt(newHabitDuration, 10) || 30,
        frequency: newHabitFrequency
      });
    }
    setNewHabitName('');
    setNewHabitTime('08:00');
    setNewHabitDuration(30);
    setShowAddModal(false);
  };

  const handleMissSubmit = (e) => {
    e.preventDefault();
    if (!missModalHabit) return;
    onCheckin(missModalHabit.id, false, missReason || 'Encountered unexpected schedule friction');
    setMissModalHabit(null);
    setMissReason('');
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      
      {/* AI Avatar Companion Interactive Check-in Bar */}
      <AvatarCompanion
        habits={habits}
        onCheckin={onCheckin}
        onOpenChatWithPrompt={onOpenChatWithPrompt}
        proactiveSuggestion={proactiveSuggestion}
        personality={personality}
      />

      {/* Gamification Level & Daily Quests Bar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        
        {/* Level & XP Progress Card */}
        <div className="glass-card p-5 rounded-3xl border border-slate-200/90 space-y-3 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
                <Trophy className="w-4 h-4" />
              </div>
              <div>
                <div className="text-[10px] uppercase font-bold text-slate-400">Level {currentLevel.level}</div>
                <div className="text-sm font-extrabold text-slate-900 font-['Outfit']">{currentLevel.title}</div>
              </div>
            </div>
            <div className="text-right">
              <span className="text-base font-extrabold text-indigo-600">{totalXp} XP</span>
              <span className="text-[10px] text-slate-400 block">total earned</span>
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-[10px] text-slate-500 font-medium">
              <span>Progress to next rank</span>
              <span>{xpToNext > 0 ? `${xpToNext} XP to Level ${currentLevel.level + 1}` : 'Max Level'}</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
              <div
                className="bg-indigo-600 h-2 rounded-full transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        </div>

        {/* Daily Quests Card */}
        <div className="glass-card p-5 rounded-3xl border border-slate-200/90 space-y-2 lg:col-span-2 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-indigo-600" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 font-['Outfit']">Daily Focus Quests</h3>
            </div>
            <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">
              Resets Daily
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
            {dailyQuests.map((quest) => (
              <div
                key={quest.id}
                className={`p-2.5 rounded-2xl border text-xs flex items-center justify-between transition ${
                  quest.completed
                    ? 'bg-indigo-50/70 border-indigo-200 text-indigo-900 shadow-xs'
                    : 'bg-white/70 border-slate-200/90 text-slate-700 hover:bg-white'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-indigo-600 shrink-0 shadow-xs">
                    <Zap className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className={`font-bold ${quest.completed ? 'text-indigo-700 line-through opacity-70' : 'text-slate-900'}`}>
                      {quest.title}
                    </div>
                    <div className="text-[10px] text-indigo-600 font-mono">+{quest.xp} XP</div>
                  </div>
                </div>

                {quest.completed ? (
                  <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />
                ) : (
                  <span className="w-3.5 h-3.5 rounded-full border border-slate-300 shrink-0" />
                )}
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Header & Quick Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-card p-6 rounded-3xl border border-slate-200/90 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
              <CheckSquare className="w-4 h-4" />
            </div>
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight font-['Outfit']">
              Active Habits &amp; Daily Check-ins
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Track daily completions, view streak momentum, and micro-adapt when life gets busy.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowAddModal(true)}
            className="btn-dark-pill text-xs font-bold px-4 py-2.5 rounded-xl flex items-center gap-1.5 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Create Habit</span>
          </button>
        </div>
      </div>

      {/* Habits Grid */}
      {habits.length === 0 ? (
        <div className="glass-card p-12 text-center rounded-3xl border border-slate-200/90 space-y-4 shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 mx-auto shadow-xs">
            <Sparkles className="w-7 h-7" />
          </div>
          <div className="max-w-sm mx-auto space-y-1">
            <h3 className="text-base font-bold text-slate-900 font-['Outfit']">No active habits yet</h3>
            <p className="text-xs text-slate-500">
              Ask your AI Companion in Chat to craft a routine based on your schedule, or add one manually.
            </p>
          </div>
          <div className="pt-2 flex justify-center gap-3">
            <button
              onClick={() => onOpenChatWithPrompt("Help me design a habit that fits my current schedule")}
              className="btn-dark-pill text-xs font-semibold px-4 py-2.5 rounded-xl flex items-center gap-1.5 shadow-sm"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-300" />
              <span>Ask AI in Chat</span>
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="text-xs font-semibold px-4 py-2.5 rounded-xl bg-white/90 hover:bg-white text-slate-700 border border-slate-200/90 transition flex items-center gap-1.5 shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Manually</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {habits.map((habit) => {
            const currStreak = habit.current_streak || 0;
            const bestStreak = habit.best_streak || 0;

            return (
              <div
                key={habit.id}
                className="glass-card rounded-3xl p-5 border border-slate-200/90 hover:border-indigo-300 hover:shadow-md transition flex flex-col justify-between space-y-4 relative group shadow-xs"
              >
                {/* Delete button */}
                {handleDeleteHabitFn && (
                  <button
                    onClick={() => {
                      if (window.confirm(`Delete habit "${habit.name}"?`)) {
                        handleDeleteHabitFn(habit.id);
                      }
                    }}
                    title="Pause/Delete habit"
                    className="absolute top-4 right-4 text-slate-400 hover:text-rose-600 p-1 rounded-md transition opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}

                <div>
                  <div className="flex items-center justify-between pr-6 mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                      {habit.frequency || 'Daily'}
                    </span>
                    
                    {/* Streak badge */}
                    <div className="flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                      <Flame className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                      <span>{currStreak}d streak</span>
                    </div>
                  </div>

                  <h3 className="text-base font-extrabold text-slate-900 tracking-tight font-['Outfit']">{habit.name}</h3>

                  <div className="mt-3 flex items-center gap-4 text-xs text-slate-600">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-purple-600" />
                      <span className="font-semibold font-mono text-slate-900">{habit.target_time}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-purple-600" />
                      <span className="font-semibold text-slate-900">{habit.duration_minutes} mins</span>
                    </div>
                  </div>
                </div>

                {/* Check-in Actions */}
                <div className="pt-2 border-t border-slate-100 space-y-2">
                  <div className="text-[11px] font-medium text-slate-500 flex items-center justify-between">
                    <span>Daily Check-in</span>
                    <span className="text-purple-600 font-mono text-[10px] font-bold">Best: {bestStreak}d</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => onCheckin(habit.id, true)}
                      className="btn-dark-pill text-xs font-bold py-2.5 px-3 rounded-xl transition flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Done (+50 XP)</span>
                    </button>
                    <button
                      onClick={() => setMissModalHabit(habit)}
                      className="text-xs font-bold py-2.5 px-3 bg-slate-50 hover:bg-rose-50 text-slate-700 hover:text-rose-700 border border-slate-200 hover:border-rose-200 rounded-xl transition flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      <XCircle className="w-3.5 h-3.5 text-rose-500" />
                      <span>Missed</span>
                    </button>
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* Miss Reason Modal & AI Micro-adaptation */}
      {missModalHabit && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-card max-w-md w-full p-6 rounded-3xl border border-slate-200 space-y-4 shadow-2xl animate-slide-up bg-white text-slate-900">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-purple-700 font-bold text-sm">
                <RefreshCw className="w-4 h-4" />
                <span>Habit Adaptation Check-in</span>
              </div>
              <button
                onClick={() => setMissModalHabit(null)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Tell your AI Companion why you missed <strong>{missModalHabit.name}</strong> today. Lumi will analyze the reason and micro-adapt the habit duration or time to keep you consistent.
            </p>

            <form onSubmit={handleMissSubmit} className="space-y-3">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-700">Reason for missing:</label>
                <input
                  type="text"
                  required
                  value={missReason}
                  onChange={(e) => setMissReason(e.target.value)}
                  placeholder="e.g., Tired from late shift, Class ran over, Too overwhelmed"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-purple-500"
                />
              </div>

              {/* Quick reason suggestions */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {[
                  "Tired / Low energy",
                  "Class / Work conflict",
                  "Session felt too long",
                  "Forgot / Lost track of time"
                ].map((r, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setMissReason(r)}
                    className="text-[10px] bg-slate-100 hover:bg-purple-50 hover:text-purple-700 text-slate-700 px-2.5 py-1 rounded-lg border border-slate-200 transition"
                  >
                    {r}
                  </button>
                ))}
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setMissModalHabit(null)}
                  className="text-xs font-semibold px-3.5 py-2 text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-dark-pill text-xs font-bold px-4 py-2 rounded-xl transition flex items-center gap-1.5 shadow-sm"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Submit & Adapt (+15 XP)</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manual Habit Creation Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-card max-w-md w-full p-6 rounded-3xl border border-slate-200 space-y-4 shadow-2xl animate-slide-up bg-white text-slate-900">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 font-['Outfit']">Create New Habit</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-700 p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <label className="text-slate-700 font-medium">Habit Name</label>
                <input
                  type="text"
                  required
                  value={newHabitName}
                  onChange={(e) => setNewHabitName(e.target.value)}
                  placeholder="e.g., Morning Workout, Deep Reading, Guitar Practice"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-700 font-medium">Target Time (24h)</label>
                  <input
                    type="time"
                    required
                    value={newHabitTime}
                    onChange={(e) => setNewHabitTime(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-700 font-medium">Duration (Minutes)</label>
                  <input
                    type="number"
                    min="5"
                    max="240"
                    value={newHabitDuration}
                    onChange={(e) => setNewHabitDuration(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-slate-700 font-medium">Frequency</label>
                <select
                  value={newHabitFrequency}
                  onChange={(e) => setNewHabitFrequency(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 focus:outline-none focus:border-purple-500"
                >
                  <option value="daily">Daily</option>
                  <option value="weekdays">Weekdays Only</option>
                  <option value="weekends">Weekends Only</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="text-xs px-3.5 py-2 text-slate-600 hover:text-slate-900 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-dark-pill text-xs font-bold px-4 py-2 rounded-xl transition shadow-sm"
                >
                  Save Habit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
