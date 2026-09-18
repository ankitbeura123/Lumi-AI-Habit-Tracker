import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, 
  Sparkles, 
  Clock, 
  Calendar, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  ArrowRight, 
  RefreshCw, 
  Zap, 
  Timer, 
  HeartHandshake, 
  Trash2, 
  Check, 
  X, 
  ArrowUp, 
  SlidersHorizontal 
} from 'lucide-react';
import LumiMascot from './LumiMascot';
import HabitCustomizerModal from './HabitCustomizerModal';

export default function ChatView({ 
  messages, 
  onSendMessage, 
  isLoading, 
  onConfirmHabit, 
  onSimulateFollowup, 
  habits = [], 
  freeSlots = {}, 
  userId 
}) {
  const [inputText, setInputText] = useState('');
  const [selectedSlotForHabit, setSelectedSlotForHabit] = useState(null);
  const [customizingProposal, setCustomizingProposal] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (!inputText.trim() || isLoading) return;
    onSendMessage(inputText.trim());
    setInputText('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleQuickPrompt = (promptText) => {
    onSendMessage(promptText);
  };

  const handleSelectSlot = (slotTime) => {
    setSelectedSlotForHabit(slotTime);
  };

  const handleDirectConfirm = (proposalData) => {
    const finalData = {
      ...proposalData,
      target_time: selectedSlotForHabit || proposalData.target_time
    };
    onConfirmHabit(finalData);
    setSelectedSlotForHabit(null);
  };

  // 4 Primary Habit Tracking & Adaptation Prompt Tiles
  const promptTiles = [
    {
      title: "Discover Best Free Time Slots",
      description: "Analyze daily schedule to find low-friction windows for habits",
      prompt: "When is my diurnal free time and what habits fit best in my schedule?"
    },
    {
      title: "Design 20-Min Atomic Habit",
      description: "Create a progressive routine tailored to your morning or evening",
      prompt: "I want to build a 20-minute daily reading habit in my evening free slot"
    },
    {
      title: "Adapt to Missed Routine",
      description: "Recalibrate habit timings without streak shame when life gets busy",
      prompt: "I missed my habit today because work ran late. How can we adapt?"
    },
    {
      title: "Habit Momentum Analysis",
      description: "Review consistency velocity, streak resilience, and energy patterns",
      prompt: "Analyze my habit consistency patterns and suggest adaptive improvements"
    }
  ];

  return (
    <div className="flex flex-1 w-full h-full overflow-hidden bg-transparent relative">
      
      {/* Habit Customizer & Timing Slider Modal */}
      <HabitCustomizerModal
        isOpen={Boolean(customizingProposal)}
        onClose={() => setCustomizingProposal(null)}
        habitProposal={customizingProposal}
        freeSlots={freeSlots}
        onConfirm={(h1, h2) => {
          onConfirmHabit(h1, h2);
          setCustomizingProposal(null);
        }}
      />

      {/* =========================================================
          Clean Full-Width Center Canvas with Ambient Mesh Gradient
          ========================================================= */}
      <main className="flex-1 flex flex-col h-full overflow-hidden lumi-center-canvas relative w-full">
        
        {/* Canvas Body (Hero with 2x2 cards OR Conversation Thread) */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 flex flex-col justify-between">
          
          {/* -------------------------------------------------------------
              HERO VIEW (Clean, No-sidebar, Minimalist layout)
              ------------------------------------------------------------- */}
          {messages.length === 0 ? (
            <div className="max-w-3xl w-full mx-auto flex flex-col items-center text-center my-auto space-y-6 animate-fade-in pt-4 sm:pt-8">
              
              {/* Center Mascot Badge */}
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-white shadow-md border border-slate-200/90 overflow-hidden flex items-center justify-center transition transform hover:scale-105 mx-auto shrink-0 p-0.5">
                <LumiMascot className="w-full h-full object-cover rounded-full" />
              </div>

              {/* Serif Headline & Subtitle */}
              <div className="space-y-2.5 max-w-xl">
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-normal text-slate-900 font-editorial tracking-tight">
                  What habit would you like to build today?
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 leading-relaxed font-normal">
                  Discover optimal 24h diurnal time slots, dynamically adapt to daily schedule friction, or optimize habit routines with Lumi AI.
                </p>
              </div>

              {/* 2x2 Prompt Tile Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 w-full text-left pt-2">
                {promptTiles.map((tile, idx) => (
                  <div
                    key={idx}
                    onClick={() => handleQuickPrompt(tile.prompt)}
                    className="prompt-tile-card p-4.5 rounded-2xl cursor-pointer group flex flex-col justify-between min-h-[96px]"
                  >
                    <div>
                      <h3 className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition">
                        {tile.title}
                      </h3>
                      <p className="text-[11px] sm:text-xs text-slate-500 mt-1 leading-snug">
                        {tile.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

            </div>
          ) : (
            /* -------------------------------------------------------------
                CONVERSATION STREAM VIEW
                ------------------------------------------------------------- */
            <div className="max-w-3xl w-full mx-auto space-y-6 py-4">
              {messages.map((msg, index) => {
                const isUser = msg.role === 'user';
                const action = msg.action_payload;

                return (
                  <div
                    key={index}
                    className={`flex gap-3.5 ${isUser ? 'ml-auto flex-row-reverse max-w-xl' : 'mr-auto max-w-2xl'}`}
                  >
                    {/* Avatar */}
                    <div className="shrink-0 mt-0.5">
                      {isUser ? (
                        <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-bold shadow-sm">
                          U
                        </div>
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-white border border-slate-200 overflow-hidden flex items-center justify-center shadow-xs">
                          <LumiMascot className="w-full h-full object-cover" />
                        </div>
                      )}
                    </div>

                    {/* Message Content */}
                    <div className="space-y-3 flex-1">
                      <div
                        className={`p-4 rounded-3xl text-xs sm:text-sm leading-relaxed transition-all shadow-xs ${
                          isUser
                            ? 'bg-slate-900 text-white rounded-tr-sm ml-auto'
                            : 'glass-card text-slate-800 rounded-tl-sm border border-slate-200/90'
                        }`}
                      >
                        <div className="whitespace-pre-wrap">{msg.content}</div>
                      </div>

                      {/* Interactive Habit Proposal Card Payload */}
                      {action && action.type === 'PROPOSE_HABIT' && (
                        <div className="glass-card-elevated p-5 rounded-3xl border border-indigo-200 text-slate-900 space-y-4 animate-slide-up shadow-md">
                          <div className="flex items-center justify-between border-b border-indigo-100 pb-2.5">
                            <div className="flex items-center gap-2">
                              <Sparkles className="w-4 h-4 text-indigo-600" />
                              <span className="font-extrabold text-xs font-['Outfit'] text-indigo-950 uppercase tracking-wider">
                                Adaptive Habit Proposal
                              </span>
                            </div>
                            <span className="text-[10px] font-mono bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full font-bold">
                              Confidence: {Math.round((action.data?.confidence_score || 0.9) * 100)}%
                            </span>
                          </div>

                          <div className="space-y-1">
                            <h4 className="font-extrabold text-sm sm:text-base text-slate-900">
                              {action.data?.name}
                            </h4>
                            <p className="text-xs text-slate-600 leading-relaxed">
                              {action.data?.why_this_habit}
                            </p>
                          </div>

                          {/* Metric Pill Grid */}
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                            <div className="p-2.5 rounded-2xl bg-slate-50 border border-slate-200">
                              <span className="text-[10px] text-slate-400 block">Target Time</span>
                              <span className="font-bold text-slate-900 font-mono">
                                {selectedSlotForHabit || action.data?.target_time || "18:00"}
                              </span>
                            </div>
                            <div className="p-2.5 rounded-2xl bg-slate-50 border border-slate-200">
                              <span className="text-[10px] text-slate-400 block">Duration</span>
                              <span className="font-bold text-slate-900 font-mono">
                                {action.data?.duration_minutes || 15} mins
                              </span>
                            </div>
                            <div className="p-2.5 rounded-2xl bg-slate-50 border border-slate-200 col-span-2 sm:col-span-1">
                              <span className="text-[10px] text-slate-400 block">Frequency</span>
                              <span className="font-bold text-slate-900 capitalize font-mono">
                                {action.data?.frequency || "Daily"}
                              </span>
                            </div>
                          </div>

                          {/* Free Time Slot Recommendations */}
                          {action.data?.recommended_slots && action.data.recommended_slots.length > 0 && (
                            <div className="space-y-1.5 pt-1">
                              <label className="text-[11px] font-bold text-indigo-900 block">
                                Recommended Schedule Free Slots:
                              </label>
                              <div className="flex flex-wrap gap-1.5">
                                {action.data.recommended_slots.map((slot, idx) => {
                                  const isSelected = selectedSlotForHabit === slot.start;
                                  return (
                                    <button
                                      key={idx}
                                      type="button"
                                      onClick={() => handleSelectSlot(slot.start)}
                                      className={`text-xs px-2.5 py-1.5 rounded-xl border transition flex items-center gap-1.5 ${
                                        isSelected
                                          ? 'bg-indigo-600 text-white border-indigo-600 font-bold shadow-xs'
                                          : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-300'
                                      }`}
                                    >
                                      <Clock className="w-3 h-3" />
                                      <span>{slot.start} - {slot.end}</span>
                                      <span className="text-[10px] opacity-75 font-mono">({slot.duration_minutes}m)</span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Action Buttons */}
                          <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                            <button
                              onClick={() => handleDirectConfirm(action.data)}
                              className="btn-dark-pill flex-1 py-2.5 rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm"
                            >
                              <Check className="w-4 h-4" />
                              <span>Confirm &amp; Add Habit</span>
                            </button>

                            <button
                              onClick={() => setCustomizingProposal(action.data)}
                              className="px-3.5 py-2.5 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition"
                            >
                              <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
                              <span>Customize</span>
                            </button>
                          </div>

                        </div>
                      )}

                      {/* Adaptive Adjustment / Recalibration Payload */}
                      {action && action.type === 'ADJUST_HABIT' && (
                        <div className="glass-card p-4.5 rounded-3xl border border-purple-200 space-y-3 shadow-sm bg-purple-50/50">
                          <div className="flex items-center gap-2 text-purple-900 font-bold text-xs">
                            <Zap className="w-4 h-4 text-purple-600" />
                            <span>Adaptive Recalibration Activated</span>
                          </div>
                          <p className="text-xs text-slate-700">
                            {action.message || "Your routine has been dynamically adapted to reduce friction while preserving habit consistency."}
                          </p>
                          {action.data && (
                            <div className="text-[11px] font-mono text-purple-800 bg-purple-100/60 p-2.5 rounded-xl border border-purple-200">
                              Updated Timing: {action.data.new_target_time} &bull; Duration: {action.data.new_duration}m
                            </div>
                          )}
                        </div>
                      )}

                    </div>
                  </div>
                );
              })}

              {isLoading && (
                <div className="flex gap-3 max-w-md">
                  <div className="w-8 h-8 rounded-full bg-white border border-slate-200 overflow-hidden flex items-center justify-center shadow-xs shrink-0">
                    <LumiMascot className="w-full h-full object-cover" />
                  </div>
                  <div className="bg-white border border-slate-200 p-3 rounded-2xl rounded-tl-sm flex items-center gap-2 shadow-sm">
                    <RefreshCw className="w-3.5 h-3.5 text-purple-600 animate-spin" />
                    <span className="text-xs text-slate-600 font-medium">Lumi is calculating schedule optimizations...</span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}

          {/* -------------------------------------------------------------
              FLOATING BOTTOM INPUT PILL (Always centered at bottom)
              ------------------------------------------------------------- */}
          <div className="w-full max-w-2xl mx-auto pt-4 pb-2">
            <form
              onSubmit={handleSubmit}
              className="chat-input-pill rounded-full px-4 py-2.5 flex items-center gap-3 relative shadow-lg bg-white/90 border border-slate-200/90"
            >
              <input
                ref={inputRef}
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Message Lumi about your habits, schedule, or daily routines..."
                className="flex-1 bg-transparent text-xs sm:text-sm text-slate-900 placeholder-slate-400 outline-none font-medium px-2"
              />

              <button
                type="submit"
                disabled={!inputText.trim() || isLoading}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-900 hover:text-white disabled:bg-slate-100 disabled:text-slate-300 text-slate-700 flex items-center justify-center transition shadow-xs shrink-0 disabled:cursor-not-allowed"
              >
                <ArrowUp className="w-4 h-4" />
              </button>
            </form>

            <p className="text-[10px] text-center text-slate-400 mt-2 font-normal">
              Lumi AI personalizes habits based on your diurnal calendar &amp; behavior feedback. Routines adjust dynamically.
            </p>
          </div>

        </div>

      </main>

    </div>
  );
}
