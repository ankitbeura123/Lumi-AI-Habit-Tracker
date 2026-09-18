import React, { useState, useEffect } from 'react';
import { ArrowRight, Sparkles, Clock, Calendar, CheckSquare, ShieldCheck, Zap } from 'lucide-react';
import LumiMascot from './LumiMascot';

export default function LandingView({ onStartChat, onOpenSchedule, onOpenHabits, onSeedDemo, gamification = {} }) {
  const fullTitle = "Meet Lumi AI.";
  const fullBody = "Your adaptive AI habit companion. I discover your true 24-hour diurnal free time windows, adapt your routines when life gets messy, and celebrate every win without streak shame.";

  const [displayedTitle, setDisplayedTitle] = useState('');
  const [displayedBody, setDisplayedBody] = useState('');
  const [isTitleDone, setIsTitleDone] = useState(false);
  const [isBodyDone, setIsBodyDone] = useState(false);

  // Typewriter effect for Title
  useEffect(() => {
    let index = 0;
    const titleInterval = setInterval(() => {
      if (index < fullTitle.length) {
        setDisplayedTitle(fullTitle.slice(0, index + 1));
        index++;
      } else {
        clearInterval(titleInterval);
        setIsTitleDone(true);
      }
    }, 45);

    return () => clearInterval(titleInterval);
  }, []);

  // Typewriter effect for Body
  useEffect(() => {
    if (!isTitleDone) return;

    let index = 0;
    const bodyTimeout = setTimeout(() => {
      const bodyInterval = setInterval(() => {
        if (index < fullBody.length) {
          setDisplayedBody(fullBody.slice(0, index + 1));
          index++;
        } else {
          clearInterval(bodyInterval);
          setIsBodyDone(true);
        }
      }, 20);

      return () => clearInterval(bodyInterval);
    }, 150);

    return () => clearTimeout(bodyTimeout);
  }, [isTitleDone]);

  return (
    <div className="max-w-5xl mx-auto py-6 space-y-8 animate-fade-in">
      
      {/* Hero Glassmorphic Card */}
      <div className="glass-card-elevated rounded-3xl p-6 sm:p-10 border border-slate-200/80 text-center space-y-6 shadow-sm relative overflow-hidden">
        
        {/* Subtle Ambient Top Glow */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-48 bg-gradient-to-b from-indigo-200/40 to-transparent blur-3xl pointer-events-none"></div>

        {/* Video Avatar Frame with Glow Aura */}
        <div className="flex justify-center relative">
          <div className="relative group">
            <div className="absolute -inset-2 bg-gradient-to-tr from-indigo-500/20 via-purple-400/20 to-sky-500/20 rounded-3xl blur-lg opacity-70 group-hover:opacity-100 transition duration-500"></div>
            
            <div className="relative w-44 h-44 sm:w-52 sm:h-52 rounded-3xl overflow-hidden border border-slate-200/90 shadow-md bg-slate-900">
              <video 
                src="/lumi-video.mp4" 
                autoPlay 
                loop 
                muted 
                playsInline
                className="w-full h-full object-cover object-center"
              />
              <div className="absolute bottom-2.5 right-2.5 px-2.5 py-0.5 rounded-full bg-slate-900/80 backdrop-blur-md border border-slate-700 flex items-center gap-1.5 shadow">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-400"></span>
                </span>
                <span className="text-[10px] font-bold text-white tracking-wider">LUMI AI</span>
              </div>
            </div>
          </div>
        </div>

        {/* Dynamic Typewriter Headline */}
        <div className="space-y-2 min-h-[100px] flex flex-col justify-center">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-slate-900 font-['Outfit']">
            <span>
              {displayedTitle.startsWith("Meet ") ? (
                <>
                  Meet{" "}
                  <span className="text-indigo-600">
                    {displayedTitle.replace("Meet ", "").replace(".", "")}
                  </span>
                  {displayedTitle.endsWith(".") ? '.' : ''}
                </>
              ) : (
                displayedTitle
              )}
            </span>
            {!isTitleDone && (
              <span className="inline-block w-2.5 h-8 md:h-10 bg-indigo-600 ml-1 animate-pulse rounded-sm" />
            )}
          </h1>

          <p className="text-sm sm:text-base text-slate-600 font-normal leading-relaxed max-w-xl mx-auto">
            <span>{displayedBody}</span>
            {isTitleDone && !isBodyDone && (
              <span className="inline-block w-1.5 h-4 bg-indigo-600 ml-1 animate-pulse align-middle rounded-sm" />
            )}
          </p>
        </div>

        {/* Primary Action Button */}
        <div className={`pt-2 transition-all duration-700 transform ${
          isBodyDone ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'
        }`}>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={() => onStartChat()}
              className="inline-flex items-center gap-2.5 px-8 py-3.5 rounded-2xl font-bold text-sm sm:text-base bg-slate-900 text-white hover:bg-slate-800 transition duration-200 shadow-md transform hover:-translate-y-0.5"
            >
              <Sparkles className="w-4 h-4 text-indigo-300" />
              <span>Start Conversing with Lumi</span>
              <ArrowRight className="w-4 h-4 stroke-[2.5]" />
            </button>

            <button
              onClick={onOpenSchedule}
              className="px-6 py-3.5 rounded-2xl bg-white/90 hover:bg-white border border-slate-200/90 text-slate-800 font-bold text-sm sm:text-base transition shadow-xs"
            >
              View 24h Schedule
            </button>
          </div>
        </div>

      </div>

      {/* 3 Core Value Props in Clean Light Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        <div className="glass-card p-5 rounded-3xl border border-slate-200/90 space-y-2.5 shadow-xs hover:border-indigo-300 hover:shadow-md transition">
          <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
            <Clock className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-slate-900 text-sm font-['Outfit']">Diurnal Time Discovery</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Scans Morning, Afternoon, Evening, and Night gaps to propose realistic, clash-free habit windows.
          </p>
        </div>

        <div className="glass-card p-5 rounded-3xl border border-slate-200/90 space-y-2.5 shadow-xs hover:border-indigo-300 hover:shadow-md transition">
          <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-slate-900 text-sm font-['Outfit']">Permission-Driven Schedule</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Never silently auto-modifies your calendar. Every routine change is presented with conflict analysis for your confirmation.
          </p>
        </div>

        <div className="glass-card p-5 rounded-3xl border border-slate-200/90 space-y-2.5 shadow-xs hover:border-indigo-300 hover:shadow-md transition">
          <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
            <Zap className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-slate-900 text-sm font-['Outfit']">Adaptive Friction Recovery</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Missed a session? Lumi micro-shortens duration or reschedules rather than punishing streaks.
          </p>
        </div>

      </div>

    </div>
  );
}
