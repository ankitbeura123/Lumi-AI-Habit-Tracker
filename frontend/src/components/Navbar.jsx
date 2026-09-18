import React from 'react';
import { 
  Settings,
  MessageSquare
} from 'lucide-react';
import LumiMascot from './LumiMascot';

export default function Navbar({ 
  activeTab, 
  setActiveTab, 
  userId, 
  setUserId, 
  habitsCount, 
  onSeedDemo, 
  backendStatus,
  gamification = {},
  onOpenSettings,
  onNewThread
}) {
  const currentLevel = gamification?.current_level || { level: 1, title: "Explorer", badge: "Level 1" };
  const totalXp = gamification?.total_xp || 0;

  const navItems = [
    { id: 'intro', label: 'Home' },
    { id: 'chat', label: 'Chat' },
    { id: 'habits', label: 'Habits' },
    { id: 'schedule', label: 'Schedule' },
    { id: 'stats', label: 'Analytics' }
  ];

  return (
    <header className="sticky top-0 z-40 px-3 sm:px-6 pt-3 pb-1.5 bg-transparent">
      <div className="max-w-7xl mx-auto glass-navbar-capsule rounded-full px-4 sm:px-6 py-2 flex items-center justify-between gap-4">
        
        {/* Left: Mascot + Brand Name */}
        <div className="flex items-center gap-6">
          <div 
            onClick={() => setActiveTab('intro')}
            className="cursor-pointer flex items-center gap-2.5 group"
          >
            <div className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center shadow-xs group-hover:scale-105 transition bg-white border border-slate-200/80">
              <LumiMascot className="w-full h-full object-cover" />
            </div>
            <span className="font-extrabold text-base tracking-tight text-slate-900 font-['Outfit']">
              Lumi AI
            </span>
          </div>

          {/* Navigation Links - TEXT ONLY (NO ICONS AS REQUESTED) */}
          <nav className="hidden md:flex items-center gap-1 text-xs">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-slate-900 text-white shadow-xs font-bold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Right: Actions & Start Chat Button */}
        <div className="flex items-center gap-2 sm:gap-3">
          
          {/* Settings Trigger */}
          <button
            onClick={onOpenSettings}
            title="Configure Lumi AI"
            className="p-1.5 rounded-full text-slate-500 hover:text-slate-900 hover:bg-white/80 transition"
          >
            <Settings className="w-4 h-4" />
          </button>

          {/* User Rank Indicator */}
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/70 border border-slate-200/80 text-xs backdrop-blur-xs shadow-xs">
            <span className="font-bold text-slate-800">Lvl {currentLevel.level}</span>
            <span className="text-slate-300">&bull;</span>
            <span className="text-slate-500 font-medium">{totalXp} XP</span>
          </div>

          {/* Primary Action Button (like Start Chat in Screenshot) */}
          <button
            onClick={() => {
              setActiveTab('chat');
              if (onNewThread) onNewThread();
            }}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition transform hover:-translate-y-0.5"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Start Chat</span>
          </button>

        </div>

      </div>
    </header>
  );
}
