const BASE_URL = '/api';

export async function fetchHealth() {
  const res = await fetch(`${BASE_URL}/health`);
  if (!res.ok) throw new Error('Backend health check failed');
  return res.json();
}

export async function sendChatMessage(userId, message, personality = 'enthusiastic') {
  const res = await fetch(`${BASE_URL}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, message, personality }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to send message');
  }
  return res.json();
}

export async function simulateFollowup(userId, habitId = null, personality = 'enthusiastic') {
  const res = await fetch(`${BASE_URL}/simulate-followup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, habit_id: habitId, personality }),
  });
  if (!res.ok) throw new Error('Failed to simulate habit follow-up');
  return res.json();
}

export async function configMistralKey(apiKey = null) {
  if (apiKey !== null) {
    const res = await fetch(`${BASE_URL}/config/mistral-key`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: apiKey }),
    });
    if (!res.ok) throw new Error('Failed to configure Mistral API Key');
    return res.json();
  } else {
    const res = await fetch(`${BASE_URL}/config/mistral-key`);
    if (!res.ok) throw new Error('Failed to get Mistral status');
    return res.json();
  }
}

export async function fetchGamification(userId) {
  const res = await fetch(`${BASE_URL}/gamification/${encodeURIComponent(userId)}`);
  if (!res.ok) throw new Error('Failed to fetch gamification data');
  return res.json();
}

export async function fetchHabits(userId) {
  const res = await fetch(`${BASE_URL}/habits/${encodeURIComponent(userId)}`);
  if (!res.ok) throw new Error('Failed to fetch habits');
  return res.json();
}

export async function createHabit(habitData) {
  const res = await fetch(`${BASE_URL}/habits`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(habitData),
  });
  if (!res.ok) throw new Error('Failed to create habit');
  return res.json();
}

export async function deleteHabit(userId, habitId) {
  const res = await fetch(`${BASE_URL}/habits/${encodeURIComponent(userId)}/${habitId}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete habit');
  return res.json();
}

export async function recordCheckin(checkinData) {
  const res = await fetch(`${BASE_URL}/checkins`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(checkinData),
  });
  if (!res.ok) throw new Error('Failed to record checkin');
  return res.json();
}

export async function fetchCheckins(userId) {
  const res = await fetch(`${BASE_URL}/checkins/${encodeURIComponent(userId)}`);
  if (!res.ok) throw new Error('Failed to fetch checkins');
  return res.json();
}

export async function fetchSchedule(userId) {
  const res = await fetch(`${BASE_URL}/schedule/${encodeURIComponent(userId)}`);
  if (!res.ok) throw new Error('Failed to fetch schedule');
  return res.json();
}

export async function saveScheduleBlock(scheduleData) {
  const res = await fetch(`${BASE_URL}/schedule`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(scheduleData),
  });
  if (!res.ok) throw new Error('Failed to save schedule block');
  return res.json();
}

export async function saveBatchScheduleBlocks(batchData) {
  const res = await fetch(`${BASE_URL}/schedule/batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(batchData),
  });
  if (!res.ok) throw new Error('Failed to save batch schedule');
  return res.json();
}

export async function cloneDaySchedule(cloneData) {
  const res = await fetch(`${BASE_URL}/schedule/clone`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cloneData),
  });
  if (!res.ok) throw new Error('Failed to clone day schedule');
  return res.json();
}

export async function clearDaySchedule(userId, day) {
  const res = await fetch(`${BASE_URL}/schedule/${encodeURIComponent(userId)}/day/${encodeURIComponent(day)}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to clear day schedule');
  return res.json();
}

export async function clearAllSchedule(userId) {
  const res = await fetch(`${BASE_URL}/schedule/${encodeURIComponent(userId)}/all`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to clear schedule');
  return res.json();
}

export async function deleteScheduleBlock(userId, blockId) {
  const res = await fetch(`${BASE_URL}/schedule/${encodeURIComponent(userId)}/${blockId}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete schedule block');
  return res.json();
}

export async function fetchBehaviorPatterns(userId) {
  const res = await fetch(`${BASE_URL}/behavior/${encodeURIComponent(userId)}`);
  if (!res.ok) throw new Error('Failed to fetch behavior patterns');
  return res.json();
}

export async function fetchProactiveSuggestion(userId) {
  const res = await fetch(`${BASE_URL}/proactive/${encodeURIComponent(userId)}`);
  if (!res.ok) throw new Error('Failed to fetch proactive suggestion');
  return res.json();
}

export async function fetchFullChatHistory(userId) {
  const res = await fetch(`${BASE_URL}/chat-history/${encodeURIComponent(userId)}`);
  if (!res.ok) throw new Error('Failed to fetch chat history');
  return res.json();
}

export async function clearChatHistory(userId) {
  const res = await fetch(`${BASE_URL}/chat-history/${encodeURIComponent(userId)}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to clear chat history');
  return res.json();
}

export async function seedDemoData(userId) {
  const res = await fetch(`${BASE_URL}/seed-demo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId }),
  });
  if (!res.ok) throw new Error('Failed to seed demo data');
  return res.json();
}
