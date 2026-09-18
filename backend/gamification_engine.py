import json
from datetime import datetime
from db import get_db_connection, ensure_user_exists, log_behavior_event
import habit_manager
import schedule_manager

LEVELS = [
    {"level": 1, "title": "Habit Explorer", "min_xp": 0, "max_xp": 150, "badge": "🌱"},
    {"level": 2, "title": "Routine Builder", "min_xp": 150, "max_xp": 400, "badge": "⚡"},
    {"level": 3, "title": "Momentum Master", "min_xp": 400, "max_xp": 800, "badge": "🔥"},
    {"level": 4, "title": "Consistency Champion", "min_xp": 800, "max_xp": 1500, "badge": "🏆"},
    {"level": 5, "title": "Unstoppable Flow", "min_xp": 1500, "max_xp": 3000, "badge": "👑"},
]

BADGES = [
    {
        "id": "first_step",
        "name": "First Step",
        "icon": "🌱",
        "description": "Created your very first habit commitment",
        "category": "habits"
    },
    {
        "id": "streak_3",
        "name": "Ignition Spark",
        "icon": "🔥",
        "description": "Achieved a 3-day consistency streak",
        "category": "streaks"
    },
    {
        "id": "streak_7",
        "name": "Unstoppable Flow",
        "icon": "⚡",
        "description": "Achieved a 7-day consistency streak",
        "category": "streaks"
    },
    {
        "id": "adaptive_mindset",
        "name": "Adaptive Champion",
        "icon": "💡",
        "description": "Adapted a habit after encountering friction",
        "category": "growth"
    },
    {
        "id": "schedule_architect",
        "name": "Schedule Architect",
        "icon": "📅",
        "description": "Mapped out 5+ weekly commitments",
        "category": "schedule"
    },
    {
        "id": "reflection_master",
        "name": "Mindful Reflective",
        "icon": "💬",
        "description": "Shared 5+ reflections with your AI Companion",
        "category": "chat"
    }
]

def get_user_xp_data(user_id, db_path=None):
    """Calculates user's total XP, current Level, progress percentage, and unlocked badges."""
    ensure_user_exists(user_id, db_path=db_path)
    conn = get_db_connection(db_path)
    cursor = conn.cursor()
    
    # 1. Fetch check-ins
    cursor.execute(
        """SELECT c.completed, c.reason_if_missed, c.adapted_duration, c.date
           FROM checkins c
           JOIN habits h ON c.habit_id = h.id
           WHERE h.user_id = ?""",
        (user_id,)
    )
    checkin_rows = cursor.fetchall()
    
    # 2. Fetch habits
    cursor.execute("SELECT id FROM habits WHERE user_id = ?", (user_id,))
    habit_count = len(cursor.fetchall())
    
    # 3. Fetch schedule blocks
    cursor.execute("SELECT id FROM schedule WHERE user_id = ?", (user_id,))
    schedule_count = len(cursor.fetchall())
    
    # 4. Fetch chat interactions
    cursor.execute("SELECT id FROM chat_history WHERE user_id = ? AND role = 'user'", (user_id,))
    chat_count = len(cursor.fetchall())
    
    conn.close()
    
    # Compute base XP
    completed_count = sum(1 for r in checkin_rows if r["completed"])
    missed_with_reflection = sum(1 for r in checkin_rows if not r["completed"] and r["reason_if_missed"])
    
    streaks = habit_manager.get_habit_streaks(user_id, db_path=db_path)
    max_streak = max([s["best_streak"] for s in streaks.values()], default=0)
    
    # XP Math:
    # +50 XP per completed habit checkin
    # +15 XP per mindful reflection when missed
    # +20 XP per habit created
    # +10 XP per schedule block mapped
    # +5 XP per companion chat
    # +50 XP per 3-day streak milestone
    # +100 XP per 7-day streak milestone
    total_xp = (
        (completed_count * 50) +
        (missed_with_reflection * 15) +
        (habit_count * 20) +
        (schedule_count * 10) +
        (chat_count * 5)
    )
    
    if max_streak >= 3:
        total_xp += 50
    if max_streak >= 7:
        total_xp += 100
    if max_streak >= 14:
        total_xp += 150
        
    # Determine Level
    current_level = LEVELS[0]
    next_level = LEVELS[1]
    for i, lvl in enumerate(LEVELS):
        if total_xp >= lvl["min_xp"]:
            current_level = lvl
            next_level = LEVELS[i + 1] if i + 1 < len(LEVELS) else None
            
    if next_level:
        level_range = next_level["min_xp"] - current_level["min_xp"]
        xp_in_level = total_xp - current_level["min_xp"]
        progress_pct = min(100, max(0, int((xp_in_level / level_range) * 100)))
        xp_to_next = next_level["min_xp"] - total_xp
    else:
        progress_pct = 100
        xp_to_next = 0

    # Evaluate Badges
    unlocked_badges = []
    
    if habit_count >= 1:
        unlocked_badges.append("first_step")
    if max_streak >= 3:
        unlocked_badges.append("streak_3")
    if max_streak >= 7:
        unlocked_badges.append("streak_7")
    if missed_with_reflection >= 1:
        unlocked_badges.append("adaptive_mindset")
    if schedule_count >= 5:
        unlocked_badges.append("schedule_architect")
    if chat_count >= 5:
        unlocked_badges.append("reflection_master")

    # Daily Quests (evaluated for today)
    today_str = datetime.now().strftime("%Y-%m-%d")
    today_checkins = [r for r in checkin_rows if r["date"] == today_str]
    has_checked_in_today = len(today_checkins) > 0
    has_chatted_today = chat_count > 0
    has_schedule = schedule_count > 0

    daily_quests = [
        {
            "id": "quest_checkin",
            "title": "Daily Habit Check-in",
            "icon": "🌅",
            "xp": 50,
            "completed": has_checked_in_today,
            "description": "Log at least 1 habit session today"
        },
        {
            "id": "quest_companion",
            "title": "Companion Dialogue",
            "icon": "💬",
            "xp": 25,
            "completed": has_chatted_today,
            "description": "Chat or reflect with your AI Companion"
        },
        {
            "id": "quest_routine",
            "title": "Routine Alignment",
            "icon": "📅",
            "xp": 25,
            "completed": has_schedule,
            "description": "Keep your weekly schedule active and conflict-free"
        }
    ]

    return {
        "total_xp": total_xp,
        "current_level": current_level,
        "next_level": next_level,
        "progress_pct": progress_pct,
        "xp_to_next": xp_to_next,
        "completed_habits_count": completed_count,
        "max_streak": max_streak,
        "all_badges": BADGES,
        "unlocked_badge_ids": unlocked_badges,
        "daily_quests": daily_quests
    }
