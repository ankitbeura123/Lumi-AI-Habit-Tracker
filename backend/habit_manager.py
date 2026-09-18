import os
import json
from datetime import datetime, timedelta
from db import get_db_connection, log_behavior_event, ensure_user_exists
import schedule_manager

_CUSTOM_MISTRAL_API_KEY = None

def set_custom_mistral_api_key(api_key):
    global _CUSTOM_MISTRAL_API_KEY
    _CUSTOM_MISTRAL_API_KEY = api_key.strip() if api_key else None

def get_mistral_client():
    api_key = _CUSTOM_MISTRAL_API_KEY or os.environ.get("MISTRAL_API_KEY")
    if not api_key:
        return None
    try:
        from mistralai import Mistral
        return Mistral(api_key=api_key)
    except Exception as e:
        print(f"Warning: Failed to initialize Mistral client: {e}")
        return None

def call_mistral_llm(system_prompt, messages, model="mistral-small-latest", max_tokens=600):
    client = get_mistral_client()
    if client:
        try:
            formatted_messages = [{"role": "system", "content": system_prompt}] + messages
            response = client.chat.complete(
                model=model,
                messages=formatted_messages,
                max_tokens=max_tokens,
                temperature=0.3
            )
            return response.choices[0].message.content
        except Exception as e:
            print(f"Mistral API error: {e}")
    return None

def extract_json_from_text(text):
    """Safely extracts JSON object from LLM markdown response."""
    if not text:
        return None
    text = text.strip()
    if "```json" in text:
        text = text.split("```json")[1].split("```")[0].strip()
    elif "```" in text:
        text = text.split("```")[1].split("```")[0].strip()
    try:
        return json.loads(text)
    except Exception:
        # Try to find { ... }
        start = text.find("{")
        end = text.rfind("}")
        if start != -1 and end != -1:
            try:
                return json.loads(text[start:end+1])
            except Exception:
                pass
    return None

def extract_duration_minutes(text):
    """
    Parses natural language duration expressions such as:
    - '2 hours', '2 hrs', '2 hr', '2h' -> 120
    - '1.5 hours', '1.5 hrs', '1.5h' -> 90
    - '90 mins', '90 minutes', '45 min', '30m' -> 90, 45, 30
    - '1 hour', '1 hr', '1h' -> 60
    Returns integer minutes, or default 30 if no duration found.
    """
    if not text:
        return 30
    import re
    t = text.lower()
    
    # 1. Decimal or integer hours: "1.5 hours", "2 hrs", "2.5h", "2 hours", "1 hr"
    hour_match = re.search(r'(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|hr|h)\b', t)
    if hour_match:
        try:
            return int(float(hour_match.group(1)) * 60)
        except Exception:
            pass

    # 2. Minutes: "45 minutes", "90 mins", "30 min", "20m"
    min_match = re.search(r'(\d+)\s*(?:minutes?|mins?|min|m)\b', t)
    if min_match:
        try:
            return int(min_match.group(1))
        except Exception:
            pass

    return 30

def generate_candidate_windows(user_id, requested_duration, weekly_free_slots=None, db_path=None):
    """
    Generates 3-4 realistic candidate time windows across distinct times of day:
    - 🌅 Morning (06:00 - 11:00)
    - ☀️ Midday / Afternoon (11:00 - 15:00)
    - 🌇 Late Afternoon / Evening (15:00 - 19:00)
    - 🌙 Night (19:00 - 23:00)
    """
    periods = [
        {"period": "Morning", "emoji": "🌅", "default_start": "07:00", "min_h": 6, "max_h": 11},
        {"period": "Afternoon", "emoji": "☀️", "default_start": "12:00", "min_h": 11, "max_h": 15},
        {"period": "Evening", "emoji": "🌇", "default_start": "16:00", "min_h": 15, "max_h": 19},
        {"period": "Night", "emoji": "🌙", "default_start": "19:30", "min_h": 19, "max_h": 23},
    ]
    
    windows = []
    for p in periods:
        start_time = p["default_start"]
        # Check if weekly_free_slots has a matching slot in this period
        if weekly_free_slots:
            for day, slots in weekly_free_slots.items():
                for s in slots:
                    s_min = schedule_manager.time_to_minutes(s["start"])
                    s_hour = s_min // 60
                    if p["min_h"] <= s_hour < p["max_h"] and s["duration_minutes"] >= min(requested_duration, 30):
                        start_time = s["start"]
                        break
                if start_time != p["default_start"]:
                    break
        
        s_min = schedule_manager.time_to_minutes(start_time)
        e_min = (s_min + requested_duration) % 1440
        end_time = schedule_manager.minutes_to_time(e_min)
        
        dur_hrs = requested_duration / 60.0
        dur_str = f"{int(dur_hrs)}h" if requested_duration % 60 == 0 else f"{dur_hrs:.1f}h".replace(".0", "") if requested_duration >= 60 else f"{requested_duration}m"
        
        windows.append({
            "period": p["period"],
            "emoji": p["emoji"],
            "start": start_time,
            "end": end_time,
            "label": f"{p['emoji']} {start_time}–{end_time}",
            "full_label": f"{p['emoji']} {p['period']} ({start_time} - {end_time})",
            "duration_minutes": requested_duration,
            "duration_label": dur_str
        })
    return windows

def clean_habit_name(text):
    """
    Cleans raw user input or conversational requests into a concise, professional habit title.
    Example:
    - 'Ok add a habit of yoga' -> 'Yoga'
    - 'Make Habit Of Meditation Hr' -> 'Meditation'
    - 'make habit of meditation from 1 to 2' -> 'Meditation'
    - 'Start a habit named" meditation "' -> 'Meditation'
    - 'can you please add a new habit of journaling for 15 mins everyday' -> 'Daily Journaling'
    - 'I want to study 3 hours daily' -> 'Deep Study Session'
    - 'add habit: coding' -> 'Daily Coding Sprint'
    """
    if not text:
        return "Daily Habit"
    
    import re
    t = text.strip()
    
    # 1. Check for explicit quotes or named/called/title patterns
    quote_match = re.search(r'(?:named|called|title|titled|habit\s*:)\s*[:"\'\s]+([^"\'\n\r]+)["\']?', t, re.IGNORECASE)
    if quote_match:
        cand = quote_match.group(1).strip()
        cand = re.sub(r'\b(?:from\s+)?\d{1,2}(?::\d{2})?\s*(?:am|pm)?\s*(?:to|-|until|till)\s*\d{1,2}(?::\d{2})?\s*(?:am|pm)?\b.*$', '', cand, flags=re.IGNORECASE).strip()
        cand = re.sub(r'\b(?:for\s+)?\d+(?:\.\d+)?\s*(?:hours?|hrs?|hr|minutes?|mins?|min|h|m)\b.*$', '', cand, flags=re.IGNORECASE).strip()
        cand = re.sub(r'\b(?:at|around|from)\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?\b.*$', '', cand, flags=re.IGNORECASE).strip()
        cand = re.sub(r'\b(daily|everyday|weekdays|weekends|every day|every night|every morning|every evening)\b.*$', '', cand, flags=re.IGNORECASE).strip()
        cand = re.sub(r'\b(?:on\s+)?(?:mondays?|tuesdays?|wednesdays?|thursdays?|fridays?|saturdays?|sundays?)\b.*$', '', cand, flags=re.IGNORECASE).strip()
        cand = re.sub(r'\b(?:hr|hrs|hours?|mins?|minutes?)\b.*$', '', cand, flags=re.IGNORECASE).strip()
        cand = re.sub(r'["\'`]+', '', cand).strip()
        if cand and len(cand) >= 2:
            cand_lower = cand.lower()
            if cand_lower in ["meditate", "meditation"]:
                return "Meditation"
            elif cand_lower in ["yoga"]:
                return "Yoga"
            elif cand_lower in ["study", "studying"]:
                return "Deep Study Session"
            elif cand_lower in ["workout", "exercise", "gym"]:
                return "Daily Workout"
            elif cand_lower in ["read", "reading"]:
                return "Daily Reading"
            elif cand_lower in ["code", "coding"]:
                return "Daily Coding Sprint"
            return cand.title()

    # 2. General cleaning: Iteratively strip conversational starter prefixes
    clean = t
    for _ in range(4):
        clean = re.sub(
            r'^(?:ok(?:ay)?|hey|hi|hello|please|can you(?: please)?|could you(?: please)?|let\'?s|i want to|i\'?d like to|i need to|i would like to|help me|i\'?m looking to|want to|wanna)\s+',
            '', clean, flags=re.IGNORECASE
        ).strip()
        clean = re.sub(
            r'^(?:add|create|start|track|build|develop|setup|set up|make|schedule|establish|record|do|practice|have)\s+',
            '', clean, flags=re.IGNORECASE
        ).strip()
        clean = re.sub(
            r'^(?:a|an|another|new|my|our|some|the)\s+',
            '', clean, flags=re.IGNORECASE
        ).strip()
        clean = re.sub(
            r'^(?:habit|routine|session|activity|task)\s+',
            '', clean, flags=re.IGNORECASE
        ).strip()
        clean = re.sub(
            r'^(?:of|for|to|named|called|titled|about|on|with|:|is|-)\s+',
            '', clean, flags=re.IGNORECASE
        ).strip()

    # Clean quotes & backticks
    clean = re.sub(r'["\'`]+', '', clean).strip()

    # Remove trailing time ranges, durations, frequencies, days, bare units
    clean = re.sub(r'\b(?:from\s+)?\d{1,2}(?::\d{2})?\s*(?:am|pm)?\s*(?:to|-|until|till)\s*\d{1,2}(?::\d{2})?\s*(?:am|pm)?\b.*$', '', clean, flags=re.IGNORECASE).strip()
    clean = re.sub(r'\b(?:for\s+)?\d+(?:\.\d+)?\s*(?:hours?|hrs?|hr|minutes?|mins?|min|h|m)\b.*$', '', clean, flags=re.IGNORECASE).strip()
    clean = re.sub(r'\b(?:at|around|from)\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?\b.*$', '', clean, flags=re.IGNORECASE).strip()
    clean = re.sub(r'\b(daily|everyday|weekdays|weekends|every day|every night|every morning|every evening)\b.*$', '', clean, flags=re.IGNORECASE).strip()
    clean = re.sub(r'\b(?:on\s+)?(?:mondays?|tuesdays?|wednesdays?|thursdays?|fridays?|saturdays?|sundays?)\b.*$', '', clean, flags=re.IGNORECASE).strip()
    clean = re.sub(r'\b(?:hr|hrs|hours?|mins?|minutes?)\b.*$', '', clean, flags=re.IGNORECASE).strip()
    clean = re.sub(r'\b(for|at|in|on|to|a|an|the|my|and|of|from)\s*$', '', clean, flags=re.IGNORECASE).strip()
    clean = re.sub(r'^(for|to|at|my|of|a|an|the|from)\s+', '', clean, flags=re.IGNORECASE).strip()

    clean_lower = clean.lower().strip()

    if clean_lower in ["study", "studying"]:
        return "Deep Study Session"
    elif clean_lower in ["workout", "working out", "exercise", "exercising", "gym"]:
        return "Daily Workout"
    elif clean_lower in ["dance", "dancing"]:
        return "Dance Session"
    elif clean_lower in ["code", "coding", "programming"]:
        return "Daily Coding Sprint"
    elif clean_lower in ["read", "reading", "book", "reading books"]:
        return "Daily Reading"
    elif clean_lower in ["meditate", "meditation"]:
        return "Meditation"
    elif clean_lower in ["yoga"]:
        return "Yoga"
    elif clean_lower in ["journal", "journaling"]:
        return "Daily Journaling"
    elif clean_lower in ["walk", "walking"]:
        return "Daily Walk"
    elif clean_lower in ["run", "running", "jog", "jogging"]:
        return "Running Session"
    elif clean and len(clean) >= 2 and len(clean) <= 45 and not any(neg in clean_lower for neg in ["cant", "can't", "cannot", "couldn't", "couldnt", "unable", "struggle", "fail", "hate", "my habit"]):
        return clean.strip().title()
    else:
        if "meditat" in text.lower():
            return "Meditation"
        elif "yoga" in text.lower():
            return "Yoga"
        elif "study" in text.lower():
            return "Deep Study Session"
        elif "fit" in text.lower() or "workout" in text.lower() or "gym" in text.lower():
            return "Daily Workout"
        elif "read" in text.lower():
            return "Daily Reading"
        elif "code" in text.lower():
            return "Daily Coding Sprint"
        return "Daily Habit"

def extract_habit_details_with_llm(goal_text):
    """Optionally uses Mistral LLM to parse clean habit name and duration if available."""
    client = get_mistral_client()
    if not client:
        return None
    system_prompt = (
        "You are an AI habit assistant. The user wants to establish a habit. "
        "Extract structured JSON with a clean concise habit title and duration. "
        "Return ONLY JSON: {\"name\": \"<concise title, e.g. Yoga, Meditation, Deep Study, Reading, Guitar Practice>\", "
        "\"duration_minutes\": <int or null>}. "
        "CRITICAL: Do NOT keep conversational words (e.g. 'Ok add a habit of yoga' -> 'Yoga')."
    )
    try:
        res = call_mistral_llm(system_prompt, [{"role": "user", "content": goal_text}], max_tokens=150)
        parsed = extract_json_from_text(res)
        if parsed and isinstance(parsed, dict) and parsed.get("name"):
            return parsed
    except Exception as e:
        print(f"Mistral habit extraction notice: {e}")
    return None

def create_habit_from_goal(user_id, goal_text, db_path=None):
    """
    Takes natural language goal, inspects schedule, and returns structured suggestion:
    {name, target_time, duration_minutes, frequency, reasoning, why_bullets, candidate_windows, alternative_slots}.
    DOES NOT save to database automatically - waits for user confirmation!
    """
    import re
    llm_info = extract_habit_details_with_llm(goal_text)
    if llm_info and llm_info.get("name"):
        clean_name = clean_habit_name(llm_info["name"])
        if llm_info.get("duration_minutes"):
            requested_duration = int(llm_info["duration_minutes"])
        else:
            requested_duration = extract_duration_minutes(goal_text)
    else:
        clean_name = clean_habit_name(goal_text)
        requested_duration = extract_duration_minutes(goal_text)

    # Check if user explicitly specified a time range (e.g. "from 1 to 2", "1:00 to 2:00")
    explicit_start = None
    time_matches = re.findall(r'(\d{1,2}(?::\d{2})?\s*(?:am|pm)?|\d{1,2}:\d{2})', goal_text)
    if len(time_matches) >= 2 and any(w in goal_text.lower() for w in ["from", "to", "-"]):
        s_time = schedule_manager.parse_time_str(time_matches[0])
        e_time = schedule_manager.parse_time_str(time_matches[1])
        s_min = schedule_manager.time_to_minutes(s_time)
        e_min = schedule_manager.time_to_minutes(e_time)
        range_dur = (e_min - s_min) % 1440
        if range_dur > 0:
            requested_duration = range_dur
            explicit_start = s_time
    elif len(time_matches) == 1 and any(w in goal_text.lower() for w in ["at", "around", "from"]):
        explicit_start = schedule_manager.parse_time_str(time_matches[0])

    # Fetch schedule and free slots across the week
    weekly_free_slots = {}
    candidate_slots = []
    for day in schedule_manager.DAYS_OF_WEEK:
        slots = schedule_manager.get_free_time_slots(user_id, day, db_path=db_path)
        if slots:
            weekly_free_slots[day] = slots
            for s in slots:
                if s["start"] not in candidate_slots and s["duration_minutes"] >= min(requested_duration, 30):
                    candidate_slots.append(s["start"])

    candidate_windows = generate_candidate_windows(user_id, requested_duration, weekly_free_slots, db_path=db_path)

    suggested_start = explicit_start or (candidate_windows[0]["start"] if candidate_windows else "07:00")
    dur_str = f"{requested_duration // 60}h" if requested_duration >= 60 and requested_duration % 60 == 0 else f"{requested_duration} mins"

    why_bullets = [
        "✓ No schedule conflicts with your recorded commitments",
        f"✓ Large uninterrupted free block ({dur_str} buffer available)",
        "✓ Consistent timing fits long-term habit formation"
    ]

    suggestion = {
        "name": clean_name,
        "target_time": suggested_start,
        "duration_minutes": requested_duration,
        "frequency": "daily",
        "reasoning": f"I suggested {suggested_start} because it has zero conflicts and provides an open {dur_str} block.",
        "why_bullets": why_bullets,
        "candidate_windows": candidate_windows,
        "alternative_slots": [w["start"] for w in candidate_windows]
    }
    return suggestion


def save_confirmed_habit(user_id, name, target_time, duration_minutes, frequency="daily", db_path=None):
    """Saves a confirmed habit into the database with sanitized clean name."""
    ensure_user_exists(user_id, db_path=db_path)
    conn = get_db_connection(db_path)
    cursor = conn.cursor()
    target_time_fmt = schedule_manager.parse_time_str(target_time)
    dur = int(duration_minutes)
    sanitized_name = clean_habit_name(name)
    cursor.execute(
        """INSERT INTO habits (user_id, name, target_time, duration_minutes, frequency, status, created_at, last_modified_at)
           VALUES (?, ?, ?, ?, ?, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)""",
        (user_id, sanitized_name, target_time_fmt, dur, frequency)
    )
    habit_id = cursor.lastrowid
    conn.commit()
    conn.close()

    log_behavior_event(
        user_id,
        "habit_created",
        {"habit_id": habit_id, "name": sanitized_name, "target_time": target_time_fmt, "duration_minutes": dur, "frequency": frequency},
        db_path=db_path
    )

    # Automatically add habit block to the weekly schedule matrix
    try:
        start_m = schedule_manager.time_to_minutes(target_time_fmt)
        end_m = (start_m + dur) % 1440
        end_time_fmt = schedule_manager.minutes_to_time(end_m)
        days_target = "all" if frequency in ["daily", "everyday"] else ("weekdays" if frequency == "weekdays" else ("weekends" if frequency == "weekends" else "all"))
        schedule_manager.add_batch_schedule_blocks(
            user_id=user_id,
            days=days_target,
            start=target_time_fmt,
            end=end_time_fmt,
            label=f"🎯 {sanitized_name}",
            is_free_time=False,
            db_path=db_path
        )
    except Exception as e:
        print(f"Note: Could not sync habit block to schedule: {e}")

    return habit_id


def get_active_habits(user_id, db_path=None):
    """Fetches active habits for a user with streak calculations."""
    conn = get_db_connection(db_path)
    cursor = conn.cursor()
    cursor.execute(
        """SELECT id, user_id, name, target_time, duration_minutes, frequency, status, created_at, last_modified_at
           FROM habits 
           WHERE user_id = ? AND status = 'active'
           ORDER BY target_time ASC""",
        (user_id,)
    )
    habits = [dict(r) for r in cursor.fetchall()]
    conn.close()

    streaks = get_habit_streaks(user_id, db_path=db_path)
    for h in habits:
        h_streak = streaks.get(h["id"], {"current_streak": 0, "best_streak": 0, "total_completions": 0, "total_missed": 0})
        h["current_streak"] = h_streak["current_streak"]
        h["best_streak"] = h_streak["best_streak"]
        h["total_completions"] = h_streak["total_completions"]
        h["total_missed"] = h_streak["total_missed"]

    return habits

def get_habit_by_id(habit_id, db_path=None):
    conn = get_db_connection(db_path)
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM habits WHERE id = ?", (habit_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None

def suggest_reschedule(habit_id, reason, db_path=None):
    """
    Calls Mistral with the habit's history + updated free time slots, returns a new suggested time/duration.
    """
    habit = get_habit_by_id(habit_id, db_path=db_path)
    if not habit:
        return None

    user_id = habit["user_id"]
    weekly_free_slots = {}
    for day in schedule_manager.DAYS_OF_WEEK:
        slots = schedule_manager.get_free_time_slots(user_id, day, db_path=db_path)
        if slots:
            weekly_free_slots[day] = slots

    # Fetch last 7 checkins
    conn = get_db_connection(db_path)
    cursor = conn.cursor()
    cursor.execute(
        """SELECT date, completed, reason_if_missed, adapted_duration 
           FROM checkins 
           WHERE habit_id = ? 
           ORDER BY date DESC LIMIT 7""",
        (habit_id,)
    )
    checkin_history = [dict(r) for r in cursor.fetchall()]
    conn.close()

    system_prompt = (
        "You are an AI Habit Companion. A habit needs rescheduling due to a schedule conflict or user request. "
        "Examine the habit, check-in history, conflict reason, and available free time slots. "
        "Return ONLY a valid JSON object with:\n"
        "{\n"
        '  "new_target_time": "HH:MM",\n'
        '  "new_duration_minutes": integer,\n'
        '  "reasoning": "Clear explanation of why this new time avoids conflicts and keeps momentum."\n'
        "}"
    )

    user_prompt = (
        f"Habit: {habit['name']} (Current Time: {habit['target_time']}, Duration: {habit['duration_minutes']}m)\n"
        f"Reason for reschedule: {reason}\n"
        f"Recent check-ins: {json.dumps(checkin_history)}\n"
        f"Available Free Time Slots: {json.dumps(weekly_free_slots)}"
    )

    llm_resp = call_mistral_llm(
        system_prompt=system_prompt,
        messages=[{"role": "user", "content": user_prompt}]
    )
    parsed = extract_json_from_text(llm_resp)

    if not parsed or not isinstance(parsed, dict) or "new_target_time" not in parsed:
        # Fallback slot
        free_mon = weekly_free_slots.get("Monday", [])
        fallback_time = free_mon[0]["start"] if free_mon else "18:00"
        parsed = {
            "new_target_time": fallback_time,
            "new_duration_minutes": habit["duration_minutes"],
            "reasoning": f"Moved to {fallback_time} to avoid the scheduled conflict while preserving your habit duration."
        }

    parsed["habit_id"] = habit_id
    parsed["habit_name"] = habit["name"]
    return parsed

def adapt_habit(habit_id, reason, db_path=None):
    """
    Calls Mistral with: habit details, last 7 days of checkins, the reason given.
    Returns an adjusted duration/time. Updates habits table. Logs to behavior_log as 'habit_adapted'.
    """
    habit = get_habit_by_id(habit_id, db_path=db_path)
    if not habit:
        return None

    user_id = habit["user_id"]
    conn = get_db_connection(db_path)
    cursor = conn.cursor()
    cursor.execute(
        """SELECT date, completed, reason_if_missed, adapted_duration 
           FROM checkins 
           WHERE habit_id = ? 
           ORDER BY date DESC LIMIT 7""",
        (habit_id,)
    )
    checkins = [dict(r) for r in cursor.fetchall()]
    conn.close()

    system_prompt = (
        "You are an AI habit optimization expert. The user missed their habit or is struggling. "
        "Analyze the habit, recent checkins, and reason given. Adapt the habit (e.g. reduce duration by 20-50% "
        "to lower resistance, or shift the start time slightly if timing was an issue) to make it achievable. "
        "Return ONLY a JSON object:\n"
        "{\n"
        '  "adapted_duration_minutes": integer,\n'
        '  "adapted_target_time": "HH:MM",\n'
        '  "adaptation_message": "Friendly, encouraging explanation of the micro-adjustment made to help you succeed."\n'
        "}"
    )

    user_prompt = (
        f"Habit: {habit['name']} (Time: {habit['target_time']}, Duration: {habit['duration_minutes']}m)\n"
        f"Missed Reason: {reason}\n"
        f"Last 7 days check-ins: {json.dumps(checkins)}"
    )

    llm_resp = call_mistral_llm(
        system_prompt=system_prompt,
        messages=[{"role": "user", "content": user_prompt}]
    )
    parsed = extract_json_from_text(llm_resp)

    curr_dur = habit["duration_minutes"]
    if not parsed or not isinstance(parsed, dict) or "adapted_duration_minutes" not in parsed:
        # Fallback reduction: step down duration to reduce friction
        new_dur = max(10, int(curr_dur * 0.7))
        parsed = {
            "adapted_duration_minutes": new_dur,
            "adapted_target_time": habit["target_time"],
            "adaptation_message": f"Adjusted duration down to {new_dur} minutes to lower friction and keep your streak momentum going."
        }

    new_dur = int(parsed["adapted_duration_minutes"])
    new_time = schedule_manager.parse_time_str(parsed.get("adapted_target_time", habit["target_time"]))

    # Update habit in DB
    conn = get_db_connection(db_path)
    cursor = conn.cursor()
    cursor.execute(
        """UPDATE habits 
           SET duration_minutes = ?, target_time = ?, last_modified_at = CURRENT_TIMESTAMP 
           WHERE id = ?""",
        (new_dur, new_time, habit_id)
    )
    conn.commit()
    conn.close()

    log_behavior_event(
        user_id,
        "habit_adapted",
        {
            "habit_id": habit_id,
            "habit_name": habit["name"],
            "previous_duration": curr_dur,
            "new_duration": new_dur,
            "new_target_time": new_time,
            "reason": reason,
            "adaptation_message": parsed.get("adaptation_message", "")
        },
        db_path=db_path
    )

    return parsed

def record_checkin(habit_id, completed, reason_if_missed=None, checkin_date=None, db_path=None):
    """
    Inserts into checkins. If completed=False, calls adapt_habit().
    If completed=True, calculates streaks and logs milestones.
    """
    if checkin_date is None:
        checkin_date = datetime.now().strftime("%Y-%m-%d")

    habit = get_habit_by_id(habit_id, db_path=db_path)
    if not habit:
        raise ValueError(f"Habit with ID {habit_id} not found.")

    user_id = habit["user_id"]
    conn = get_db_connection(db_path)
    cursor = conn.cursor()

    # Check if a checkin already exists for this habit on this date
    cursor.execute("SELECT id FROM checkins WHERE habit_id = ? AND date = ?", (habit_id, checkin_date))
    existing = cursor.fetchone()

    adapted_info = None
    if not completed:
        adapted_info = adapt_habit(habit_id, reason_if_missed or "Missed session", db_path=db_path)
        adapted_dur = adapted_info["adapted_duration_minutes"] if adapted_info else None
    else:
        adapted_dur = None

    if existing:
        cursor.execute(
            """UPDATE checkins 
               SET completed = ?, reason_if_missed = ?, adapted_duration = ?, created_at = CURRENT_TIMESTAMP
               WHERE id = ?""",
            (1 if completed else 0, reason_if_missed if not completed else None, adapted_dur, existing["id"])
        )
        checkin_id = existing["id"]
    else:
        cursor.execute(
            """INSERT INTO checkins (habit_id, date, completed, reason_if_missed, adapted_duration)
               VALUES (?, ?, ?, ?, ?)""",
            (habit_id, checkin_date, 1 if completed else 0, reason_if_missed if not completed else None, adapted_dur)
        )
        checkin_id = cursor.lastrowid

    conn.commit()
    conn.close()

    if not completed:
        log_behavior_event(
            user_id,
            "habit_missed",
            {"habit_id": habit_id, "habit_name": habit["name"], "date": checkin_date, "reason": reason_if_missed},
            db_path=db_path
        )
    else:
        # Check streak milestones
        streaks = get_habit_streaks(user_id, db_path=db_path)
        curr_streak = streaks.get(habit_id, {}).get("current_streak", 0)
        if curr_streak in [3, 7, 14, 21, 30, 50, 100]:
            log_behavior_event(
                user_id,
                "streak_milestone",
                {"habit_id": habit_id, "habit_name": habit["name"], "milestone_days": curr_streak},
                db_path=db_path
            )

    return {
        "checkin_id": checkin_id,
        "habit_id": habit_id,
        "date": checkin_date,
        "completed": completed,
        "adapted_info": adapted_info
    }

def get_habit_streaks(user_id, db_path=None):
    """
    Computes current streak and best streak per habit from real checkins table data.
    """
    conn = get_db_connection(db_path)
    cursor = conn.cursor()
    cursor.execute(
        """SELECT c.habit_id, c.date, c.completed 
           FROM checkins c
           JOIN habits h ON c.habit_id = h.id
           WHERE h.user_id = ?
           ORDER BY c.habit_id, c.date ASC""",
        (user_id,)
    )
    rows = cursor.fetchall()
    conn.close()

    # Group by habit
    habit_checkins = {}
    for r in rows:
        hid = r["habit_id"]
        if hid not in habit_checkins:
            habit_checkins[hid] = []
        habit_checkins[hid].append({"date": r["date"], "completed": bool(r["completed"])})

    streaks = {}
    today_str = datetime.now().strftime("%Y-%m-%d")
    yesterday_str = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")

    for hid, records in habit_checkins.items():
        total_comp = sum(1 for rec in records if rec["completed"])
        total_miss = sum(1 for rec in records if not rec["completed"])

        best_streak = 0
        current_running = 0
        
        # Sort distinct dates
        records_sorted = sorted(records, key=lambda x: x["date"])
        
        for i, rec in enumerate(records_sorted):
            if rec["completed"]:
                if i > 0:
                    prev_date = datetime.strptime(records_sorted[i-1]["date"], "%Y-%m-%d")
                    curr_date = datetime.strptime(rec["date"], "%Y-%m-%d")
                    # consecutive day check
                    if (curr_date - prev_date).days == 1 and records_sorted[i-1]["completed"]:
                        current_running += 1
                    else:
                        current_running = 1
                else:
                    current_running = 1
                best_streak = max(best_streak, current_running)
            else:
                current_running = 0

        # Current streak: look backwards from today/yesterday
        active_current_streak = 0
        date_map = {rec["date"]: rec["completed"] for rec in records}

        # Check if completed today or yesterday
        check_date = datetime.now().date()
        if today_str not in date_map or not date_map[today_str]:
            # Maybe checked yesterday
            check_date = (datetime.now() - timedelta(days=1)).date()

        while True:
            d_str = check_date.strftime("%Y-%m-%d")
            if d_str in date_map and date_map[d_str]:
                active_current_streak += 1
                check_date = check_date - timedelta(days=1)
            else:
                break

        streaks[hid] = {
            "current_streak": active_current_streak,
            "best_streak": best_streak,
            "total_completions": total_comp,
            "total_missed": total_miss
        }

    return streaks
