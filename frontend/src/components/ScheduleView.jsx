import React, { useState, useMemo } from 'react';
import { 
  Calendar, 
  Clock, 
  Plus, 
  Trash2, 
  Sparkles, 
  Moon, 
  CheckCircle2, 
  Copy, 
  RotateCcw, 
  Check, 
  ChevronDown, 
  ChevronUp, 
  X, 
  Sunrise, 
  Sunset, 
  Compass,
  Zap
} from 'lucide-react';
import TimeRangeSlider from './TimeRangeSlider';
import { CATEGORY_PRESETS, getCategoryByLabel, getPresetIconComponent } from './CategoryPresets';

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function format12Hour(timeStr) {
  if (!timeStr) return '';
  const [hStr, mStr] = timeStr.split(':');
  let h = parseInt(hStr, 10);
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${mStr} ${ampm}`;
}

export default function ScheduleView({ 
  schedule = [], 
  freeSlots = {}, 
  habits = [], 
  onAddBlock, 
  onAddBatchBlocks,
  onCloneDay,
  onClearDay,
  onDeleteBlock,
  onDeleteHabit,
  onOpenChatWithPrompt 
}) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCloneModal, setShowCloneModal] = useState(false);
  const [expandedDays, setExpandedDays] = useState({});

  // Form states for schedule creation
  const [activityLabel, setActivityLabel] = useState('Sleep & Night Rest');
  const [selectedCategory, setSelectedCategory] = useState(CATEGORY_PRESETS[0]);
  const [startTime, setStartTime] = useState('23:00');
  const [endTime, setEndTime] = useState('07:00');
  const [selectedDays, setSelectedDays] = useState(DAYS);
  const [isFreeTime, setIsFreeTime] = useState(false);

  // Clone Day state
  const [cloneSourceDay, setCloneSourceDay] = useState('Monday');
  const [cloneTargetDays, setCloneTargetDays] = useState(['Tuesday', 'Wednesday', 'Thursday', 'Friday']);

  const toggleDayExpand = (day) => {
    setExpandedDays(prev => ({ ...prev, [day]: !prev[day] }));
  };

  const isAllExpanded = DAYS.every(d => expandedDays[d]);

  const toggleAllExpand = () => {
    if (isAllExpanded) {
      setExpandedDays({});
    } else {
      const all = {};
      DAYS.forEach(d => { all[d] = true; });
      setExpandedDays(all);
    }
  };

  const getHabitsForDay = (day) => {
    if (!habits) return [];
    const dayLower = day.toLowerCase();
    return habits.filter(h => {
      const freq = (h.frequency || 'daily').toLowerCase();
      if (freq === 'daily' || freq === 'everyday' || freq === 'all') return true;
      if (freq === 'weekdays' && ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'].includes(dayLower)) return true;
      if (freq === 'weekends' && ['saturday', 'sunday'].includes(dayLower)) return true;
      return freq.includes(dayLower);
    });
  };

  // Group schedule blocks by day
  const blocksByDay = useMemo(() => {
    return DAYS.reduce((acc, day) => {
      acc[day] = schedule.filter(s => (s.day_of_week || '').toLowerCase() === day.toLowerCase());
      return acc;
    }, {});
  }, [schedule]);

  // Handle category preset click
  const handleSelectPreset = (preset) => {
    setSelectedCategory(preset);
    setActivityLabel(preset.label);
    setStartTime(preset.defaultStart);
    setEndTime(preset.defaultEnd);
    if (preset.defaultDays === 'all') {
      setSelectedDays(DAYS);
    } else if (preset.defaultDays === 'weekdays') {
      setSelectedDays(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]);
    } else if (preset.defaultDays === 'weekends') {
      setSelectedDays(["Saturday", "Sunday"]);
    }
    setShowAddModal(true);
  };

  // Toggle single day selection
  const toggleDaySelection = (day) => {
    if (selectedDays.includes(day)) {
      if (selectedDays.length === 1) return;
      setSelectedDays(selectedDays.filter(d => d !== day));
    } else {
      setSelectedDays([...selectedDays, day]);
    }
  };

  const handleSelectAllDays = () => setSelectedDays(DAYS);
  const handleSelectWeekdays = () => setSelectedDays(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]);
  const handleSelectWeekends = () => setSelectedDays(["Saturday", "Sunday"]);

  const handleCreateSubmit = (e) => {
    e.preventDefault();
    if (!activityLabel.trim()) return;

    if (selectedDays.length > 1 && onAddBatchBlocks) {
      onAddBatchBlocks({
        days: selectedDays,
        start: startTime,
        end: endTime,
        label: activityLabel.trim(),
        is_free_time: isFreeTime
      });
    } else {
      onAddBlock({
        day: selectedDays[0] || 'Monday',
        days: selectedDays,
        start: startTime,
        end: endTime,
        label: activityLabel.trim(),
        is_free_time: isFreeTime
      });
    }

    setShowAddModal(false);
  };

  const handleCloneSubmit = (e) => {
    e.preventDefault();
    if (!cloneSourceDay || cloneTargetDays.length === 0) return;
    if (onCloneDay) {
      onCloneDay({
        source_day: cloneSourceDay,
        target_days: cloneTargetDays
      });
    }
    setShowCloneModal(false);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12 animate-fade-in px-2 sm:px-4">
      
      {/* =========================================================================
          1. Header & Actions Bar
          ========================================================================= */}
      <div className="glass-card p-6 sm:p-7 rounded-3xl border border-slate-200/90 space-y-5 shadow-xs relative overflow-hidden">
        
        {/* Ambient Top Glow */}
        <div className="absolute -top-16 -right-16 w-64 h-64 bg-gradient-to-br from-indigo-200/30 to-purple-200/30 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          
          {/* Title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-200/80 flex items-center justify-center text-indigo-600 shadow-xs">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight font-['Outfit']">
                Weekly Schedule &amp; Routine
              </h1>
              <p className="text-xs text-slate-500">
                Manage your recurring daily commitments. Open slots indicate available windows for habits.
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={toggleAllExpand}
              className="text-xs font-semibold px-3.5 py-2 rounded-2xl bg-white/90 hover:bg-white text-slate-700 border border-slate-200/90 flex items-center gap-1.5 transition shadow-xs hover:border-slate-300"
            >
              {isAllExpanded ? <ChevronUp className="w-3.5 h-3.5 text-slate-500" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-500" />}
              <span>{isAllExpanded ? "Collapse All" : "Expand All"}</span>
            </button>

            <button
              onClick={() => setShowCloneModal(true)}
              className="text-xs font-semibold px-3.5 py-2 rounded-2xl bg-white/90 hover:bg-white text-slate-700 border border-slate-200/90 flex items-center gap-1.5 transition shadow-xs hover:border-slate-300"
              title="Copy a day's schedule to other days"
            >
              <Copy className="w-3.5 h-3.5 text-slate-500" />
              <span>Clone Day</span>
            </button>

            <button
              onClick={() => {
                setSelectedDays(DAYS);
                setShowAddModal(true);
              }}
              className="btn-dark-pill text-xs font-bold px-4 py-2 rounded-2xl flex items-center gap-1.5 shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Add Commitment</span>
            </button>
          </div>
        </div>

        {/* Quick Routine Presets Strip */}
        <div className="pt-3 border-t border-slate-100 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              <span>Quick Presets:</span>
            </span>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-0.5 no-scrollbar">
            {CATEGORY_PRESETS.map((preset) => {
              const PresetIcon = getPresetIconComponent(preset.iconName);
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleSelectPreset(preset)}
                  className="px-3 py-1.5 rounded-2xl bg-white/80 hover:bg-white border border-slate-200/90 hover:border-indigo-300 text-left transition flex items-center gap-2 shadow-xs shrink-0 hover:-translate-y-0.5 group"
                >
                  <PresetIcon className="w-3.5 h-3.5 text-indigo-600" />
                  <span className="text-xs font-bold text-slate-800 group-hover:text-indigo-600 transition">{preset.name}</span>
                  <span className="text-[10px] text-slate-400 font-mono">({preset.durationLabel})</span>
                </button>
              );
            })}
          </div>
        </div>

      </div>

      {/* =========================================================================
          2. DAY CARDS GRID (Clean, Beautiful, Modern Bento)
          ========================================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {DAYS.map((day) => {
          const dayBlocks = blocksByDay[day] || [];
          const dayHabits = getHabitsForDay(day);
          const dayFree = freeSlots[day] || [];
          const isExpanded = Boolean(expandedDays[day]);
          const totalCount = dayHabits.length + dayBlocks.length;
          const isToday = new Date().toLocaleDateString('en-US', { weekday: 'long' }) === day;

          const previewHabits = isExpanded ? dayHabits : dayHabits.slice(0, 2);
          const remainingSlotsForBlocks = isExpanded ? dayBlocks.length : Math.max(0, 3 - previewHabits.length);
          const previewBlocks = isExpanded ? dayBlocks : dayBlocks.slice(0, remainingSlotsForBlocks);
          const hiddenCount = totalCount - (previewHabits.length + previewBlocks.length);

          return (
            <div
              key={day}
              className={`glass-card rounded-3xl p-5 border flex flex-col space-y-4 shadow-xs transition hover:shadow-md ${
                isToday ? 'border-indigo-300 ring-2 ring-indigo-200/70 bg-indigo-50/20' : 'border-slate-200/90'
              }`}
            >
              {/* Day Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className={`font-extrabold text-sm font-['Outfit'] ${isToday ? 'text-indigo-700' : 'text-slate-900'}`}>
                    {day}
                  </span>
                  {isToday && (
                    <span className="text-[9px] font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-pulse" />
                      <span>Today</span>
                    </span>
                  )}
                  <span className="text-[10px] text-slate-500 bg-slate-100/90 px-2 py-0.5 rounded-full font-medium">
                    {totalCount} item{totalCount !== 1 ? 's' : ''}
                  </span>
                </div>
                
                <div className="flex items-center gap-1">
                  {dayBlocks.length > 0 && onClearDay && (
                    <button
                      onClick={() => onClearDay(day)}
                      className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-slate-100 transition"
                      title={`Clear commitments for ${day}`}
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setSelectedDays([day]);
                      setShowAddModal(true);
                    }}
                    className="text-slate-400 hover:text-slate-900 p-1.5 rounded-lg hover:bg-slate-100 transition"
                    title={`Add commitment to ${day}`}
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Items List */}
              <div className="space-y-2 flex-1">
                {totalCount === 0 ? (
                  <div className="p-5 rounded-2xl bg-slate-50/80 border border-dashed border-slate-200 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-1.5 py-6">
                    <Moon className="w-5 h-5 text-slate-300" />
                    <span>No commitments scheduled.</span>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedDays([day]);
                        setShowAddModal(true);
                      }}
                      className="text-[11px] font-bold text-indigo-600 hover:underline mt-1"
                    >
                      + Add routine block
                    </button>
                  </div>
                ) : (
                  <>
                    {/* 1. Daily Habits Section */}
                    {previewHabits.map((habit) => {
                      const durStr = habit.duration_minutes >= 60 ? `${(habit.duration_minutes/60).toFixed(1).replace('.0','')}h` : `${habit.duration_minutes}m`;
                      return (
                        <div
                          key={`h-${habit.id}`}
                          className="p-3 rounded-2xl bg-indigo-50/80 border border-indigo-200/80 flex items-center justify-between shadow-xs group hover:border-indigo-300 transition"
                        >
                          <div className="flex items-center gap-2.5 min-w-0 pr-2">
                            <div className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            </div>
                            <div className="truncate">
                              <div className="text-xs font-bold text-slate-900 truncate">{habit.name}</div>
                              <div className="text-[10px] text-indigo-600 font-mono">Habit &bull; {habit.target_time} ({durStr})</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {onDeleteHabit && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (window.confirm(`Delete habit "${habit.name}"?`)) {
                                    onDeleteHabit(habit.id);
                                  }
                                }}
                                className="text-slate-400 hover:text-rose-600 opacity-0 group-hover:opacity-100 transition p-1 rounded-lg"
                                title={`Delete habit "${habit.name}"`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {/* 2. Commitment Blocks Section */}
                    {previewBlocks.map((block) => {
                      const cat = getCategoryByLabel(block.activity_label);
                      const CatIcon = getPresetIconComponent(cat.iconName);
                      return (
                        <div
                          key={`b-${block.id}`}
                          className="p-3 rounded-2xl bg-white/90 border border-slate-200/80 flex items-center justify-between group shadow-xs transition hover:border-slate-300"
                        >
                          <div className="flex items-center gap-2.5 min-w-0 pr-2">
                            <div className="w-6 h-6 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                              <CatIcon className="w-3.5 h-3.5" />
                            </div>
                            <div className="truncate">
                              <div className="text-xs font-bold text-slate-900 truncate">{block.activity_label}</div>
                              <div className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                                <Clock className="w-2.5 h-2.5 text-slate-400" />
                                <span>{format12Hour(block.start_time)} - {format12Hour(block.end_time)}</span>
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={() => onDeleteBlock(block.id)}
                            className="text-slate-400 hover:text-rose-600 p-1 transition opacity-0 group-hover:opacity-100 shrink-0"
                            title="Delete block"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}

                    {/* 3. Collapsible Expander Button */}
                    {hiddenCount > 0 && !isExpanded && (
                      <button
                        type="button"
                        onClick={() => toggleDayExpand(day)}
                        className="w-full py-2 px-3 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-indigo-300 text-xs font-bold text-indigo-700 flex items-center justify-center gap-1.5 transition shadow-xs"
                      >
                        <span>+{hiddenCount} more</span>
                        <ChevronDown className="w-3.5 h-3.5 text-indigo-600" />
                      </button>
                    )}

                    {isExpanded && totalCount > 3 && (
                      <button
                        type="button"
                        onClick={() => toggleDayExpand(day)}
                        className="w-full py-1.5 px-3 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-[11px] font-semibold text-slate-600 flex items-center justify-center gap-1 transition"
                      >
                        <span>Show less</span>
                        <ChevronUp className="w-3.5 h-3.5 text-slate-500" />
                      </button>
                    )}
                  </>
                )}
              </div>

              {/* AI Free Gaps Section */}
              {dayFree.length > 0 && (
                <div className="pt-3 border-t border-slate-100 space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-indigo-700">
                    <span className="flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      <span>Free Gaps</span>
                    </span>
                    <span className="text-[9px] text-slate-400 font-normal lowercase">(click to ask AI)</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {dayFree.slice(0, 3).map((slot, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => onOpenChatWithPrompt(`I have free time on ${day} between ${slot.start} and ${slot.end}. Can you suggest a habit for me?`)}
                        className="text-[10px] bg-indigo-50/80 hover:bg-indigo-100 text-indigo-800 px-2.5 py-1 rounded-xl border border-indigo-200 hover:border-indigo-300 font-medium transition cursor-pointer shadow-xs flex items-center gap-1"
                        title="Click to ask AI for a habit"
                      >
                        <Clock className="w-2.5 h-2.5 text-indigo-600" />
                        <span>{slot.start}-{slot.end} ({slot.duration_minutes}m)</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* =========================================================================
          3. ADD COMMITMENT MODAL (Elevated Glassmorphism)
          ========================================================================= */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/30 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-card-elevated max-w-xl w-full p-6 sm:p-7 rounded-3xl border border-slate-200/80 space-y-5 shadow-2xl animate-slide-up max-h-[92vh] overflow-y-auto text-slate-900">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 shadow-xs">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 font-['Outfit']">Add Schedule Commitment</h3>
                  <p className="text-[11px] text-slate-500">Specify timings and apply across multiple days in your routine.</p>
                </div>
              </div>
              <button 
                onClick={() => setShowAddModal(false)} 
                className="text-slate-400 hover:text-slate-700 text-sm p-1.5 rounded-xl hover:bg-slate-100 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
              
              {/* Activity Label */}
              <div className="space-y-1.5">
                <label className="text-slate-700 font-semibold flex items-center justify-between">
                  <span>Commitment / Activity Title</span>
                  <span className="text-[10px] text-slate-400 font-normal">e.g., Sleep, Lecture, Job, Gym</span>
                </label>
                <input
                  type="text"
                  required
                  value={activityLabel}
                  onChange={(e) => setActivityLabel(e.target.value)}
                  placeholder="e.g. Sleep & Rest, Physics Lecture, Work Shift"
                  className="w-full bg-slate-50/80 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 text-xs focus:outline-none focus:border-indigo-500 font-medium"
                />
              </div>

              {/* Multi-Day Selector */}
              <div className="space-y-2 bg-slate-50/70 p-3.5 rounded-2xl border border-slate-200">
                <div className="flex items-center justify-between">
                  <label className="text-slate-700 font-bold flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Apply to Days:</span>
                  </label>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handleSelectAllDays}
                      className={`text-[10px] font-bold px-2.5 py-1 rounded-xl border transition ${
                        selectedDays.length === 7
                          ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      Everyday
                    </button>
                    <button
                      type="button"
                      onClick={handleSelectWeekdays}
                      className={`text-[10px] font-bold px-2.5 py-1 rounded-xl border transition ${
                        selectedDays.length === 5 && !selectedDays.includes('Saturday')
                          ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      Weekdays
                    </button>
                    <button
                      type="button"
                      onClick={handleSelectWeekends}
                      className={`text-[10px] font-bold px-2.5 py-1 rounded-xl border transition ${
                        selectedDays.length === 2 && selectedDays.includes('Saturday')
                          ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      Weekends
                    </button>
                  </div>
                </div>

                {/* Day Chips */}
                <div className="grid grid-cols-7 gap-1.5 pt-1">
                  {DAYS.map((d) => {
                    const isSelected = selectedDays.includes(d);
                    return (
                      <button
                        key={d}
                        type="button"
                        onClick={() => toggleDaySelection(d)}
                        className={`py-2 px-1 rounded-xl text-[11px] font-bold text-center border transition flex flex-col items-center justify-center gap-0.5 ${
                          isSelected
                            ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-slate-900'
                        }`}
                      >
                        <span>{d.slice(0, 3)}</span>
                        {isSelected && <Check className="w-3 h-3 text-indigo-300" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Time Range Slider */}
              <div className="space-y-1">
                <label className="text-slate-700 font-bold flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Time Range (Interactive 24h Slider):</span>
                  </span>
                </label>
                <TimeRangeSlider
                  startTime={startTime}
                  endTime={endTime}
                  onChangeStart={setStartTime}
                  onChangeEnd={setEndTime}
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="text-xs px-4 py-2 text-slate-600 hover:text-slate-900 font-medium rounded-xl hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-dark-pill text-xs font-bold px-5 py-2.5 rounded-2xl transition flex items-center gap-1.5 shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  <span>Save Commitment ({selectedDays.length} {selectedDays.length === 1 ? 'day' : 'days'})</span>
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* =========================================================================
          4. CLONE DAY SCHEDULE MODAL (Elevated Glassmorphism)
          ========================================================================= */}
      {showCloneModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/30 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-card-elevated max-w-md w-full p-6 rounded-3xl border border-slate-200/80 space-y-4 shadow-2xl animate-slide-up text-slate-900">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 shadow-xs">
                  <Copy className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-slate-900 font-['Outfit']">Clone Day Schedule</h3>
              </div>
              <button onClick={() => setShowCloneModal(false)} className="text-slate-400 hover:text-slate-700 text-xs p-1 rounded-lg hover:bg-slate-100 transition">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Copy all commitments from one source day into multiple other days in a single click.
            </p>

            <form onSubmit={handleCloneSubmit} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="text-slate-700 font-bold">Copy from (Source Day):</label>
                <select
                  value={cloneSourceDay}
                  onChange={(e) => setCloneSourceDay(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 focus:outline-none focus:border-indigo-500 font-medium"
                >
                  {DAYS.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-700 font-bold">Paste to (Target Days):</label>
                <div className="grid grid-cols-2 gap-1.5 pt-1">
                  {DAYS.filter(d => d !== cloneSourceDay).map((d) => {
                    const isTgt = cloneTargetDays.includes(d);
                    return (
                      <button
                        key={d}
                        type="button"
                        onClick={() => {
                          if (isTgt) setCloneTargetDays(cloneTargetDays.filter(td => td !== d));
                          else setCloneTargetDays([...cloneTargetDays, d]);
                        }}
                        className={`p-2.5 rounded-xl text-left border transition text-xs flex items-center justify-between ${
                          isTgt
                            ? 'bg-indigo-50 border-indigo-300 text-indigo-900 font-bold shadow-xs'
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <span>{d}</span>
                        {isTgt && <Check className="w-3.5 h-3.5 text-indigo-600" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCloneModal(false)}
                  className="text-xs px-3.5 py-2 text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={cloneTargetDays.length === 0}
                  className="btn-dark-pill text-xs font-bold px-4 py-2 rounded-2xl transition disabled:opacity-40 shadow-sm"
                >
                  Clone Schedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
