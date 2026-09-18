import React, { useMemo } from 'react';
import { Clock, Sun, Moon, Sparkles, Plus, Minus, ArrowRight } from 'lucide-react';

function timeToMins(timeStr) {
  if (!timeStr) return 0;
  const parts = timeStr.split(':');
  return (parseInt(parts[0], 10) || 0) * 60 + (parseInt(parts[1], 10) || 0);
}

function minsToTime(minutes) {
  let m = ((minutes % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

function format12Hour(timeStr) {
  if (!timeStr) return '';
  const [hStr, mStr] = timeStr.split(':');
  let h = parseInt(hStr, 10);
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${mStr} ${ampm}`;
}

export default function TimeRangeSlider({
  startTime,
  endTime,
  onChangeStart,
  onChangeEnd,
  accentColor = '#9333ea'
}) {
  const startMins = useMemo(() => timeToMins(startTime), [startTime]);
  const endMins = useMemo(() => timeToMins(endTime), [endTime]);

  // Calculate duration
  const { durationMins, durationText, isOvernight } = useMemo(() => {
    let dur = endMins - startMins;
    const overnight = dur < 0;
    if (overnight) {
      dur += 1440;
    }
    const hours = Math.floor(dur / 60);
    const mins = dur % 60;
    let text = '';
    if (hours > 0 && mins > 0) text = `${hours}h ${mins}m`;
    else if (hours > 0) text = `${hours}h`;
    else text = `${mins}m`;

    return { durationMins: dur, durationText: text, isOvernight: overnight };
  }, [startMins, endMins]);

  // Handle step adjustments
  const adjustDuration = (deltaMins) => {
    let newEnd = (endMins + deltaMins + 1440) % 1440;
    onChangeEnd(minsToTime(newEnd));
  };

  const snapDuration = (targetHours) => {
    const targetMins = targetHours * 60;
    const newEnd = (startMins + targetMins) % 1440;
    onChangeEnd(minsToTime(newEnd));
  };

  return (
    <div className="space-y-3.5 bg-slate-50 p-4 rounded-2xl border border-slate-200">
      
      {/* Visual Time Range Header & Badges */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm">
            <Moon className="w-3.5 h-3.5 text-purple-600" />
            <div className="text-left">
              <span className="text-[9px] uppercase font-bold text-slate-400 block leading-none">Start</span>
              <span className="text-xs font-extrabold text-slate-900 font-mono">{format12Hour(startTime)}</span>
            </div>
          </div>

          <ArrowRight className="w-3.5 h-3.5 text-slate-400" />

          <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm">
            <Sun className="w-3.5 h-3.5 text-amber-500" />
            <div className="text-left">
              <span className="text-[9px] uppercase font-bold text-slate-400 block leading-none">End</span>
              <span className="text-xs font-extrabold text-slate-900 font-mono">{format12Hour(endTime)}</span>
            </div>
          </div>
        </div>

        {/* Dynamic Duration Badge */}
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-xl bg-purple-50 text-purple-700 border border-purple-200 shadow-sm">
            <Clock className="w-3.5 h-3.5 text-purple-600" />
            <span>{durationText}</span>
          </div>
          {isOvernight && (
            <span className="text-[10px] font-bold px-2 py-1 rounded-xl bg-slate-200 text-slate-700 flex items-center gap-1">
              <Moon className="w-2.5 h-2.5" />
              <span>Next Day</span>
            </span>
          )}
        </div>
      </div>

      {/* Dual Handle Slider Track */}
      <div className="space-y-2 pt-1">
        <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
          <span>12:00 AM</span>
          <span>06:00 AM</span>
          <span>12:00 PM</span>
          <span>06:00 PM</span>
          <span>11:59 PM</span>
        </div>

        {/* Custom Slider Controls */}
        <div className="space-y-2.5">
          <div className="space-y-1">
            <div className="flex justify-between text-[11px] font-semibold text-slate-700">
              <span>Start Time:</span>
              <span className="font-mono text-purple-700 font-bold">{format12Hour(startTime)}</span>
            </div>
            <input
              type="range"
              min="0"
              max="1439"
              step="15"
              value={startMins}
              onChange={(e) => onChangeStart(minsToTime(parseInt(e.target.value, 10)))}
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
            />
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-[11px] font-semibold text-slate-700">
              <span>End Time:</span>
              <span className="font-mono text-amber-600 font-bold">{format12Hour(endTime)}</span>
            </div>
            <input
              type="range"
              min="0"
              max="1439"
              step="15"
              value={endMins}
              onChange={(e) => onChangeEnd(minsToTime(parseInt(e.target.value, 10)))}
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-amber-500"
            />
          </div>
        </div>
      </div>

      {/* Quick Duration Snap Buttons */}
      <div className="pt-2 border-t border-slate-200 flex flex-wrap items-center justify-between gap-1.5">
        <div className="flex items-center gap-1">
          <span className="text-[10px] uppercase font-bold text-slate-500 mr-1">Quick Snap:</span>
          {[0.5, 1, 1.5, 2, 3, 4, 8].map((h) => (
            <button
              key={h}
              type="button"
              onClick={() => snapDuration(h)}
              className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-white hover:bg-purple-50 text-slate-700 hover:text-purple-700 border border-slate-200 hover:border-purple-300 transition shadow-sm"
            >
              {h >= 1 ? `${h}h` : `${h * 60}m`}
            </button>
          ))}
        </div>

        {/* Step Micro Adjustments */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => adjustDuration(-15)}
            className="p-1 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 transition shadow-sm"
            title="Shorten by 15 mins"
          >
            <Minus className="w-3 h-3" />
          </button>
          <span className="text-[10px] text-slate-500 font-mono">15m</span>
          <button
            type="button"
            onClick={() => adjustDuration(15)}
            className="p-1 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 transition shadow-sm"
            title="Extend by 15 mins"
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>
      </div>

    </div>
  );
}
