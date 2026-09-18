import React, { useState } from 'react';
import { 
  Bot, 
  Sparkles, 
  Flame, 
  CheckCircle2, 
  XCircle, 
  RefreshCw, 
  Calendar, 
  Clock, 
  Smile, 
  Zap, 
  ArrowRight, 
  HeartHandshake,
  X 
} from 'lucide-react';
import { PERSONALITIES, getPersonalityIcon } from './PersonalityModal';
import LumiMascot from './LumiMascot';

export default function AvatarCompanion({
  habits = [],
  onCheckin,
  onOpenChatWithPrompt,
  proactiveSuggestion,
  personality = 'enthusiastic'
}) {
  const activePersona = PERSONALITIES.find(p => p.id === personality) || PERSONALITIES[0];
  const PersonaIcon = getPersonalityIcon(personality);
  const [selectedHabitForCheckin, setSelectedHabitForCheckin] = useState(null);
  const [missReasonStep, setMissReasonStep] = useState(false);
  const [selectedReason, setSelectedReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [celebrateEffect, setCelebrateEffect] = useState(false);

  const activeHabit = habits[0] || null;

  const handleStartCheckin = (habit) => {
    setSelectedHabitForCheckin(habit);
    setMissReasonStep(false);
    setSelectedReason('');
    setCustomReason('');
  };

  const handleCompleteHabit = async () => {
    if (!selectedHabitForCheckin) return;
    setCelebrateEffect(true);
    await onCheckin(selectedHabitForCheckin.id, true);
    setTimeout(() => {
      setCelebrateEffect(false);
      setSelectedHabitForCheckin(null);
    }, 1500);
  };

  const handleMissReasonSubmit = async (e) => {
    e.preventDefault();
    if (!selectedHabitForCheckin) return;
    const finalReason = selectedReason || customReason || 'Had schedule conflict';
    await onCheckin(selectedHabitForCheckin.id, false, finalReason);
    setSelectedHabitForCheckin(null);
    setMissReasonStep(false);
  };

  return (
    <div className="glass-card p-5 rounded-3xl border border-slate-200/90 relative overflow-hidden space-y-4 shadow-sm">
      
      {/* Background ambient glow */}
      <div className="absolute -top-12 -right-12 w-48 h-48 bg-gradient-to-br from-indigo-200/30 to-purple-200/30 rounded-full blur-3xl pointer-events-none" />

      {/* Companion Avatar Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        
        {/* Avatar Graphic & Dialogue */}
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="relative shrink-0">
            <div className="w-12 h-12 rounded-2xl overflow-hidden ring-2 ring-indigo-200/80 shadow-xs bg-white border border-slate-200/80 flex items-center justify-center">
              <LumiMascot className="w-full h-full object-cover" />
            </div>
            <span className="absolute -bottom-1 -right-1 flex h-3.5 w-3.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-indigo-600 border-2 border-white"></span>
            </span>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="font-extrabold text-sm text-slate-900 font-['Outfit']">Lumi AI &bull; Live Companion</h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200 flex items-center gap-1">
                <PersonaIcon className="w-3 h-3 text-purple-600" />
                <span>{activePersona.name}</span>
              </span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed font-medium">
              {activePersona.sampleVoice}
            </p>
          </div>
        </div>

        {/* Quick Interaction Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => onOpenChatWithPrompt("How is my routine looking today?")}
            className="text-xs font-bold px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 border border-slate-200 flex items-center gap-1.5 transition shadow-sm"
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-600" />
            <span>Chat with Lumi</span>
          </button>
        </div>

      </div>


      {/* 1-Tap Check-in Prompt Bar for next habit */}
      {habits.length > 0 && (
        <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-xs text-slate-500">
            <span className="font-semibold text-slate-900">Daily Check-in: </span>
            <span>Select a habit to record progress (+50 XP) or report friction:</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {habits.slice(0, 3).map((h) => (
              <button
                key={h.id}
                onClick={() => handleStartCheckin(h)}
                className="text-xs font-bold px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-purple-50 border border-slate-200 hover:border-purple-300 text-slate-700 hover:text-purple-700 transition flex items-center gap-1.5 shadow-sm"
              >
                <Clock className="w-3 h-3 text-purple-600" />
                <span>{h.name}</span>
                <span className="text-[10px] font-mono text-purple-600">({h.target_time})</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Interactive Check-in Modal Dialog */}
      {selectedHabitForCheckin && (
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xl space-y-3 text-slate-900 animate-slide-up">
          {!missReasonStep ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div className="flex items-center gap-2">
                  <Flame className="w-4 h-4 text-amber-500 fill-amber-500" />
                  <h4 className="font-bold text-xs sm:text-sm text-slate-900">
                    Check-in: {selectedHabitForCheckin.name} ({selectedHabitForCheckin.target_time})
                  </h4>
                </div>
                <button
                  onClick={() => setSelectedHabitForCheckin(null)}
                  className="text-slate-400 hover:text-slate-700 p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-xs text-slate-600">
                Did you complete your <strong>{selectedHabitForCheckin.duration_minutes}m</strong> session today?
              </p>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleCompleteHabit}
                  className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition shadow-sm"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Yes, Completed (+50 XP)</span>
                </button>

                <button
                  onClick={() => setMissReasonStep(true)}
                  className="flex-1 py-2 rounded-xl bg-slate-50 hover:bg-rose-50 text-slate-700 hover:text-rose-700 font-bold text-xs flex items-center justify-center gap-1.5 transition border border-slate-200"
                >
                  <XCircle className="w-4 h-4 text-rose-500" />
                  <span>Missed / Struggled</span>
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleMissReasonSubmit} className="space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h4 className="font-bold text-xs sm:text-sm text-slate-900">
                  What caused the friction today?
                </h4>
                <button
                  type="button"
                  onClick={() => setMissReasonStep(false)}
                  className="text-xs text-slate-500 hover:text-slate-900 font-bold"
                >
                  Back
                </button>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {[
                  "Classes / Work ran late",
                  "Felt too tired / low energy",
                  "Habit duration too long",
                  "Unexpected emergency",
                  "Forgot schedule"
                ].map((reason, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedReason(reason)}
                    className={`text-xs px-2.5 py-1.5 rounded-lg border transition ${
                      selectedReason === reason
                        ? 'bg-purple-600 text-white border-purple-600 font-bold'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {reason}
                  </button>
                ))}
              </div>

              <input
                type="text"
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder="Or type what happened..."
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 outline-none focus:border-purple-500 text-slate-900 bg-slate-50"
              />

              <div className="flex items-center justify-end gap-2">
                <button
                  type="submit"
                  className="btn-dark-pill px-4 py-2 rounded-xl text-xs font-bold transition shadow-sm"
                >
                  Submit &amp; Adapt Routine
                </button>
              </div>
            </form>
          )}
        </div>
      )}

    </div>
  );
}

