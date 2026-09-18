import React, { useState, useEffect } from 'react';
import LandingView from './components/LandingView';
import Navbar from './components/Navbar';
import ChatView from './components/ChatView';
import HabitsView from './components/HabitsView';
import ScheduleView from './components/ScheduleView';
import StatsView from './components/StatsView';
import SettingsModal from './components/SettingsModal';
import {
  fetchHealth,
  sendChatMessage,
  simulateFollowup,
  fetchGamification,
  fetchHabits,
  createHabit,
  deleteHabit,
  recordCheckin,
  fetchCheckins,
  fetchSchedule,
  saveScheduleBlock,
  saveBatchScheduleBlocks,
  cloneDaySchedule,
  clearDaySchedule,
  clearAllSchedule,
  deleteScheduleBlock,
  fetchBehaviorPatterns,
  fetchProactiveSuggestion,
  fetchFullChatHistory,
  clearChatHistory,
  seedDemoData
} from './services/api';
import { AlertCircle, CheckCircle2, Trophy, Sparkles } from 'lucide-react';

const USER_ID_STORAGE_KEY = 'habit_companion_user_id';

// Generates a stable, per-browser anonymous user id on first visit and
// reuses it on every subsequent load. This is what keeps each visitor's
// schedule/habits/chat/XP separate without requiring a login screen.
function getOrCreateUserId() {
  try {
    const stored = window.localStorage.getItem(USER_ID_STORAGE_KEY);
    if (stored) return stored;

    const newId =
      'user_' +
      (window.crypto && window.crypto.randomUUID
        ? window.crypto.randomUUID()
        : `${Date.now()}_${Math.random().toString(36).slice(2)}`);

    window.localStorage.setItem(USER_ID_STORAGE_KEY, newId);
    return newId;
  } catch (e) {
    console.warn('localStorage unavailable, using a session-only user id:', e);
    return 'user_' + Math.random().toString(36).slice(2);
  }
}

export default function App() {
  const [userId, setUserId] = useState(getOrCreateUserId);
  const [activeTab, setActiveTab] = useState('intro');
  const [backendStatus, setBackendStatus] = useState(null);
  const [showSettings, setShowSettings] = useState(false);

  // Core Data States
  const [messages, setMessages] = useState([]);
  const [habits, setHabits] = useState([]);
  const [schedule, setSchedule] = useState([]);
  const [freeSlots, setFreeSlots] = useState({});
  const [checkins, setCheckins] = useState([]);
  const [patterns, setPatterns] = useState({});
  const [streaks, setStreaks] = useState({});
  const [chatHistory, setChatHistory] = useState([]);
  const [gamification, setGamification] = useState({});
  const [proactiveSuggestion, setProactiveSuggestion] = useState(null);
  const [personality, setPersonality] = useState(() => {
    try {
      return window.localStorage.getItem('lumi_personality') || 'enthusiastic';
    } catch (e) {
      return 'enthusiastic';
    }
  });

  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success', xpBonus = null) => {
    setToast({ message, type, xpBonus });
    setTimeout(() => setToast(null), 4000);
  };

  const handleSelectPersonality = (pId) => {
    setPersonality(pId);
    try {
      window.localStorage.setItem('lumi_personality', pId);
    } catch (e) {}
    showToast(`Lumi personality switched to ${pId}`, 'info');
  };

  // Load all user data
  const loadAllData = async (uid = userId) => {
    try {
      const [
        healthRes,
        gamifyRes,
        habitsRes,
        scheduleRes,
        checkinsRes,
        behaviorRes,
        proactiveRes,
        chatHistRes
      ] = await Promise.allSettled([
        fetchHealth(),
        fetchGamification(uid),
        fetchHabits(uid),
        fetchSchedule(uid),
        fetchCheckins(uid),
        fetchBehaviorPatterns(uid),
        fetchProactiveSuggestion(uid),
        fetchFullChatHistory(uid)
      ]);

      if (healthRes.status === 'fulfilled') setBackendStatus(healthRes.value);
      if (gamifyRes.status === 'fulfilled') setGamification(gamifyRes.value || {});
      if (habitsRes.status === 'fulfilled') setHabits(habitsRes.value.habits || []);
      if (scheduleRes.status === 'fulfilled') {
        setSchedule(scheduleRes.value.schedule || []);
        setFreeSlots(scheduleRes.value.free_slots || {});
      }
      if (checkinsRes.status === 'fulfilled') setCheckins(checkinsRes.value.checkins || []);
      if (behaviorRes.status === 'fulfilled') {
        setPatterns(behaviorRes.value.patterns || {});
        setStreaks(behaviorRes.value.streaks || {});
      }
      if (proactiveRes.status === 'fulfilled') {
        setProactiveSuggestion(proactiveRes.value.proactive_suggestion || null);
      }
      if (chatHistRes.status === 'fulfilled') {
        const hist = chatHistRes.value.chat_history || [];
        setChatHistory(hist);
        if (messages.length === 0 && hist.length > 0) {
          setMessages(hist.slice(-20));
        }
      }
    } catch (e) {
      console.error('Error loading data:', e);
    }
  };

  useEffect(() => {
    // Reset in-memory chat when switching users (e.g. manual override via
    // Navbar) so a new profile doesn't briefly show the previous user's
    // messages before the fetch resolves.
    setMessages([]);
    loadAllData(userId);
  }, [userId]);

  // Chat Send Handler
  const handleSendMessage = async (msgText) => {
    if (!msgText.trim()) return;

    const userMsg = { role: 'user', message: msgText, created_at: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const res = await sendChatMessage(userId, msgText, personality);
      const assistantMsg = {
        role: 'assistant',
        message: res.reply,
        action_payload: res.action_payload,
        created_at: new Date().toISOString()
      };
      setMessages(prev => [...prev, assistantMsg]);

      // If action payload awarded XP, toast it
      if (res.action_payload?.xp_gained) {
        showToast(`Action recorded! +${res.action_payload.xp_gained} XP earned.`, 'success');
      }

      await loadAllData(userId);
    } catch (err) {
      showToast(err.message || 'Error communicating with AI Companion', 'error');
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          message: `I encountered an issue: ${err.message}. Please verify the backend connection.`,
          created_at: new Date().toISOString()
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // Simulate Habit Time Passed Followup
  const handleSimulateFollowup = async () => {
    try {
      setIsLoading(true);
      const res = await simulateFollowup(userId, null, personality);
      const promptMsg = {
        role: 'assistant',
        message: res.reply,
        action_payload: res.action_payload,
        created_at: new Date().toISOString()
      };
      setMessages(prev => [...prev, promptMsg]);
      showToast('Simulated scheduled habit time passing!', 'info');
      await loadAllData(userId);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Clear Chat History Handler
  const handleClearChat = async () => {
    try {
      await clearChatHistory(userId);
      setMessages([]);
      setChatHistory([]);
      showToast('Chat history cleared', 'info');
      const initialMsg = {
        role: 'assistant',
        message: "Hey there! I'm Lumi, your adaptive habit companion. I've cleared our chat so you have a fresh slate. How can I help you organize your routine today?",
        created_at: new Date().toISOString()
      };
      setMessages([initialMsg]);
    } catch (e) {
      console.error('Failed to clear chat:', e);
      showToast('Failed to clear chat history', 'error');
    }
  };

  // Confirm and save suggested habit(s) from chat
  const handleConfirmHabit = async (habitData, habitData2 = null) => {
    try {
      await createHabit({
        user_id: userId,
        name: habitData.name,
        target_time: habitData.target_time,
        duration_minutes: habitData.duration_minutes,
        frequency: habitData.frequency || 'daily'
      });

      if (habitData2) {
        await createHabit({
          user_id: userId,
          name: habitData2.name,
          target_time: habitData2.target_time,
          duration_minutes: habitData2.duration_minutes,
          frequency: habitData2.frequency || 'daily'
        });
        showToast(`Split habits created and added to schedule! (+100 XP)`, 'success');
        await loadAllData(userId);
        handleSendMessage(`I've confirmed both split sessions: "${habitData.name}" at ${habitData.target_time} and "${habitData2.name}" at ${habitData2.target_time}. Added both to my schedule!`);
      } else {
        showToast(`Habit "${habitData.name}" created and added to schedule! (+50 XP)`, 'success');
        await loadAllData(userId);
        handleSendMessage(`I've confirmed the habit "${habitData.name}" at ${habitData.target_time} for ${habitData.duration_minutes}m. Added to my schedule!`);
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // Add Manual Habit
  const handleAddHabit = async (habitData) => {
    try {
      await createHabit({ ...habitData, user_id: userId });
      showToast(`Habit "${habitData.name}" created! (+20 XP)`, 'success');
      await loadAllData(userId);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // Delete / Pause Habit
  const handleDeleteHabit = async (habitId) => {
    try {
      await deleteHabit(userId, habitId);
      showToast('Habit removed/paused');
      await loadAllData(userId);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // Check-in Record Handler
  const handleCheckin = async (habitId, completed, reason_if_missed = null) => {
    try {
      const res = await recordCheckin({
        habit_id: habitId,
        completed,
        reason_if_missed
      });
      if (completed) {
        showToast('Check-in recorded! (+50 XP)', 'success');
      } else {
        showToast('Friction recorded (+15 XP). AI micro-adapted habit duration for tomorrow.', 'info');
      }
      await loadAllData(userId);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // Schedule Block Add Handler (Single)
  const handleAddScheduleBlock = async (blockData) => {
    try {
      const res = await saveScheduleBlock({ ...blockData, user_id: userId });
      if (res.conflicts && res.conflicts.length > 0) {
        showToast(`Schedule saved! Note: overlaps with habit "${res.conflicts[0].name}"`, 'info');
      } else {
        showToast('Schedule commitment added! +10 XP');
      }
      await loadAllData(userId);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // Batch Schedule Block Add Handler (Multi-day / Everyday)
  const handleAddBatchBlocks = async (batchData) => {
    try {
      const res = await saveBatchScheduleBlocks({ ...batchData, user_id: userId });
      const dayCount = res.days ? res.days.length : 'multiple';
      if (res.conflicts && res.conflicts.length > 0) {
        showToast(`Saved to ${dayCount} days! Overlaps with "${res.conflicts[0].name}"`, 'info');
      } else {
        showToast(`Applied to ${dayCount} days! Recalculating free time gaps.`);
      }
      await loadAllData(userId);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // Clone Day Schedule Handler
  const handleCloneDay = async (cloneData) => {
    try {
      const res = await cloneDaySchedule({ ...cloneData, user_id: userId });
      showToast(`Copied schedule to ${res.targets?.length || 0} days!`);
      await loadAllData(userId);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // Clear Day Handler
  const handleClearDay = async (day) => {
    try {
      await clearDaySchedule(userId, day);
      showToast(`Cleared commitments for ${day}`);
      await loadAllData(userId);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // Clear All Schedule Handler
  const handleClearAllSchedule = async () => {
    try {
      await clearAllSchedule(userId);
      showToast('Weekly schedule cleared');
      await loadAllData(userId);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // Schedule Block Delete Handler
  const handleDeleteScheduleBlock = async (blockId) => {
    try {
      await deleteScheduleBlock(userId, blockId);
      showToast('Schedule commitment removed');
      await loadAllData(userId);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // Seed Demo Data Handler
  const handleSeedDemo = async () => {
    try {
      await seedDemoData(userId);
      showToast('Realistic demo data seeded! 14 days of history & level progression loaded.');
      await loadAllData(userId);
      setActiveTab('stats');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  return (
    <div className={`app-gradient-bg text-slate-900 flex flex-col font-sans selection:bg-purple-100 selection:text-purple-900 relative ${
      activeTab === 'chat' ? 'h-screen max-h-screen overflow-hidden' : 'min-h-screen overflow-x-hidden'
    }`}>
      
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-5 right-5 z-50 animate-slide-up">
          <div className={`p-3.5 px-4 rounded-2xl shadow-xl border flex items-center gap-2.5 text-xs font-semibold ${
            toast.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : toast.type === 'info'
              ? 'bg-purple-50 border-purple-200 text-purple-800'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          }`}>
            {toast.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-rose-500" />
            ) : toast.type === 'info' ? (
              <Sparkles className="w-4 h-4 text-purple-500" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            )}
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        onKeyUpdated={(configured) => {
          setBackendStatus(prev => ({ ...prev, mistral_configured: configured }));
          showToast(configured ? 'Mistral AI Connected!' : 'Mistral API key updated');
        }}
        backendStatus={backendStatus}
        currentPersonality={personality}
        onSelectPersonality={handleSelectPersonality}
      />

      {/* Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        userId={userId}
        setUserId={setUserId}
        habitsCount={habits.length}
        onSeedDemo={handleSeedDemo}
        backendStatus={backendStatus}
        gamification={gamification}
        onOpenSettings={() => setShowSettings(true)}
      />

      {/* Main Tab Content */}
      {activeTab === 'chat' ? (
        <main className="flex-1 w-full h-[calc(100vh-4.25rem)] overflow-hidden flex flex-col">
          <ChatView
            messages={messages}
            onSendMessage={handleSendMessage}
            isLoading={isLoading}
            proactiveSuggestion={proactiveSuggestion}
            onConfirmHabit={handleConfirmHabit}
            onSimulateFollowup={handleSimulateFollowup}
            onClearChat={handleClearChat}
            habits={habits}
            freeSlots={freeSlots}
            personality={personality}
            onSelectPersonality={handleSelectPersonality}
            onOpenSchedule={() => setActiveTab('schedule')}
            onOpenHabits={() => setActiveTab('habits')}
            onOpenStats={() => setActiveTab('stats')}
            onOpenSettings={() => setShowSettings(true)}
            userId={userId}
          />
        </main>
      ) : (
        <main className="flex-1 p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full">
          {activeTab === 'intro' && (
            <LandingView
              onStartChat={(prompt) => {
                setActiveTab('chat');
                if (prompt && typeof prompt === 'string') {
                  handleSendMessage(prompt);
                }
              }}
              onOpenSchedule={() => setActiveTab('schedule')}
              onOpenHabits={() => setActiveTab('habits')}
              onSeedDemo={handleSeedDemo}
              gamification={gamification}
            />
          )}

          {activeTab === 'habits' && (
            <HabitsView
              habits={habits}
              onCheckin={handleCheckin}
              onAddHabit={handleAddHabit}
              onDeleteHabit={handleDeleteHabit}
              proactiveSuggestion={proactiveSuggestion}
              gamification={gamification}
              personality={personality}
              onOpenChatWithPrompt={(prompt) => {
                setActiveTab('chat');
                handleSendMessage(prompt);
              }}
            />
          )}

          {activeTab === 'schedule' && (
            <ScheduleView
              schedule={schedule}
              freeSlots={freeSlots}
              habits={habits}
              onAddBlock={handleAddScheduleBlock}
              onAddBatchBlocks={handleAddBatchBlocks}
              onCloneDay={handleCloneDay}
              onClearDay={handleClearDay}
              onClearAll={handleClearAllSchedule}
              onDeleteBlock={handleDeleteScheduleBlock}
              onDeleteHabit={handleDeleteHabit}
              onOpenChatWithPrompt={(prompt) => {
                setActiveTab('chat');
                handleSendMessage(prompt);
              }}
            />
          )}

          {activeTab === 'stats' && (
            <StatsView
              patterns={patterns}
              streaks={streaks}
              checkins={checkins}
              chatHistory={chatHistory}
              habits={habits}
              gamification={gamification}
            />
          )}
        </main>
      )}

      {/* Footer (Only shown on scrollable non-chat tabs) */}
      {activeTab !== 'chat' && (
        <footer className="py-4 border-t border-slate-100 text-center text-xs text-slate-400">
          Lumi AI &bull; Intelligent Habit &amp; Schedule Companion &bull; Powered by Mistral AI, SQLite &amp; React
        </footer>
      )}
    </div>
  );
}