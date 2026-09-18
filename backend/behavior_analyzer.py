import json
from collections import Counter
from datetime import datetime, timedelta
from db import get_db_connection
import habit_manager
import schedule_manager

DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

def cluster_reasons(reasons):
    """
    Groups raw reason strings into categorized clusters using lightweight keyword matching.
    """
    categories = {
        "Schedule / Class / Work Conflict": ["class", "work", "meeting", "exam", "assignment", "busy", "conflict", "job", "commute", "lab"],
        "Tiredness & Low Energy": ["tired", "sleepy", "exhausted", "energy", "drained", "late night", "burnout"],
        "Forgot / Lost Track of Time": ["forgot", "lost track", "distracted", "overslept", "procrastinated", "remember"],
        "Duration Too Long / Overwhelmed": ["long", "hard", "difficult", "overwhelmed", "too much", "resistance", "heavy"],
        "Health / Personal Emergency": ["sick", "ill", "headache", "doctor", "family", "emergency", "fever"]
    }
    
    counts = Counter()
    for r in reasons:
        if not r:
            continue
        r_lower = r.lower()
        matched = False
        for cat, keywords in categories.items():
            if any(kw in r_lower for kw in keywords):
                counts[cat] += 1
                matched = True
                break
        if not matched:
            counts["Other Friction"] += 1
            
    return dict(counts)

def analyze_patterns(user_id, db_path=None):
    """
    Queries checkins + behavior_log, returns comprehensive pattern analysis.
    """
    conn = get_db_connection(db_path)
    cursor = conn.cursor()
    
    # 1. Fetch all checkins with habit info
    cursor.execute(
        """SELECT c.id, c.habit_id, c.date, c.completed, c.reason_if_missed, c.adapted_duration, h.name as habit_name
           FROM checkins c
           JOIN habits h ON c.habit_id = h.id
           WHERE h.user_id = ?
           ORDER BY c.date ASC""",
        (user_id,)
    )
    checkins = [dict(r) for r in cursor.fetchall()]
    
    # 2. Fetch behavior logs
    cursor.execute(
        """SELECT id, event_type, details, created_at
           FROM behavior_log
           WHERE user_id = ?
           ORDER BY id DESC LIMIT 30""",
        (user_id,)
    )
    behavior_events = [dict(r) for r in cursor.fetchall()]
    conn.close()
    
    if not checkins:
        return {
            "total_checkins": 0,
            "overall_completion_rate": 0,
            "miss_rate_by_day": {d: 0.0 for d in DAY_NAMES},
            "highest_miss_day": None,
            "reason_clusters": {},
            "trend": "no_data",
            "last_7_days_rate": 0.0,
            "prior_7_days_rate": 0.0,
            "recent_events": behavior_events
        }
        
    total_count = len(checkins)
    total_completed = sum(1 for c in checkins if c["completed"])
    overall_rate = round((total_completed / total_count) * 100, 1)
    
    # Miss rates by Day of Week
    day_counts = {d: {"total": 0, "missed": 0} for d in DAY_NAMES}
    missed_reasons = []
    
    for c in checkins:
        try:
            dt = datetime.strptime(c["date"], "%Y-%m-%d")
            day_name = dt.strftime("%A")
            if day_name in day_counts:
                day_counts[day_name]["total"] += 1
                if not c["completed"]:
                    day_counts[day_name]["missed"] += 1
                    if c["reason_if_missed"]:
                        missed_reasons.append(c["reason_if_missed"])
        except Exception:
            continue
            
    miss_rate_by_day = {}
    highest_miss_day = None
    highest_miss_rate = -1.0
    
    for day, stat in day_counts.items():
        if stat["total"] > 0:
            rate = round((stat["missed"] / stat["total"]) * 100, 1)
            miss_rate_by_day[day] = rate
            if rate > highest_miss_rate and stat["missed"] > 0:
                highest_miss_rate = rate
                highest_miss_day = day
        else:
            miss_rate_by_day[day] = 0.0
            
    # Reason clustering
    reason_clusters = cluster_reasons(missed_reasons)
    
    # 7-day vs Prior 7-day trend
    today = datetime.now().date()
    last_7_cutoff = today - timedelta(days=7)
    prior_14_cutoff = today - timedelta(days=14)
    
    last_7_records = []
    prior_7_records = []
    
    for c in checkins:
        try:
            c_date = datetime.strptime(c["date"], "%Y-%m-%d").date()
            if c_date >= last_7_cutoff:
                last_7_records.append(c)
            elif c_date >= prior_14_cutoff:
                prior_7_records.append(c)
        except Exception:
            continue
            
    last_7_rate = round((sum(1 for c in last_7_records if c["completed"]) / len(last_7_records) * 100), 1) if last_7_records else 0.0
    prior_7_rate = round((sum(1 for c in prior_7_records if c["completed"]) / len(prior_7_records) * 100), 1) if prior_7_records else 0.0
    
    if len(last_7_records) == 0 and len(prior_7_records) == 0:
        trend = "no_data"
    elif last_7_rate > prior_7_rate + 5:
        trend = "improving"
    elif last_7_rate < prior_7_rate - 5:
        trend = "declining"
    else:
        trend = "stable"
        
    return {
        "total_checkins": total_count,
        "total_completed": total_completed,
        "overall_completion_rate": overall_rate,
        "miss_rate_by_day": miss_rate_by_day,
        "highest_miss_day": highest_miss_day if highest_miss_rate > 0 else None,
        "highest_miss_rate": highest_miss_rate if highest_miss_rate > 0 else 0,
        "reason_clusters": reason_clusters,
        "trend": trend,
        "last_7_days_rate": last_7_rate,
        "prior_7_days_rate": prior_7_rate,
        "recent_events": behavior_events,
        "time_of_day_stats": calculate_time_of_day_stats(user_id, db_path=db_path)
    }

def calculate_time_of_day_stats(user_id, db_path=None):
    """
    Calculates completion rates by time-of-day:
    - Morning (05:00 - 11:59)
    - Afternoon (12:00 - 16:59)
    - Evening (17:00 - 23:59)
    """
    conn = get_db_connection(db_path)
    cursor = conn.cursor()
    cursor.execute(
        """SELECT c.completed, h.target_time, h.name as habit_name, c.reason_if_missed
           FROM checkins c
           JOIN habits h ON c.habit_id = h.id
           WHERE h.user_id = ?""",
        (user_id,)
    )
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()

    periods = {
        "morning": {"total": 0, "completed": 0, "label": "Morning (05:00-12:00)"},
        "afternoon": {"total": 0, "completed": 0, "label": "Afternoon (12:00-17:00)"},
        "evening": {"total": 0, "completed": 0, "label": "Evening / Night (17:00-24:00)"}
    }

    for r in rows:
        t = r.get("target_time", "08:00")
        try:
            hour = int(t.split(":")[0])
        except Exception:
            hour = 8

        if 5 <= hour < 12:
            period = "morning"
        elif 12 <= hour < 17:
            period = "afternoon"
        else:
            period = "evening"

        periods[period]["total"] += 1
        if r["completed"]:
            periods[period]["completed"] += 1

    stats = {}
    for k, v in periods.items():
        rate = round((v["completed"] / v["total"]) * 100, 1) if v["total"] > 0 else None
        stats[k] = {
            "label": v["label"],
            "total": v["total"],
            "completed": v["completed"],
            "success_rate": rate
        }
    return stats

def get_behavioral_memory_summary(user_id, db_path=None):
    """
    Generates a high-level natural language summary of user's behavioral history
    to ground Lumi's memory (e.g. noticing evening struggles, frequent miss reasons).
    """
    patterns = analyze_patterns(user_id, db_path=db_path)
    tod = patterns.get("time_of_day_stats", {})
    
    memory_points = []
    
    # Check evening vs morning success
    m_rate = tod.get("morning", {}).get("success_rate")
    e_rate = tod.get("evening", {}).get("success_rate")
    
    if m_rate is not None and e_rate is not None:
        if m_rate > e_rate + 25 and e_rate < 50:
            memory_points.append(f"User is much more consistent in mornings ({m_rate}% completion) than evenings ({e_rate}% completion). Evenings frequently get skipped.")
        elif e_rate > m_rate + 25 and m_rate < 50:
            memory_points.append(f"User performs better in evenings ({e_rate}% completion) than mornings ({m_rate}% completion).")
    elif e_rate is not None and e_rate <= 40 and tod.get("evening", {}).get("total", 0) >= 2:
        memory_points.append(f"Evenings haven't worked well recently ({e_rate}% completion over {tod.get('evening', {}).get('total')} sessions).")

    
    # Top miss reasons
    clusters = patterns.get("reason_clusters", {})
    if clusters:
        top_reason = max(clusters.items(), key=lambda x: x[1])
        memory_points.append(f"Top recorded friction cause: '{top_reason[0]}' ({top_reason[1]} times).")
        
    # High miss day
    if patterns.get("highest_miss_day") and patterns.get("highest_miss_rate", 0) >= 30:
        memory_points.append(f"{patterns['highest_miss_day']} is user's most vulnerable day ({patterns['highest_miss_rate']}% miss rate).")

    if not memory_points:
        return "User is starting fresh. No established miss patterns yet."
        
    return " | ".join(memory_points)

def generate_proactive_suggestion(user_id, db_path=None):
    """
    Called periodically or on chat opening.
    Uses analyze_patterns output + Mistral to generate one targeted suggestion if a signal exists.
    """
    patterns = analyze_patterns(user_id, db_path=db_path)
    habits = habit_manager.get_active_habits(user_id, db_path=db_path)
    schedule = schedule_manager.get_user_schedule(user_id, db_path=db_path)
    
    # Check if there is a real friction signal
    has_high_miss_day = patterns.get("highest_miss_day") and patterns.get("highest_miss_rate", 0) >= 30
    has_declining_trend = patterns.get("trend") == "declining"
    has_recurring_reasons = bool(patterns.get("reason_clusters"))
    
    if not (has_high_miss_day or has_declining_trend or has_recurring_reasons or len(habits) > 0):
        return None
        
    system_prompt = (
        "You are an empathetic, proactive AI Habit Coach. Review the user's habit completion patterns, "
        "missed reasons, and weekly schedule. If there is a noticeable friction point or opportunity for optimization, "
        "generate ONE concise (1-2 sentences), highly specific proactive suggestion. "
        "Example: 'You have missed your Tuesday session twice recently — your schedule shows an evening class right before it. Want to shift it to Wednesday at 08:00?' "
        "Keep it friendly, actionable, and grounded in the data."
    )
    
    user_prompt = (
        f"Behavior Patterns:\n{json.dumps(patterns, indent=2)}\n\n"
        f"Active Habits:\n{json.dumps(habits, indent=2)}\n\n"
        f"Weekly Schedule:\n{json.dumps(schedule, indent=2)}"
    )
    
    suggestion_text = habit_manager.call_mistral_llm(
        system_prompt=system_prompt,
        messages=[{"role": "user", "content": user_prompt}],
        max_tokens=200
    )
    
    if not suggestion_text:
        # Fallback heuristic suggestion
        tod = patterns.get("time_of_day_stats", {})
        e_stat = tod.get("evening", {})
        m_stat = tod.get("morning", {})
        if e_stat.get("success_rate") is not None and e_stat["success_rate"] < 40 and m_stat.get("success_rate", 0) >= 70:
            suggestion_text = "I've noticed evenings haven't worked as well recently due to fatigue or late shifts. Would you like to try moving focus sessions to the morning?"
        elif has_high_miss_day:
            day = patterns['highest_miss_day']
            suggestion_text = f"Notice that {day}s have your highest miss rate ({patterns['highest_miss_rate']}%). Would you like to adjust the timing or duration on {day}s?"
        elif patterns.get("trend") == "improving":
            suggestion_text = f"Great momentum! Your completion rate is up to {patterns['last_7_days_rate']}% this week. Keep the streak alive!"
        else:
            suggestion_text = "I'm monitoring your daily rhythm to help keep your habits effortless and adaptive."
            
    return suggestion_text.strip()

