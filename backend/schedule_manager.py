import json
from datetime import datetime, time
from db import get_db_connection, log_behavior_event, ensure_user_exists

DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

def parse_time_str(time_str):
    """Parses 'HH:MM', 'H:MM AM/PM', or a bare hour like '9' or '14' into a
    standard 'HH:MM' 24-hour string.

    Bare hours (no colon, no am/pm) are common in casual schedule messages
    like "9-1pm" where only the second number carries the am/pm marker.
    Heuristic: if the bare hour is 13-23 it's already unambiguous 24-hour
    time; if it's 0-12 we assume AM (the far more common case for a bare
    morning-looking number in a class/work schedule).
    """
    time_str = time_str.strip()

    for fmt in ("%H:%M", "%I:%M %p", "%I:%M%p", "%I %p", "%I%p"):
        try:
            dt = datetime.strptime(time_str, fmt)
            return dt.strftime("%H:%M")
        except ValueError:
            pass

    # Bare hour, e.g. "9", "14"
    if time_str.isdigit():
        hour = int(time_str)
        if 13 <= hour <= 23:
            return f"{hour:02d}:00"
        if hour == 0 or hour == 24:
            return "00:00"
        if 1 <= hour <= 12:
            # Assume AM for a bare hour with no meridiem marker.
            return f"{hour:02d}:00" if hour != 12 else "12:00"

    return time_str

def time_to_minutes(time_str):
    """Converts 'HH:MM' to integer minutes from 00:00."""
    try:
        parts = time_str.split(":")
        return int(parts[0]) * 60 + int(parts[1])
    except Exception:
        return 0

def minutes_to_time(minutes):
    """Converts minutes from 00:00 to 'HH:MM' string."""
    h = (minutes // 60) % 24
    m = minutes % 60
    return f"{h:02d}:{m:02d}"

def add_or_update_schedule_block(user_id, day, start, end, label, is_free_time=False, block_id=None, db_path=None):
    """Inserts or updates a schedule row."""
    ensure_user_exists(user_id, db_path=db_path)
    conn = get_db_connection(db_path)
    cursor = conn.cursor()
    
    start_fmt = parse_time_str(start)
    end_fmt = parse_time_str(end)
    day_fmt = day.capitalize()
    
    if block_id:
        cursor.execute(
            """UPDATE schedule 
               SET day_of_week = ?, start_time = ?, end_time = ?, activity_label = ?, is_free_time = ?, updated_at = CURRENT_TIMESTAMP
               WHERE id = ? AND user_id = ?""",
            (day_fmt, start_fmt, end_fmt, label, 1 if is_free_time else 0, block_id, user_id)
        )
        saved_id = block_id
    else:
        cursor.execute(
            """INSERT INTO schedule (user_id, day_of_week, start_time, end_time, activity_label, is_free_time)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (user_id, day_fmt, start_fmt, end_fmt, label, 1 if is_free_time else 0)
        )
        saved_id = cursor.lastrowid
        
    conn.commit()
    conn.close()
    
    log_behavior_event(
        user_id,
        "schedule_changed",
        {"action": "add_or_update", "day": day_fmt, "start": start_fmt, "end": end_fmt, "label": label, "id": saved_id},
        db_path=db_path
    )
    return saved_id

def delete_schedule_block(user_id, block_id, db_path=None):
    """Deletes a schedule block."""
    conn = get_db_connection(db_path)
    cursor = conn.cursor()
    cursor.execute("DELETE FROM schedule WHERE id = ? AND user_id = ?", (block_id, user_id))
    deleted = cursor.rowcount > 0
    conn.commit()
    conn.close()
    if deleted:
        log_behavior_event(
            user_id,
            "schedule_changed",
            {"action": "delete", "block_id": block_id},
            db_path=db_path
        )
    return deleted

def get_user_schedule(user_id, db_path=None):
    """Gets all schedule blocks for a user."""
    conn = get_db_connection(db_path)
    cursor = conn.cursor()
    cursor.execute(
        """SELECT id, user_id, day_of_week, start_time, end_time, activity_label, is_free_time, updated_at
           FROM schedule 
           WHERE user_id = ? 
           ORDER BY 
             CASE day_of_week 
               WHEN 'Monday' THEN 1 
               WHEN 'Tuesday' THEN 2 
               WHEN 'Wednesday' THEN 3 
               WHEN 'Thursday' THEN 4 
               WHEN 'Friday' THEN 5 
               WHEN 'Saturday' THEN 6 
               WHEN 'Sunday' THEN 7 
               ELSE 8 
             END, 
             start_time ASC""",
        (user_id,)
    )
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

def get_free_time_slots(user_id, day, start_boundary="07:00", end_boundary="22:00", db_path=None):
    """Returns free time slots (gaps) in a user's day schedule between boundary hours, handling overnight spans."""
    day_fmt = day.capitalize()
    conn = get_db_connection(db_path)
    cursor = conn.cursor()
    cursor.execute(
        """SELECT start_time, end_time, activity_label, is_free_time 
           FROM schedule 
           WHERE user_id = ? AND day_of_week = ? 
           ORDER BY start_time ASC""",
        (user_id, day_fmt)
    )
    rows = cursor.fetchall()
    conn.close()
    
    # Filter busy blocks only
    busy_intervals = []
    for r in rows:
        if not r["is_free_time"]:
            s_min = time_to_minutes(r["start_time"])
            e_min = time_to_minutes(r["end_time"])
            if e_min > s_min:
                busy_intervals.append((s_min, e_min))
            elif e_min < s_min:
                # Overnight span (e.g. 23:00 to 07:00)
                # Spans from s_min to 1440 (midnight) AND from 0 to e_min
                busy_intervals.append((s_min, 1440))
                busy_intervals.append((0, e_min))
    
    # Merge overlapping busy intervals
    merged_busy = []
    if busy_intervals:
        busy_intervals.sort(key=lambda x: x[0])
        curr_s, curr_e = busy_intervals[0]
        for s, e in busy_intervals[1:]:
            if s <= curr_e:
                curr_e = max(curr_e, e)
            else:
                merged_busy.append((curr_s, curr_e))
                curr_s, curr_e = s, e
        merged_busy.append((curr_s, curr_e))
        
    day_start_min = time_to_minutes(start_boundary)
    day_end_min = time_to_minutes(end_boundary)
    
    free_slots = []
    pointer = day_start_min
    
    for s, e in merged_busy:
        if s > pointer and s > day_start_min:
            gap_start = max(pointer, day_start_min)
            gap_end = min(s, day_end_min)
            gap_dur = gap_end - gap_start
            if gap_dur >= 15:
                free_slots.append({
                    "start": minutes_to_time(gap_start),
                    "end": minutes_to_time(gap_end),
                    "duration_minutes": gap_dur
                })
        pointer = max(pointer, e)
        
    if pointer < day_end_min:
        gap_dur = day_end_min - max(pointer, day_start_min)
        if gap_dur >= 15:
            free_slots.append({
                "start": minutes_to_time(max(pointer, day_start_min)),
                "end": minutes_to_time(day_end_min),
                "duration_minutes": gap_dur
            })
            
    return free_slots

def check_habit_conflicts(user_id, day, new_start, new_end, db_path=None):
    """Checks if any active habits scheduled for this day conflict with a new busy block (supports overnight)."""
    day_fmt = day.capitalize()
    conn = get_db_connection(db_path)
    cursor = conn.cursor()
    cursor.execute(
        """SELECT id, name, target_time, duration_minutes, frequency, status 
           FROM habits 
           WHERE user_id = ? AND status = 'active'""",
        (user_id,)
    )
    habits = [dict(r) for r in cursor.fetchall()]
    conn.close()
    
    new_s_min = time_to_minutes(new_start)
    new_e_min = time_to_minutes(new_end)
    
    # Generate busy intervals for new block
    if new_e_min >= new_s_min:
        new_intervals = [(new_s_min, new_e_min)]
    else:
        new_intervals = [(new_s_min, 1440), (0, new_e_min)]
    
    conflicts = []
    for h in habits:
        freq = h["frequency"].lower()
        is_scheduled_today = (
            freq == "daily" or
            (freq == "weekdays" and day_fmt in ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]) or
            (freq == "weekends" and day_fmt in ["Saturday", "Sunday"]) or
            (day_fmt.lower() in freq)
        )
        if is_scheduled_today:
            h_start_min = time_to_minutes(h["target_time"])
            h_end_min = h_start_min + h["duration_minutes"]
            
            # Check overlap against each interval of the block
            for (ns, ne) in new_intervals:
                if h_start_min < ne and h_end_min > ns:
                    conflicts.append(h)
                    break
                
    return conflicts

def add_batch_schedule_blocks(user_id, days, start, end, label, is_free_time=False, db_path=None):
    """
    Adds or updates a schedule block across multiple selected days at once.
    `days` can be a list of day names (e.g. ['Monday', 'Tuesday', ...]) or keywords 'all', 'weekdays', 'weekends'.
    """
    if isinstance(days, str):
        if days.lower() in ("all", "everyday", "daily"):
            target_days = DAYS_OF_WEEK
        elif days.lower() in ("weekdays", "weekday"):
            target_days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
        elif days.lower() in ("weekends", "weekend"):
            target_days = ["Saturday", "Sunday"]
        else:
            target_days = [days]
    else:
        target_days = days

    # Normalize day names
    valid_days = [d.capitalize() for d in target_days if d.capitalize() in DAYS_OF_WEEK]
    if not valid_days:
        valid_days = ["Monday"]

    created_ids = []
    all_conflicts = []

    for d in valid_days:
        block_id = add_or_update_schedule_block(
            user_id=user_id,
            day=d,
            start=start,
            end=end,
            label=label,
            is_free_time=is_free_time,
            db_path=db_path
        )
        created_ids.append({"day": d, "block_id": block_id})
        conflicts = check_habit_conflicts(user_id, d, start, end, db_path=db_path)
        for c in conflicts:
            if not any(ac["id"] == c["id"] for ac in all_conflicts):
                all_conflicts.append(c)

    log_behavior_event(
        user_id,
        "schedule_batch_added",
        {"days": valid_days, "start": start, "end": end, "label": label, "count": len(valid_days)},
        db_path=db_path
    )

    return {
        "created_blocks": created_ids,
        "days": valid_days,
        "conflicts": all_conflicts
    }

def clone_day_schedule(user_id, source_day, target_days, db_path=None):
    """Copies all schedule blocks from source_day into each of the target_days."""
    src_day_fmt = source_day.capitalize()
    conn = get_db_connection(db_path)
    cursor = conn.cursor()
    cursor.execute(
        """SELECT start_time, end_time, activity_label, is_free_time 
           FROM schedule 
           WHERE user_id = ? AND day_of_week = ?""",
        (user_id, src_day_fmt)
    )
    src_blocks = [dict(r) for r in cursor.fetchall()]
    conn.close()

    if not src_blocks:
        return {"status": "no_source_blocks", "copied_count": 0}

    valid_targets = [d.capitalize() for d in target_days if d.capitalize() in DAYS_OF_WEEK and d.capitalize() != src_day_fmt]
    copied_count = 0

    for tgt_day in valid_targets:
        for b in src_blocks:
            add_or_update_schedule_block(
                user_id=user_id,
                day=tgt_day,
                start=b["start_time"],
                end=b["end_time"],
                label=b["activity_label"],
                is_free_time=bool(b["is_free_time"]),
                db_path=db_path
            )
            copied_count += 1

    return {"status": "success", "copied_count": copied_count, "targets": valid_targets}

def clear_day_schedule(user_id, day, db_path=None):
    """Deletes all schedule blocks for a specific day."""
    day_fmt = day.capitalize()
    conn = get_db_connection(db_path)
    cursor = conn.cursor()
    cursor.execute("DELETE FROM schedule WHERE user_id = ? AND day_of_week = ?", (user_id, day_fmt))
    deleted_count = cursor.rowcount
    conn.commit()
    conn.close()

    log_behavior_event(
        user_id,
        "schedule_day_cleared",
        {"day": day_fmt, "deleted_count": deleted_count},
        db_path=db_path
    )
    return deleted_count

def clear_all_schedule(user_id, db_path=None):
    """Clears all schedule blocks for all days for the user."""
    conn = get_db_connection(db_path)
    cursor = conn.cursor()
    cursor.execute("DELETE FROM schedule WHERE user_id = ?", (user_id,))
    deleted_count = cursor.rowcount
    conn.commit()
    conn.close()

    log_behavior_event(
        user_id,
        "schedule_all_cleared",
        {"deleted_count": deleted_count},
        db_path=db_path
    )
    return deleted_count

def handle_schedule_change(user_id, day, change_description, start_time=None, end_time=None, label=None, db_path=None):
    """
    Called when a schedule change happens:
    a. Updates the schedule table for that day.
    b. Checks all active habits scheduled during that time slot.
    c. If a habit now conflicts, calls habit_manager.suggest_reschedule() and logs 'schedule_changed'.
    """
    import habit_manager # late import to avoid circular dependency
    
    day_fmt = day.capitalize()
    
    # If explicit times were not passed, use defaults or fallback
    start_fmt = parse_time_str(start_time or "14:00")
    end_fmt = parse_time_str(end_time or "15:30")
    activity_lbl = label or change_description
    
    block_id = add_or_update_schedule_block(
        user_id, day_fmt, start_fmt, end_fmt, activity_lbl, is_free_time=False, db_path=db_path
    )
    
    conflicting_habits = check_habit_conflicts(user_id, day_fmt, start_fmt, end_fmt, db_path=db_path)
    reschedule_suggestions = []
    
    for h in conflicting_habits:
        suggestion = habit_manager.suggest_reschedule(
            habit_id=h["id"],
            reason=f"Schedule conflict on {day_fmt} with '{activity_lbl}' ({start_fmt}-{end_fmt})",
            db_path=db_path
        )
        reschedule_suggestions.append({
            "habit": h,
            "suggestion": suggestion
        })
        
    return {
        "schedule_block_id": block_id,
        "day": day_fmt,
        "start": start_fmt,
        "end": end_fmt,
        "label": activity_lbl,
        "conflicts": conflicting_habits,
        "reschedule_suggestions": reschedule_suggestions
    }