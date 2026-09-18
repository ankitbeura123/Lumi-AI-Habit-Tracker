import React from 'react';
import { Zap, HeartHandshake, Sparkles, Shield, CheckCircle2, X, Check } from 'lucide-react';

export const PERSONALITIES = [
  {
    id: 'enthusiastic',
    name: 'High-Energy Hype Coach',
    iconName: 'Zap',
    tagline: 'Upbeat, electrifying, celebrates every small win',
    accentColor: 'from-purple-600 to-indigo-600',
    sampleVoice: '"Let\'s go! You completed that habit! We are locking this in and building unstoppable momentum today!"',
    missReaction: 'Strategic bounce-back: "Breathers are part of progress. We recalibrate and execute tomorrow!"'
  },
  {
    id: 'hopeful',
    name: 'Mindful & Hopeful Partner',
    iconName: 'HeartHandshake',
    tagline: 'Deeply compassionate, calm, sustainable growth',
    accentColor: 'from-emerald-600 to-teal-600',
    sampleVoice: '"Take a deep breath. Every small step is meaningful. Consistency is built day by day."',
    missReaction: 'Warm reassurance: "It is completely okay. Growth is nonlinear. Let us make tomorrow gentle."'
  },
  {
    id: 'dramatic',
    name: 'Empathetic & Caring',
    iconName: 'Sparkles',
    tagline: 'Engaging, deeply supportive, celebrates personal growth',
    accentColor: 'from-rose-600 to-pink-600',
    sampleVoice: '"You finished it! Wonderful progress today. Your routine is steadily taking shape."',
    missReaction: 'Thoughtful care: "I noticed a bump in your routine. Tell me what happened so we can adjust it smoothly."'
  },
  {
    id: 'stoic',
    name: 'Stoic & Disciplined Strategist',
    iconName: 'Shield',
    tagline: 'Direct, analytical, focused on systems, zero fluff',
    accentColor: 'from-slate-700 to-slate-900',
    sampleVoice: '"Schedule allocated. Action precedes motivation. Let us execute."',
    missReaction: 'System recalibration: "Friction analyzed. Scaling back duration to maintain baseline execution."'
  }
];

export function getPersonalityIcon(id) {
  if (id === 'enthusiastic') return Zap;
  if (id === 'hopeful') return HeartHandshake;
  if (id === 'dramatic') return Sparkles;
  if (id === 'stoic') return Shield;
  return Sparkles;
}

export default function PersonalityModal({ 
  isOpen, 
  onClose, 
  currentPersonality, 
  onSelectPersonality 
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/30 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="glass-card-elevated max-w-2xl w-full p-6 rounded-3xl border border-slate-200/80 space-y-5 shadow-2xl animate-slide-up my-8">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-100 flex items-center justify-center text-purple-600 font-bold">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 font-['Outfit']">Select AI Companion Tone</h3>
              <p className="text-[11px] text-slate-500">Choose how Lumi AI guides your daily routine and responds to friction</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Personality Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {PERSONALITIES.map((p) => {
            const isSelected = currentPersonality === p.id;
            const Icon = getPersonalityIcon(p.id);

            return (
              <div
                key={p.id}
                onClick={() => {
                  onSelectPersonality(p.id);
                  onClose();
                }}
                className={`p-4 rounded-2xl border transition-all cursor-pointer space-y-3 relative group ${
                  isSelected
                    ? 'bg-purple-50/70 border-purple-500 ring-1 ring-purple-500 shadow-md'
                    : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/80'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${isSelected ? 'bg-purple-600 text-white' : 'bg-slate-100 text-slate-700'}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">{p.name}</h4>
                      <p className="text-[10px] text-slate-500">{p.tagline}</p>
                    </div>
                  </div>
                  {isSelected && (
                    <span className="w-5 h-5 rounded-full bg-purple-600 text-white flex items-center justify-center text-xs font-bold shadow-sm">
                      <Check className="w-3 h-3" />
                    </span>
                  )}
                </div>

                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-[11px] text-slate-700 italic">
                  {p.sampleVoice}
                </div>

                <div className="text-[10px] text-slate-500 flex items-start gap-1.5 pt-0.5">
                  <span className="font-semibold text-slate-700 shrink-0">On friction:</span>
                  <span>{p.missReaction}</span>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectPersonality(p.id);
                    onClose();
                  }}
                  className={`w-full py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                    isSelected
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{isSelected ? 'Active Tone' : 'Select Tone'}</span>
                </button>
              </div>
            );
          })}
        </div>

        <div className="pt-2 text-center text-[11px] text-slate-400 border-t border-slate-100">
          Lumi adapts dynamically in real-time to your responses across sessions.
        </div>

      </div>
    </div>
  );
}
