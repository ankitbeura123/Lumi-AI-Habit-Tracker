import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  Clock, 
  Calendar, 
  CheckCircle2, 
  Sliders, 
  X, 
  Plus, 
  Trash2, 
  Zap, 
  AlertCircle,
  Layers,
  ArrowRight,
  Check
} from 'lucide-react';

function minutesToTime(mins) {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function timeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const parts = timeStr.split(':');
  return parseInt(parts[0], 10) * 60 + parseInt(parts[1] || '0', 10);
}

function formatDuration(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h} hour${h > 1 ? 's' : ''}`;
  return `${m} mins`;
}

export default function HabitCustomizerModal({ 
  isOpen, 
  onClose, 
  habitProposal, 
  freeSlots = {}, 
  onConfirm 
}) {
  if (!isOpen || !habitProposal) return null;

  const targetTotalMinutes = habitProposal.duration_minutes || 60;
  const habitBaseName = habitProposal.name || 'Study Habit';
  const initialTime = habitProposal.target_time || '08:00';

  // Extract all unique free slots across the week
  const allGaps = freeSlots['Monday'] || freeSlots['Tuesday'] || freeSlots['Wednesday'] || [
    { start: '07:00', end: '09:00', duration_minutes: 120 },
    { start: '13:00', end: '17:00', duration_minutes: 240 },
    { start: '19:00', end: '23:00', duration_minutes: 240 }
  ];

  // User-defined sessions list: [{ id, name, startTimeMinutes, durationMinutes }]
  const [sessions, setSessions] = useState([
    {
      id: 1,
      name: `${habitBaseName} (Session 1)`,
      startTimeMinutes: timeToMinutes(initialTime),
      durationMinutes: Math.min(targetTotalMinutes, 60)
    }
  ]);

  const [frequency, setFrequency] = useState(habitProposal.frequency || 'daily');

  // Reset sessions on proposal change
  useEffect(() => {
    if (habitProposal) {
      if (targetTotalMinutes >= 120) {
        const half = Math.floor(targetTotalMinutes / 2);
        const secondStart = (timeToMinutes(initialTime) + 360) % 1440;
        setSessions([
          { id: 1, name: `${habitBaseName} (Morning)`, startTimeMinutes: timeToMinutes(initialTime), durationMinutes: half },
          { id: 2, name: `${habitBaseName} (Evening)`, startTimeMinutes: secondStart, durationMinutes: targetTotalMinutes - half }
        ]);
      } else {
        setSessions([
          { id: 1, name: habitBaseName, startTimeMinutes: timeToMinutes(initialTime), durationMinutes: targetTotalMinutes }
        ]);
      }
      setFrequency(habitProposal.frequency || 'daily');
    }
  }, [habitProposal]);

  const totalAllocatedMinutes = sessions.reduce((sum, s) => sum + s.durationMinutes, 0);
  const remainingMinutes = targetTotalMinutes - totalAllocatedMinutes;
  const progressPercent = Math.min(100, Math.round((totalAllocatedMinutes / targetTotalMinutes) * 100));

  const handleUpdateSession = (id, field, value) => {
    setSessions(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const handleAddSession = (presetStart = null, presetDuration = null) => {
    const nextId = (sessions[sessions.length - 1]?.id || 0) + 1;
    const defaultStart = presetStart !== null ? presetStart : ((sessions[sessions.length - 1]?.startTimeMinutes || 480) + 180) % 1440;
    const defaultDur = presetDuration !== null ? presetDuration : Math.max(15, Math.min(60, remainingMinutes > 0 ? remainingMinutes : 30));
    setSessions(prev => [
      ...prev,
      {
        id: nextId,
        name: `${habitBaseName} (Part ${nextId})`,
        startTimeMinutes: defaultStart,
        durationMinutes: defaultDur
      }
    ]);
  };

  const handleRemoveSession = (id) => {
    if (sessions.length === 1) return;
    setSessions(prev => prev.filter(s => s.id !== id));
  };

  const handleQuickFillGap = (gap) => {
    const gapStartMin = timeToMinutes(gap.start);
    const fitDuration = Math.min(gap.duration_minutes, remainingMinutes > 0 ? remainingMinutes : 45);
    handleAddSession(gapStartMin, fitDuration);
  };

  const handleFinalSubmit = (e) => {
    e.preventDefault();
    if (sessions.length === 1) {
      onConfirm({
        name: sessions[0].name,
        target_time: minutesToTime(sessions[0].startTimeMinutes),
        duration_minutes: sessions[0].durationMinutes,
        frequency
      });
    } else {
      onConfirm(
        {
          name: sessions[0].name,
          target_time: minutesToTime(sessions[0].startTimeMinutes),
          duration_minutes: sessions[0].durationMinutes,
          frequency
        },
        {
          name: sessions[1].name,
          target_time: minutesToTime(sessions[1].startTimeMinutes),
          duration_minutes: sessions[1].durationMinutes,
          frequency
        }
      );
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4">
      <div className="glass-card-elevated max-w-2xl w-full p-6 rounded-3xl border border-slate-200/90 space-y-5 shadow-2xl animate-slide-up max-h-[92vh] overflow-y-auto text-slate-900">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-600 shadow-sm">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 font-['Outfit']">Interactive Habit Customizer &amp; Splitter</h3>
              <p className="text-[11px] text-slate-500">
                Split <strong className="text-slate-800">"{habitBaseName}"</strong> into custom sessions or align with open free gaps.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Goal Budget Tracker */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-600" />
              <span className="font-bold text-slate-900">Daily Target: {formatDuration(targetTotalMinutes)}</span>
            </div>
            <div className="font-mono text-xs font-bold text-purple-700">
              Allocated: {formatDuration(totalAllocatedMinutes)} / {formatDuration(targetTotalMinutes)} ({progressPercent}%)
            </div>
          </div>

          <div className="space-y-1">
            <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
              <div
                className={`h-2.5 rounded-full transition-all duration-300 ${
                  totalAllocatedMinutes === targetTotalMinutes 
                    ? 'bg-emerald-500'
                    : totalAllocatedMinutes > targetTotalMinutes 
                    ? 'bg-amber-500' 
                    : 'bg-purple-600'
                }`}
                style={{ width: `${Math.min(100, progressPercent)}%` }}
              />
            </div>
            
            <div className="flex justify-between text-[11px]">
              <span className="text-slate-500">
                {sessions.length} custom block{sessions.length > 1 ? 's' : ''} configured
              </span>
              <span className={`font-bold flex items-center gap-1 ${
                remainingMinutes === 0 ? 'text-emerald-600' : remainingMinutes > 0 ? 'text-purple-700' : 'text-amber-600'
              }`}>
                {remainingMinutes === 0 ? (
                  <>
                    <Check className="w-3 h-3" />
                    <span>100% Target Met!</span>
                  </>
                ) : remainingMinutes > 0 ? (
                  `${remainingMinutes} mins remaining to allocate`
                ) : (
                  `${Math.abs(remainingMinutes)} mins over target`
                )}
              </span>
            </div>
          </div>
        </div>

        {/* Real Free Schedule Gaps Discovered */}
        <div className="p-3.5 rounded-2xl bg-purple-50 border border-purple-200 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-purple-800 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-purple-600" />
              <span>Your Verified Open Free Windows:</span>
            </span>
            <span className="text-[10px] text-slate-500 font-mono">Click a gap to add a block inside it</span>
          </div>

          <div className="flex flex-wrap gap-2">
            {allGaps.map((gap, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleQuickFillGap(gap)}
                className="text-xs px-3 py-1.5 rounded-xl bg-white hover:bg-purple-100 text-slate-800 hover:text-purple-900 border border-slate-200 hover:border-purple-300 transition flex items-center gap-1.5 group shadow-sm"
              >
                <Clock className="w-3 h-3 text-purple-600 group-hover:scale-110 transition" />
                <span className="font-bold">{gap.start} – {gap.end}</span>
                <span className="text-[10px] bg-purple-50 px-1.5 py-0.2 rounded text-purple-700 border border-purple-200">
                  {gap.duration_minutes}m free
                </span>
                <Plus className="w-3 h-3 text-purple-600 opacity-70" />
              </button>
            ))}
          </div>
        </div>

        {/* Configurable Session Blocks Form */}
        <form onSubmit={handleFinalSubmit} className="space-y-4">
          <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
            {sessions.map((s, index) => {
              const startStr = minutesToTime(s.startTimeMinutes);
              const endMin = (s.startTimeMinutes + s.durationMinutes) % 1440;
              const endStr = minutesToTime(endMin);

              return (
                <div
                  key={s.id}
                  className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3 relative group shadow-sm"
                >
                  {/* Block Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-purple-100 text-purple-700 text-[11px] font-extrabold flex items-center justify-center">
                        {index + 1}
                      </span>
                      <input
                        type="text"
                        value={s.name}
                        onChange={(e) => handleUpdateSession(s.id, 'name', e.target.value)}
                        className="bg-transparent font-bold text-slate-900 text-xs border-b border-transparent hover:border-purple-400 focus:border-purple-400 focus:outline-none px-1"
                        placeholder="Session Name"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-purple-800 bg-white px-2.5 py-0.5 rounded-lg border border-slate-200">
                        {startStr} &rarr; {endStr} ({formatDuration(s.durationMinutes)})
                      </span>
                      {sessions.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveSession(s.id)}
                          className="text-slate-400 hover:text-rose-600 p-1 transition"
                          title="Remove block"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Start Time Slider */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-slate-600">
                      <span>Start Time: <strong className="text-slate-900">{startStr}</strong></span>
                      <span>End: <strong className="text-slate-900">{endStr}</strong></span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1410"
                      step="15"
                      value={s.startTimeMinutes}
                      onChange={(e) => handleUpdateSession(s.id, 'startTimeMinutes', parseInt(e.target.value))}
                      className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
                    />
                  </div>

                  {/* Duration Slider */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-slate-600">
                      <span>Duration:</span>
                      <span className="font-bold text-purple-700">{s.durationMinutes} mins ({formatDuration(s.durationMinutes)})</span>
                    </div>
                    <input
                      type="range"
                      min="15"
                      max={Math.max(180, targetTotalMinutes)}
                      step="15"
                      value={s.durationMinutes}
                      onChange={(e) => handleUpdateSession(s.id, 'durationMinutes', parseInt(e.target.value))}
                      className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
                    />
                  </div>

                </div>
              );
            })}
          </div>

          {/* Add Another Time Block Button */}
          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={() => handleAddSession()}
              className="text-xs font-bold px-3 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 border border-slate-200 transition flex items-center gap-1.5 shadow-sm"
            >
              <Plus className="w-3.5 h-3.5 text-purple-600" />
              <span>+ Add Another Free Time Block</span>
            </button>

            {/* Repeat Frequency */}
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-500 font-medium">Frequency:</span>
              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1 text-slate-900 text-xs focus:outline-none focus:border-purple-500"
              >
                <option value="daily">Daily (All 7 Days)</option>
                <option value="weekdays">Weekdays Only</option>
                <option value="weekends">Weekends Only</option>
              </select>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="text-xs px-3.5 py-2 text-slate-600 hover:text-slate-900 transition font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-dark-pill text-xs font-bold px-5 py-2.5 rounded-xl transition flex items-center gap-1.5 shadow-sm"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Lock In Custom Allocation</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
