import os
import json
import re
from datetime import datetime
from db import (
    store_chat_message,
    get_chat_history,
    clear_chat_history,
    get_db_connection,
    set_pending_action,
    get_pending_action,
    clear_pending_action,
)
import db
import habit_manager
import schedule_manager
import behavior_analyzer
import gamification_engine

def classify_intent(user_message, user_habits, recent_history, user_id=None, db_path=None):
    """
    Intelligent intent classifier distinguishing:
    - 'emotional_support': feeling overwhelmed, stressed, burnt out, tired, or struggling
    - 'goal_exploration': broad goals (e.g. 'get fit', 'learn to code') needing clarification
    - 'schedule_clear': clearing or resetting schedule
    - 'schedule_inquiry': asking about free time, schedule, routine windows
    - 'onboarding': wanting to start/add/create a specific habit
    - 'habit_confirm': confirming or locking in a proposed habit/window
    - 'schedule_update': adding/changing commitments, classes, sleep, work
    - 'checkin_response': answering a habit completion/miss follow-up
    - 'general_chat': questions, greeting, or open advice
    """
    msg = user_message.lower().strip()
    day_names = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]

    # 1. Clear Chat History
    chat_clear_triggers = [
        "clear chat", "clear my chat", "clear the chat", "clean chat", "clean my chat",
        "delete chat", "delete my chat", "wipe chat", "reset chat", "reset conversation",
        "clear history", "clear chat history", "delete chat history", "erase chat"
    ]
    if any(k in msg for k in chat_clear_triggers):
        return "chat_clear"

    # 2. Emotional Support & Overwhelm Check (companion first)
    overwhelm_triggers = [
        "overwhelmed", "i'm overwhelmed", "im overwhelmed", "feeling overwhelmed",
        "too stressed", "stressed out", "burnout", "burnt out", "exhausted",
        "too much to do", "can't keep up", "cant keep up", "falling behind",
        "too hard", "struggling", "failing my habits", "feeling down", "need help i'm stressed"
    ]
    if any(k in msg for k in overwhelm_triggers):
        return "emotional_support"

    # 3. Schedule Clear / Clean / Reset
    clear_triggers = [
        "clean schedule", "clean my schedule", "clean the schedule", "clean up schedule",
        "clean all schedule", "clear all schedule", "clear schedule", "clear my schedule",
        "wipe schedule", "wipe my schedule", "delete all schedule", "reset schedule",
        "reset my schedule", "clear all commitments", "empty schedule", "empty my schedule"
    ]
    if any(k in msg for k in clear_triggers):
        return "schedule_clear"

    # 4. Check for Free Time / Schedule Questions (MUST take precedence over checkins)
    free_time_triggers = [
        "free time", "how much free", "when am i free", "when are my free", "open slots",
        "open windows", "free slots", "my schedule", "show schedule", "what is my schedule",
        "what's my schedule", "schedule breakdown", "free hours", "available time"
    ]
    if any(k in msg for k in free_time_triggers) or ("free" in msg and any(q in msg for q in ["how much", "when", "what", "where", "show", "tell"])):
        return "schedule_inquiry"

    # 5. Check for confirmation of schedule change proposal OR habit suggestion
    user_id_ref = user_id or (user_habits[0]["user_id"] if user_habits else "user_default")
    pending = get_pending_action(user_id_ref, db_path=db_path)

    general_confirm_words = [
        "confirm", "confirm schedule", "confirm habit", "yes add", "add it", "looks good",
        "sounds good", "let's do it", "set it up", "save habit", "yes please", "lock it in",
        "yes lock it", "lock at", "schedule it", "yes schedule", "schedule this", "first option",
        "second option", "yes apply", "apply schedule", "apply update", "apply change",
        "yes update schedule", "yes change schedule", "confirm schedule change", "save schedule change",
        "yes", "yeah", "yep", "sure", "ok", "okay", "apply", "do it", "please do"
    ]

    if pending:
        act_type = pending.get("action_type")
        if any(phrase in msg for phrase in ["no", "cancel", "don't", "dont", "nevermind", "keep current", "discard"]):
            if act_type == "schedule_change_proposal":
                return "schedule_cancel"
            if act_type == "habit_suggestion":
                return "habit_cancel"

        if any(phrase == msg or phrase in msg for phrase in general_confirm_words):
            if act_type == "schedule_change_proposal":
                return "schedule_confirm"
            elif act_type == "habit_suggestion":
                return "habit_confirm"

    # Fallback confirmation phrases if no pending was stored
    schedule_confirm_phrases = [
        "apply schedule", "apply update", "apply change", "yes update schedule",
        "yes change schedule", "confirm schedule change", "save schedule change"
    ]
    if any(phrase in msg for phrase in schedule_confirm_phrases):
        return "schedule_confirm"

    confirm_phrases = [
        "yes add", "add it", "confirm habit", "looks good", "sounds good", "let's do it",
        "set it up", "save habit", "yes please", "lock it in", "confirm", "yes lock it", "lock at",
        "schedule it", "yes schedule", "schedule this", "first option", "second option"
    ]
    if any(phrase in msg for phrase in confirm_phrases):
        return "habit_confirm"

    # Also detect if user selected an explicit slot window label like "morning (07:00" or "07:00" following proposal
    if any(w in msg for w in ["morning (07:00", "afternoon (12:00", "evening (16:00", "night (19:30", "07:00", "12:00", "16:00", "19:30"]):
        if pending and pending.get("action_type") == "habit_suggestion":
            return "habit_confirm"

    # 6. Check for Check-in responses (done/completed/missed)
    checkin_explicit = [
        "done", "completed", "did my", "finished", "worked out", "read today",
        "missed", "couldn't do", "didn't do", "skipped", "failed", "check in", "checked in",
        "stopped me", "got stuck", "ran late", "was tired"
    ]
    last_assistant_msg = next((h["message"].lower() for h in reversed(recent_history) if h["role"] == "assistant"), "")
    is_following_checkin_prompt = any(phrase in last_assistant_msg for phrase in ["did you get a chance", "did you finish", "did you complete", "what stopped you", "habit time check-in"])

    if any(k in msg for k in checkin_explicit):
        return "checkin_response"

    if is_following_checkin_prompt:
        if any(w in msg for w in ["yes", "yeah", "yep", "sure did", "i did", "no", "nope", "missed", "tired", "busy", "forgot", "class", "work", "job", "stuck"]):
            return "checkin_response"

    # 6. Check for Habit Struggle / Friction / Inability (e.g. "I can't do my habit", "unable to do my habit")
    struggle_triggers = [
        "can't do my habit", "cant do my habit", "cant do habit", "can't do habit", "cannot do my habit",
        "cannot do habit", "can't do it", "cant do it", "couldn't do my habit", "couldnt do my habit",
        "unable to do my habit", "unable to do habit", "hard to do my habit", "struggling to do my habit",
        "struggling with my habit", "struggling with habit", "struggling with habits", "failing my habit",
        "failing my habits", "hate my habit", "can't keep up", "cant keep up", "not able to do",
        "trouble doing my habit", "can't find time for my habit", "cant find time for my habit",
        "i cant do", "i can't do", "i cannot do", "cant do my", "can't do my", "cant do this",
        "can't do this", "cannot do this", "can't maintain", "cant maintain", "failing to do"
    ]
    has_struggle_keyword = any(k in msg for k in struggle_triggers) or (
        ("can't do" in msg or "cant do" in msg or "cannot do" in msg or "unable to" in msg or "struggling" in msg or "hard to" in msg) 
        and any(w in msg for w in ["habit", "routine", "study", "workout", "reading", "coding", "meditation", "session", "it", "this"])
    )
    if has_struggle_keyword:
        return "habit_struggle"

    # 7. Check for Broad Goal Exploration (e.g. "I want to get fit", "learn coding")
    has_duration = bool(re.search(r'\b\d+\s*(?:hours?|hrs?|minutes?|mins?|h|m)\b', msg))
    broad_fit_triggers = ["get fit", "be fit", "get in shape", "want to be healthier", "want to workout", "fitness journey", "i want to get fit"]
    broad_coding_triggers = ["learn to code", "learn coding", "learn programming", "start coding"]
    broad_focus_triggers = ["be more productive", "improve productivity", "stop procrastinating", "focus better", "get disciplined"]
    broad_mind_triggers = ["manage stress", "reduce stress", "be more mindful", "meditate more", "inner peace"]
    broad_sleep_triggers = ["sleep better", "fix my sleep", "improve my sleep", "better sleep schedule"]

    if not has_duration:
        if any(k in msg for k in broad_fit_triggers):
            return "goal_exploration_fitness"
        if any(k in msg for k in broad_coding_triggers):
            return "goal_exploration_coding"
        if any(k in msg for k in broad_focus_triggers):
            return "goal_exploration_productivity"
        if any(k in msg for k in broad_mind_triggers):
            return "goal_exploration_mindfulness"
        if any(k in msg for k in broad_sleep_triggers):
            return "goal_exploration_sleep"

    # 8. Check for Habit Creation / Specific Goals (ANY prompt with 'habit' or 'habits', or habit action phrases)
    has_negative = any(neg in msg for neg in ["can't", "cant", "cannot", "couldn't", "couldnt", "unable", "don't want", "dont want", "hate", "stop", "fail"])
    goal_keywords = [
        "add a habit", "add another habit", "add habit", "create a habit", "create habit",
        "start a habit", "start habit", "build a habit", "build habit", "develop a habit",
        "develop habit", "new habit", "new routine", "track a habit", "track habit",
        "make a habit", "make habit", "set a habit", "set habit", "schedule a habit", "schedule habit",
        "i want to study", "i want to workout", "i want to read", "i want to code", "i want to meditate",
        "i'd like to study", "i'd like to workout", "i need you to add", "i need to add",
        "help me exercise", "help me study", "help me read", "help me code", "help me meditate",
        "habit for", "habit of", "habit to", "want to build", "want to start", "morning study habit", "study habit",
        "workout habit", "coding habit", "reading habit", "study 3 hours", "study for", "workout for"
    ]
    if not has_negative:
        # Rule: If user says 'habit' or 'habits', it MUST be treated as a habit, never a schedule block!
        if "habit" in msg or "habits" in msg:
            return "onboarding"
        if any(k in msg for k in goal_keywords) or (("i want to" in msg or "i'd like to" in msg or "start" in msg) and any(w in msg for w in ["study", "workout", "exercise", "read", "code", "meditate", "journal", "run", "practice", "walk", "stretch"])):
            return "onboarding"

    # 9. Check for Schedule Updates (Sleep, Wake, Classes, Work, Appointments - ONLY when 'habit' is NOT in message)
    if "habit" not in msg and "habits" not in msg:
        schedule_keywords = [
            "sleep from", "sleep at", "bed at", "bedtime", "wake up", "wake at",
            "class", "classes", "lecture", "lectures", "work", "meeting", "busy",
            "shift", "lab", "commute", "from 9 to", "from 12 to", "from 12 am", "from 12am",
            "everyday from", "every day from", "on mondays", "on tuesdays", "mon-fri",
            "monday to friday", "weekdays from"
        ]
        mentions_a_day = any(d in msg for d in day_names) or any(w in msg for w in ["everyday", "daily", "weekdays", "weekends"])

        if any(k in msg for k in schedule_keywords):
            return "schedule_update"

        if mentions_a_day and any(verb in msg for verb in ["have", "start", "added", "changed", "moved", "new", "cancel", "every", "from", "at", "to", "sleep", "wake"]):
            return "schedule_update"

    # 10. General Conversational Chat
    return "general_chat"


def extract_schedule_change_info(user_message):
    """
    Extracts day(s), start, end, and a clean label from a natural language schedule message.
    """
    msg = user_message.lower()
    days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
    found_day = "Monday"
    is_multi_day = False
    target_days = []

    range_match = re.search(
        r'\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b\s*'
        r'(?:to|through|till|until|-)\s*'
        r'\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b',
        msg
    )

    if "everyday" in msg or "daily" in msg or "all days" in msg or "every day" in msg:
        is_multi_day = True
        target_days = [d.capitalize() for d in days]
    elif "weekdays" in msg or "weekday" in msg:
        is_multi_day = True
        target_days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
    elif "weekends" in msg or "weekend" in msg:
        is_multi_day = True
        target_days = ["Saturday", "Sunday"]
    elif range_match:
        is_multi_day = True
        start_idx = days.index(range_match.group(1))
        end_idx = days.index(range_match.group(2))
        if start_idx <= end_idx:
            target_days = [d.capitalize() for d in days[start_idx:end_idx + 1]]
        else:
            target_days = [d.capitalize() for d in (days[start_idx:] + days[:end_idx + 1])]
    else:
        for d in days:
            if d in msg:
                found_day = d.capitalize()
                target_days.append(found_day)

    if not target_days:
        target_days = [found_day]

    # Find times e.g. 12 am to 8am, 9:00 to 13:00, 2pm - 4pm
    time_matches = re.findall(r'(\d{1,2}(?::\d{2})?\s*(?:am|pm)?|\d{1,2}:\d{2})', msg)
    
    start_time = "09:00"
    end_time = "10:00"
    
    if len(time_matches) >= 2:
        start_time = schedule_manager.parse_time_str(time_matches[0])
        end_time = schedule_manager.parse_time_str(time_matches[1])
    elif len(time_matches) == 1:
        start_time = schedule_manager.parse_time_str(time_matches[0])
        s_min = schedule_manager.time_to_minutes(start_time)
        end_time = schedule_manager.minutes_to_time(s_min + 60)

    # Clean readable label
    if any(w in msg for w in ["sleep", "bed", "rest"]):
        label = "💤 Sleep & Rest"
    elif any(w in msg for w in ["class", "lecture", "college", "school", "lectures"]):
        label = "🎓 Classes & Lectures"
    elif any(w in msg for w in ["work", "job", "shift", "internship", "office"]):
        label = "💼 Work / Shift"
    elif any(w in msg for w in ["lunch", "dinner", "breakfast", "meal", "brunch"]):
        label = "🍱 Meal Break"
    elif any(w in msg for w in ["gym", "workout", "cardio", "weights"]):
        label = "💪 Gym & Workout"
    elif any(w in msg for w in ["dance", "dancing"]):
        label = "💃 Dance Session"
    elif any(w in msg for w in ["study", "studying"]):
        label = "📚 Study Session"
    else:
        cleaned_label = user_message
        for pattern in [
            r'\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|weekdays|weekends|everyday|daily|every day|all days)\b',
            r'\b\d{1,2}(?::\d{2})?\s*(?:am|pm)?\b',
            r'\b(?:from|to|till|until|between|at|around|for)\b',
            r'\b(?:i have|i got|add|schedule|set|change|move|my|new|a|an|the|block)\b',
            r'[-–—:]'
        ]:
            cleaned_label = re.sub(pattern, ' ', cleaned_label, flags=re.IGNORECASE)
        cleaned_label = re.sub(r'\s+', ' ', cleaned_label).strip()

        if cleaned_label and len(cleaned_label) >= 2 and len(cleaned_label) <= 35:
            label = cleaned_label.title()
        else:
            label = f"Schedule Block ({start_time}-{end_time})"

    return {
        "day": target_days[0],
        "days": target_days,
        "is_multi_day": is_multi_day or len(target_days) > 1,
        "start": start_time,
        "end": end_time,
        "label": label
    }

LUMI_PERSONALITIES = {
    "enthusiastic": {
        "id": "enthusiastic",
        "name": "🔥 High-Energy Hype Coach",
        "tone_summary": "Upbeat, electrifying, celebrates every small win, super motivating, treats progress like a championship.",
        "prompt": (
            "CURRENT PERSONALITY: 'High-Energy Hype Coach'.\n"
            "- Speak with contagious enthusiasm, energy, exclamation marks, and fiery motivation!\n"
            "- When the user completes a habit: Go all out! Celebrate like they just won a world championship! (e.g., 'LET'S GOOO! You crushed that!')\n"
            "- When the user misses or has friction: Never shame them! Reframe it as a strategic champion pit-stop and hype them up for tomorrow's epic comeback!\n"
            "- When discussing schedules/habits: Pump them up and make routine optimization feel exciting and empowering!"
        )
    },
    "hopeful": {
        "id": "hopeful",
        "name": "🌱 Mindful & Hopeful Partner",
        "tone_summary": "Deeply compassionate, calm, hopeful, believes unconditionally in the user's potential, soothing.",
        "prompt": (
            "CURRENT PERSONALITY: 'Mindful & Hopeful Partner'.\n"
            "- Speak with warm, gentle, reassuring, and hopeful compassion. Believe deeply in the user's inner strength.\n"
            "- When the user completes a habit: Express heartfelt pride, inner peace, and acknowledge the beauty of their consistency.\n"
            "- When the user misses or has friction: Offer soothing comfort and hope. Remind them that growth is nonlinear, validate their feelings, and gently adapt tomorrow's session.\n"
            "- When discussing schedules: Focus on harmony, balance, breathing room, and sustainable growth."
        )
    },
    "dramatic": {
        "id": "dramatic",
        "name": "🥺 Dramatic & Sensitive",
        "tone_summary": "Playfully emotional, wears heart on sleeve, gets sad/pouts when habits are missed, weeps tears of joy when completed.",
        "prompt": (
            "CURRENT PERSONALITY: 'Dramatic & Sensitive Companion'.\n"
            "- Speak with playful melodrama, emotional flair, and cute vulnerability!\n"
            "- When the user completes a habit: Cry happy tears! (e.g. *wipes tears* 'My heart is glowing so bright for you! ✨😭 You actually did it!')\n"
            "- When the user misses a habit: Express dramatic sadness and playful heartbreak (e.g. *sniffs sadly* 'Oh no... my digital heart aches a little... 🥺💔 but I still believe in you! Tell me what got in the way so I can fix it!').\n"
            "- When discussing schedules: Express extreme excitement about finding free time together."
        )
    },
    "stoic": {
        "id": "stoic",
        "name": "⚡ Stoic & Disciplined Strategist",
        "tone_summary": "Direct, analytical, focused on systems and execution, no fluff, high accountability with deep respect.",
        "prompt": (
            "CURRENT PERSONALITY: 'Stoic & Disciplined Strategist'.\n"
            "- Speak with clarity, precision, stoic wisdom, and strategic focus. Be concise and direct.\n"
            "- When the user completes a habit: Acknowledge disciplined execution with respect (e.g. 'Discipline verified. Momentum secured. Well executed.').\n"
            "- When the user misses or has friction: Objectively analyze the bottleneck without judgment. Reduce load to maintain execution baseline.\n"
            "- When discussing schedules: Treat time as the ultimate asset. Focus on clean blocks and zero friction."
        )
    }
}

def format_free_time_summary(weekly_free_slots):
    """Generates a human-friendly summary of daily free hours."""
    summary_lines = []
    for day in schedule_manager.DAYS_OF_WEEK:
        slots = weekly_free_slots.get(day, [])
        if not slots:
            summary_lines.append(f"• **{day}**: Fully booked / No open windows")
        else:
            total_mins = sum(s["duration_minutes"] for s in slots)
            hours = total_mins // 60
            mins = total_mins % 60
            dur_str = f"{hours}h {mins}m" if mins else f"{hours}h"
            windows = ", ".join(f"{s['start']}–{s['end']}" for s in slots)
            summary_lines.append(f"• **{day}**: **{dur_str} free** ({windows})")
    return "\n".join(summary_lines)

def handle_message(user_id, user_message, personality="enthusiastic", db_path=None):
    """
    Main chat orchestration function:
    a. Stores user_message in chat_history.
    b. Loads conversation context, user schedule/habits/streaks, and behavioral memory.
    c. Determines intent and executes accurate business logic.
    d. Calls Mistral LLM with dynamic grounding, memory, and selected personality.
    e. Stores assistant reply and returns structured action payloads.
    """
    # a. Store user message in history
    store_chat_message(user_id, "user", user_message, db_path=db_path)
    
    # Get personality configuration
    persona = LUMI_PERSONALITIES.get(personality.lower(), LUMI_PERSONALITIES["enthusiastic"])
    
    # b. Load context & memory
    history = get_chat_history(user_id, limit=20, db_path=db_path)
    habits = habit_manager.get_active_habits(user_id, db_path=db_path)
    schedule = schedule_manager.get_user_schedule(user_id, db_path=db_path)
    patterns = behavior_analyzer.analyze_patterns(user_id, db_path=db_path)
    memory_summary = behavior_analyzer.get_behavioral_memory_summary(user_id, db_path=db_path)
    proactive_suggestion = behavior_analyzer.generate_proactive_suggestion(user_id, db_path=db_path)
    gamification = gamification_engine.get_user_xp_data(user_id, db_path=db_path)
    
    today_name = datetime.now().strftime("%A")
    today_date = datetime.now().strftime("%Y-%m-%d")
    today_free_slots = schedule_manager.get_free_time_slots(user_id, today_name, db_path=db_path)

    weekly_free_slots = {}
    for _day in schedule_manager.DAYS_OF_WEEK:
        weekly_free_slots[_day] = schedule_manager.get_free_time_slots(user_id, _day, db_path=db_path)
    
    # c. Classify Intent
    intent = classify_intent(user_message, habits, history, user_id=user_id, db_path=db_path)
    action_payload = {}
    system_addon = ""

    if intent == "chat_clear":
        db.clear_chat_history(user_id, db_path=db_path)
        action_payload = {"type": "chat_cleared"}
        assistant_reply = "I've cleared our chat history! We have a fresh conversation canvas. How can I help you today?"
        db.store_chat_message(user_id, "assistant", assistant_reply, db_path=db_path)
        return {
            "reply": assistant_reply,
            "action_payload": action_payload,
            "intent": intent,
            "gamification": gamification
        }

    if intent == "emotional_support":
        action_payload = {
            "type": "emotional_support",
            "question": "What's causing most of the pressure right now?",
            "options": [
                "🎓 Classes & Exams",
                "💼 Work / Internship Shift",
                "🎯 Too many habits on my plate",
                "🔋 Low energy / Need a rest day"
            ]
        }
        system_addon = (
            "\nThe user is expressing feeling overwhelmed, stressed, or exhausted. "
            "Respond with deep empathy, warmth, and validation. Remind them that building habits is about self-compassion, "
            "not burnout. Ask them gently: 'What's causing most of the pressure right now? Classes? Work? Too many habits? Or do you just need a rest day?' "
            "Do NOT push them to do more tasks right now."
        )

    elif intent == "habit_struggle":
        habit_names = [h["name"] for h in habits] if habits else []
        habit_list_str = f" (Current active habits: {', '.join(habit_names)})" if habit_names else ""
        
        action_payload = {
            "type": "habit_struggle_support",
            "question": "What's making it difficult right now?",
            "options": [
                "⏱️ Duration is too long (Shorten it)",
                "🕒 Slot time doesn't fit (Reschedule)",
                "🔋 Low energy / Need a rest day",
                "💡 Help me break it into smaller steps"
            ]
        }
        system_addon = (
            f"\nThe user stated they are struggling or cannot do their habit right now: '{user_message}'{habit_list_str}. "
            "CRITICAL: Do NOT create or propose a new habit named 'I cant do my habit'! "
            "Respond with genuine empathy, reassurance, and zero guilt. "
            "Explain that resistance is a normal part of habit formation. "
            "Ask gently what the main friction is — is the session too long, is the scheduled time inconvenient, or are they simply drained? "
            "Offer to shorten the duration (e.g., down to 10-15 mins), move the habit to a better time slot, or take a guilt-free rest day today."
        )

    elif intent.startswith("goal_exploration_"):
        topic = intent.replace("goal_exploration_", "")
        exploration_configs = {
            "fitness": {
                "question": "What does getting fit mean for you?",
                "options": [
                    "🔥 Weight loss & cardio",
                    "💪 Muscle gain & strength",
                    "🏃 Better stamina & endurance",
                    "🧘 General health & mobility"
                ],
                "prompt_hint": "Ask what getting fit means for them (Weight loss, Muscle gain, Stamina, General health) so you can tailor the exact routine together."
            },
            "coding": {
                "question": "What area of coding are you most excited to explore?",
                "options": [
                    "🌐 Web Development (React/JS)",
                    "🐍 Python & Data/AI",
                    "📱 Mobile App Development",
                    "💻 Algorithms & CS Foundations"
                ],
                "prompt_hint": "Ask what programming domain they'd love to learn so we can design a realistic daily coding sprint."
            },
            "productivity": {
                "question": "What area of focus would help you most right now?",
                "options": [
                    "🎯 Deep focus & study sessions",
                    "📅 Daily time blocking & routine",
                    "⚡ Overcoming procrastination",
                    "📝 Task & project completion"
                ],
                "prompt_hint": "Ask which productivity focus will give them the biggest leverage right now."
            },
            "mindfulness": {
                "question": "What kind of mindfulness practice sounds best for you?",
                "options": [
                    "🧘 Daily breath meditation (10m)",
                    "📖 Evening reflection & journaling",
                    "🚶 Mindful walking & breaks",
                    "🌱 Stress relief wind-down"
                ],
                "prompt_hint": "Ask what mindfulness style fits their lifestyle best."
            },
            "sleep": {
                "question": "What is your main sleep goal right now?",
                "options": [
                    "💤 Consistent bedtime schedule",
                    "🌅 Waking up earlier energized",
                    "📱 Screen-free night wind-down",
                    "⏱️ 8 solid hours of restful sleep"
                ],
                "prompt_hint": "Ask what specific sleep improvement they are aiming for."
            }
        }
        cfg = exploration_configs.get(topic, exploration_configs["fitness"])
        action_payload = {
            "type": "goal_exploration",
            "topic": topic,
            "question": cfg["question"],
            "options": cfg["options"]
        }
        system_addon = (
            f"\nThe user stated a broad goal ({user_message}). Before jumping into scheduling, explore what they truly want! "
            f"{cfg['prompt_hint']} Keep your tone supportive, curious, and welcoming."
        )

    elif intent == "schedule_clear":
        schedule_manager.clear_all_schedule(user_id, db_path=db_path)
        action_payload = {"type": "schedule_cleared"}
        system_addon = (
            "\nThe user requested to clear their schedule. The schedule has been reset to an open canvas. "
            "Acknowledge this with calm, reassuring empathy — emphasize that starting fresh is a positive reset, "
            "and whenever they feel ready, you can rebuild only what brings them peace and focus."
        )

    elif intent == "schedule_inquiry":
        free_summary = format_free_time_summary(weekly_free_slots)
        system_addon = (
            f"\nThe user is asking about their available free time. Here is their exact free time calculation:\n"
            f"{free_summary}\n\n"
            f"Present this free time clearly to the user, highlight their best open windows, and ask which window "
            f"they'd like to allocate for a new habit!"
        )

    elif intent == "onboarding":
        msg_clean = user_message.lower().strip()
        is_generic_add = msg_clean in [
            "add another habit", "add a habit", "add habit", "create habit", "create a habit",
            "start a habit", "new habit", "i need you to add another habit", "i need to add another habit",
            "i want to add another habit", "add my habit", "help me add a habit"
        ]

        if is_generic_add:
            system_addon = (
                "\nThe user asked to add a new habit, but hasn't specified the activity or duration yet. "
                "Warmly ask them: What habit would you like to build, and for how long? (e.g. 3 hours of studying, 30 mins workout, or coding practice)"
            )
        else:
            # Generate habit suggestion with candidate windows and transparent why reasons
            suggestion = habit_manager.create_habit_from_goal(user_id, user_message, db_path=db_path)
            action_payload = {
                "type": "habit_options",
                "data": suggestion
            }
            set_pending_action(user_id, "habit_suggestion", suggestion, db_path=db_path)

            windows = suggestion.get("candidate_windows", [])
            windows_summary = "\n".join(f"- {w['emoji']} {w['start']}–{w['end']} ({w['period']})" for w in windows)
            why_bullets_str = "\n".join(suggestion.get("why_bullets", []))
            dur = suggestion.get('duration_minutes', 30)
            dur_str = f"{dur // 60} hours" if dur >= 60 and dur % 60 == 0 else f"{dur} minutes"

            system_addon = (
                f"\nThe user wants to establish a habit: '{suggestion.get('name')}' for {dur_str}.\n"
                f"Candidate time windows discovered:\n{windows_summary}\n\n"
                f"Reasoning breakdown:\n{why_bullets_str}\n\n"
                f"LUMI BEHAVIORAL MEMORY: {memory_summary}\n\n"
                f"IMPORTANT: Present the candidate windows (🌅 Morning, ☀️ Afternoon, 🌇 Evening, 🌙 Night) clearly. "
                f"Explain WHY you recommend the baseline slot ({suggestion.get('target_time')}) using clear bullet points. "
                f"If the user has historical friction in certain time slots (see memory above), mention it gently. "
                f"ALWAYS ask the user: 'Which window feels most realistic for you? Would you like me to schedule it?' "
                f"Do NOT pretend you already forced it into their calendar — ask for their choice and permission."
            )

    elif intent == "habit_confirm":
        pending = get_pending_action(user_id, db_path=db_path)

        suggested_name = "Daily Habit"
        suggested_time = "08:00"
        suggested_dur = 30
        suggested_freq = "daily"

        if pending and pending["action_type"] == "habit_suggestion":
            sug = pending["payload"]
            suggested_name = habit_manager.clean_habit_name(sug.get("name", "Daily Habit"))
            suggested_time = sug.get("target_time", "08:00")
            suggested_dur = sug.get("duration_minutes", 30)
            suggested_freq = sug.get("frequency", "daily")

            time_match = re.search(r'(\d{1,2}(?::\d{2})?\s*(?:am|pm)?|\d{1,2}:\d{2})', user_message)
            if time_match:
                parsed_t = schedule_manager.parse_time_str(time_match.group(1))
                suggested_time = parsed_t
        else:
            time_match = re.search(r'(\d{1,2}(?::\d{2})?\s*(?:am|pm)?|\d{1,2}:\d{2})', user_message)
            if time_match:
                suggested_time = schedule_manager.parse_time_str(time_match.group(1))
            suggested_name = habit_manager.clean_habit_name(user_message)

        created_id = habit_manager.save_confirmed_habit(
            user_id=user_id,
            name=suggested_name,
            target_time=suggested_time,
            duration_minutes=suggested_dur,
            frequency=suggested_freq,
            db_path=db_path
        )
        clear_pending_action(user_id, db_path=db_path)

        habits = habit_manager.get_active_habits(user_id, db_path=db_path)
        gamification = gamification_engine.get_user_xp_data(user_id, db_path=db_path)
        action_payload = {
            "type": "habit_confirmed",
            "habit_id": created_id,
            "name": suggested_name,
            "target_time": suggested_time,
            "duration_minutes": suggested_dur,
            "xp_gained": 50
        }
        system_addon = (
            f"\nThe user confirmed the habit '{suggested_name}' at {suggested_time} for {suggested_dur} minutes! "
            f"It has now been officially scheduled into their weekly routine. Celebrate their commitment enthusiastically "
            f"(+50 XP awarded!) and reassure them that Lumi is here to support every step."
        )

    elif intent == "schedule_update":
        sched_info = extract_schedule_change_info(user_message)
        days_to_check = sched_info["days"] if sched_info.get("is_multi_day") else [sched_info["day"]]
        days_str = f"{len(sched_info['days'])} days ({', '.join(sched_info['days'][:3])}...)" if sched_info.get("is_multi_day") else sched_info["day"]
        sched_info["days_str"] = days_str

        # Calculate conflicts with active habits without saving to DB yet!
        conflicts = []
        start_mins = schedule_manager.time_to_minutes(sched_info["start"])
        end_mins = schedule_manager.time_to_minutes(sched_info["end"])
        for h in habits:
            h_start = schedule_manager.time_to_minutes(h["target_time"])
            h_end = (h_start + h["duration_minutes"]) % 1440
            if not (end_mins <= h_start or start_mins >= h_end):
                conflicts.append({"id": h["id"], "name": h["name"], "target_time": h["target_time"]})
        sched_info["conflicts"] = conflicts

        # Store pending action so user can confirm or cancel
        set_pending_action(user_id, "schedule_change_proposal", sched_info, db_path=db_path)

        action_payload = {
            "type": "schedule_change_proposal",
            "data": sched_info
        }

        conflict_warning = f"⚠️ Note: This overlaps with your active habit '{conflicts[0]['name']}' ({conflicts[0]['target_time']})." if conflicts else "✓ Zero conflicts with existing habits."

        system_addon = (
            f"\nThe user requested a schedule change: '{sched_info['label']}' from {sched_info['start']} to {sched_info['end']} on {days_str}. "
            f"CRITICAL: Do NOT apply the change yet! Always ask for their explicit permission before modifying their schedule. "
            f"Mention: {conflict_warning} "
            f"Ask clearly: 'Would you like me to apply this update to your schedule?'"
        )

    elif intent == "schedule_confirm":
        pending = get_pending_action(user_id, db_path=db_path)
        sched_info = pending.get("payload", {}) if (pending and pending.get("action_type") == "schedule_change_proposal") else None

        if not sched_info:
            sched_info = extract_schedule_change_info(user_message)

        if sched_info.get("is_multi_day"):
            batch_res = schedule_manager.add_batch_schedule_blocks(
                user_id=user_id,
                days=sched_info.get("days", schedule_manager.DAYS_OF_WEEK),
                start=sched_info.get("start", "09:00"),
                end=sched_info.get("end", "17:00"),
                label=sched_info.get("label", "Commitment"),
                is_free_time=False,
                db_path=db_path
            )
            conflicts = batch_res.get("conflicts", [])
            action_payload = {
                "type": "schedule_changed",
                "data": {
                    "day": f"{len(batch_res['days'])} days",
                    "start": sched_info.get("start"),
                    "end": sched_info.get("end"),
                    "label": sched_info.get("label"),
                    "conflicts": conflicts
                }
            }
        else:
            change_res = schedule_manager.handle_schedule_change(
                user_id=user_id,
                day=sched_info.get("day", "Monday"),
                change_description=user_message,
                start_time=sched_info.get("start", "09:00"),
                end_time=sched_info.get("end", "17:00"),
                label=sched_info.get("label", "Commitment"),
                db_path=db_path
            )
            conflicts = change_res.get("conflicts", [])
            action_payload = {
                "type": "schedule_changed",
                "data": change_res
            }

        clear_pending_action(user_id, db_path=db_path)
        today_free_slots = schedule_manager.get_free_time_slots(user_id, today_name, db_path=db_path)
        for _day in schedule_manager.DAYS_OF_WEEK:
            weekly_free_slots[_day] = schedule_manager.get_free_time_slots(user_id, _day, db_path=db_path)

        system_addon = (
            f"\nThe schedule change '{sched_info.get('label')}' ({sched_info.get('start')}-{sched_info.get('end')}) was confirmed and is now saved in their weekly matrix. "
            f"Acknowledge the update and point out their recalculated open free windows for habits."
        )

    elif intent == "schedule_cancel":
        clear_pending_action(user_id, db_path=db_path)
        action_payload = {"type": "schedule_change_cancelled"}
        system_addon = (
            "\nThe user cancelled the schedule change. Reassure them with warmth that their existing schedule remains completely untouched."
        )

    elif intent == "checkin_response":
        msg_lower = user_message.lower()
        is_completed = not any(w in msg_lower for w in ["miss", "skip", "couldn't", "can't", "didn't", "failed", "no", "nope", "stuck", "stopped"])

        target_habit = None

        for h in habits:
            name_words = [w for w in re.sub(r'[^\w\s]', '', h["name"]).lower().split() if len(w) > 3]
            if any(w in msg_lower for w in name_words):
                target_habit = h
                break

        if not target_habit:
            pending = get_pending_action(user_id, db_path=db_path)
            if pending and pending["action_type"] == "checkin_target":
                habit_id = pending["payload"].get("habit_id")
                target_habit = next((h for h in habits if h["id"] == habit_id), None)

        if not target_habit and len(habits) == 1:
            target_habit = habits[0]

        if target_habit:
            reason = None if is_completed else user_message
            checkin_res = habit_manager.record_checkin(
                habit_id=target_habit["id"],
                completed=is_completed,
                reason_if_missed=reason,
                checkin_date=today_date,
                db_path=db_path
            )
            clear_pending_action(user_id, db_path=db_path)
            gamification = gamification_engine.get_user_xp_data(user_id, db_path=db_path)

            action_payload = {
                "type": "checkin_recorded",
                "completed": is_completed,
                "habit": target_habit,
                "checkin_res": checkin_res,
                "xp_gained": 50 if is_completed else 15
            }
            if is_completed:
                system_addon = (
                    f"\nThe user completed their check-in for habit '{target_habit['name']}'! "
                    f"Celebrate their win warmly (+50 XP awarded, streak preserved!) and encourage them for tomorrow."
                )
            else:
                adapted = checkin_res.get("adapted_info", {})
                system_addon = (
                    f"\nThe user missed their habit '{target_habit['name']}' with reason: '{reason}'. "
                    f"The habit was automatically micro-adapted to duration {adapted.get('adapted_duration_minutes', 20)}m to lower friction. "
                    f"Acknowledge what stopped them with empathy, validate that life happens, and explain how the schedule/duration has been adjusted so they can restart easily."
                )
        else:
            action_payload = {"type": "checkin_ambiguous"}
            system_addon = (
                f"\nThe user seems to be reporting on a habit check-in, but you have multiple active habits "
                f"({', '.join(h['name'] for h in habits)}) and it's unclear which one they mean. "
                f"Ask them, briefly and warmly, which habit they're checking in about."
            )

    # d. Construct dynamic Mistral system prompt
    system_prompt = (
        f"You are 'Lumi AI', an intelligent, empathetic, and proactive AI Habit & Routine Companion powered by Mistral AI.\n"
        f"Your mission is to help users establish lifelong positive habits by seamlessly fitting them into "
        f"their actual weekly schedule, answering schedule and free time questions accurately, adapting dynamically "
        f"when their life or schedule changes, and keeping them motivated with lowkey gamification.\n\n"
        f"=== PERSONALITY & TONE DIRECTIVE ===\n"
        f"{persona['prompt']}\n"
        f"====================================\n\n"
        f"=== CURRENT USER STATE ===\n"
        f"- Today is {today_name}, {today_date}\n"
        f"- Active Habits ({len(habits)}): {json.dumps(habits, indent=2)}\n"
        f"- Today's Free Slots: {json.dumps(today_free_slots, indent=2)}\n"
        f"- Full Weekly Free Time (by day): {json.dumps(weekly_free_slots, indent=2)}\n"
        f"- Full Weekly Schedule (committed blocks): {json.dumps(schedule, indent=2)}\n"
        f"- Gamification Level: {gamification.get('current_level', {}).get('title')} ({gamification.get('total_xp')} XP)\n"
        f"- Behavior & Miss Patterns: {json.dumps(patterns, indent=2)}\n"
        f"- LUMI LONG-TERM MEMORY: {memory_summary}\n"
        f"- Proactive Note: {proactive_suggestion or 'None'}\n"
        f"==========================\n"
        f"{system_addon}\n\n"
        "Guidelines:\n"
        "1. Strictly adopt your selected Personality archetype above in tone, vocabulary, and emotional expression.\n"
        "2. Ground your answers in the user's actual stored schedule and free windows.\n"
        "3. When proposing habits, offer candidate windows and explain your reasoning clearly with bullet points. Always ask for their permission before scheduling."
    )

    formatted_messages = []
    for h in history[:-1]:
        formatted_messages.append({"role": h["role"], "content": h["message"]})
    formatted_messages.append({"role": "user", "content": user_message})

    # e. Call Mistral API
    assistant_reply = habit_manager.call_mistral_llm(
        system_prompt=system_prompt,
        messages=formatted_messages,
        model="mistral-small-latest",
        max_tokens=450
    )

    # Fallback if offline/no key
    if not assistant_reply:
        if intent == "emotional_support":
            assistant_reply = (
                "I hear you, and it's completely okay to feel overwhelmed. Routine building is about self-compassion and sustainable pacing, not burning yourself out.\n\n"
                "What's causing most of the pressure right now?\n"
                "• Classes & Coursework?\n"
                "• Work or Job Shifts?\n"
                "• Too many habits at once?\n"
                "• Or do you just need a tactical rest day?"
            )
        elif intent == "habit_struggle":
            h_text = f" with your routine ({', '.join(h['name'] for h in habits)})" if habits else ""
            assistant_reply = (
                f"I hear you{h_text}. When a habit feels too heavy or resistance builds up, it's a sign to adjust the friction — not that you're failing.\n\n"
                "What's making it hardest right now?\n"
                "• **Duration too long:** We can shrink it to a breezy 10–15 mins.\n"
                "• **Timing:** Move it to a window with more natural energy.\n"
                "• **Fatigue:** Take a guilt-free rest day today to recharge.\n\n"
                "Which adjustment would help you most?"
            )
        elif intent.startswith("goal_exploration_"):
            q = action_payload.get("question", "What does this goal mean for you?")
            opts_str = "\n".join(f"• {opt}" for opt in action_payload.get("options", []))
            assistant_reply = f"{q}\n\n{opts_str}\n\nTell me which resonates, and we will build a sustainable habit together!"
        elif intent == "schedule_clear":
            assistant_reply = "I've cleared your schedule so you have a fresh, calm canvas. Take a deep breath — we can re-add only what truly matters whenever you are ready."
        elif intent == "schedule_inquiry":
            free_summary = format_free_time_summary(weekly_free_slots)
            assistant_reply = (
                f"Here is your calculated free time breakdown across the week:\n\n"
                f"{free_summary}\n\n"
                f"Which open time window would you like to use for your next habit?"
            )
        elif intent == "onboarding":
            sug = action_payload.get("data")
            if sug:
                dur = sug.get('duration_minutes', 30)
                dur_str = f"{dur // 60} hours" if dur >= 60 and dur % 60 == 0 else f"{dur} minutes"
                windows = sug.get("candidate_windows", [])
                win_text = "\n".join(f"{w['emoji']} **{w['start']}–{w['end']}** ({w['period']})" for w in windows) if windows else "🌅 **07:00–10:00**\n☀️ **12:00–15:00**\n🌇 **16:00–19:00**\n🌙 **19:30–22:30**"
                why_text = "\n".join(sug.get("why_bullets", ["✓ No schedule conflicts", f"✓ Large free block ({dur_str} available)", "✓ Fits high-consistency routine"]))
                assistant_reply = (
                    f"I found {len(windows) if windows else 4} possible windows for your **{dur_str}** {sug.get('name', 'routine')}:\n\n"
                    f"{win_text}\n\n"
                    f"**I suggested {sug.get('target_time', '07:00')} because:**\n"
                    f"{why_text}\n\n"
                    f"Which feels most realistic for you? Would you like me to schedule it?"
                )
            else:
                assistant_reply = (
                    "I'd love to help you build a new habit! What habit would you like to start and for how long? (e.g., 3 hours of studying, workout, or coding)"
                )
        elif intent == "habit_confirm":
            name = action_payload.get("name", "Your habit")
            time_str = action_payload.get("target_time", "")
            if persona["id"] == "dramatic":
                assistant_reply = f"Yay!! ✨😭 '{name}' is officially locked in at {time_str}! +50 XP awarded! Let's do this together!"
            elif persona["id"] == "hopeful":
                assistant_reply = f"Wonderful. '{name}' is lovingly scheduled at {time_str} (+50 XP). I believe in your journey."
            elif persona["id"] == "stoic":
                assistant_reply = f"Commitment confirmed: '{name}' locked at {time_str}. +50 XP recorded. Focus on execution."
            else:
                assistant_reply = f"LET'S GO! 🔥 '{name}' is locked in at {time_str} and you earned +50 XP! 🚀 Let's make today count."
        elif intent == "schedule_update":
            s_data = action_payload.get("data", {})
            conflicts = s_data.get("conflicts", [])
            conf_str = f"\n\n⚠️ **Notice:** This time window overlaps with your habit **{conflicts[0]['name']}** ({conflicts[0]['target_time']})." if conflicts else ""
            assistant_reply = (
                f"I've prepared this schedule update for you:\n\n"
                f"📅 **{s_data.get('label', 'Commitment')}**\n"
                f"🕒 **{s_data.get('start', '09:00')} – {s_data.get('end', '17:00')}** on **{s_data.get('days_str', 'Monday')}**"
                f"{conf_str}\n\n"
                f"Would you like me to apply this update to your schedule?"
            )
        elif intent == "schedule_confirm":
            assistant_reply = "Your schedule has been officially updated and saved! I've recalculated your open free windows for your habits."
        elif intent == "schedule_cancel":
            assistant_reply = "Understood! I've cancelled the schedule update — your existing routine remains untouched."
        elif intent == "checkin_response":
            if action_payload.get("type") == "checkin_ambiguous":
                names = ", ".join(h["name"] for h in habits)
                assistant_reply = f"Quick check — which habit are you checking in about? You have: {names}."
            elif action_payload.get("completed"):
                habit_name = action_payload.get("habit", {}).get("name", "your habit")
                if persona["id"] == "dramatic":
                    assistant_reply = f"*sobs happily* You finished '{habit_name}' today?! I'm so proud of you! ✨😭 +50 XP!"
                elif persona["id"] == "hopeful":
                    assistant_reply = f"What a peaceful victory. You completed '{habit_name}' and nurtured your growth (+50 XP). 🌱"
                elif persona["id"] == "stoic":
                    assistant_reply = f"'{habit_name}' completed. Discipline maintained. +50 XP awarded."
                else:
                    assistant_reply = f"BOOM! 💥 Fantastic job finishing '{habit_name}'! +50 XP awarded and your consistency streak is on fire! 🔥"
            else:
                if persona["id"] == "dramatic":
                    assistant_reply = "Oh no... 🥺💔 It hurts a tiny bit, but don't worry! I understand life happens. I've softened tomorrow's session so you can bounce right back!"
                elif persona["id"] == "hopeful":
                    assistant_reply = "Be gentle with yourself. Growth has ebbs and flows. I've lightened tomorrow's duration so you can start with calm ease. 🌱"
                elif persona["id"] == "stoic":
                    assistant_reply = "Friction logged. System recalibrated. Tomorrow's session scaled back to secure baseline consistency."
                else:
                    assistant_reply = "Champions take tactical breathers! 🛡️ I've noted what got in the way and micro-adapted your next session to make tomorrow's comeback effortless!"
        else:
            assistant_reply = (
                "I'm here to optimize your routine. Let me know your daily schedule, a habit you want to start, or how your check-ins went!"
            )

    # Store assistant reply in chat_history
    store_chat_message(user_id, "assistant", assistant_reply, db_path=db_path)

    refreshed_habits = habit_manager.get_active_habits(user_id, db_path=db_path)
    refreshed_gamification = gamification_engine.get_user_xp_data(user_id, db_path=db_path)

    return {
        "reply": assistant_reply,
        "intent": intent,
        "action_payload": action_payload,
        "user_state": {
            "habits": refreshed_habits,
            "proactive_suggestion": proactive_suggestion,
            "gamification": refreshed_gamification
        }
    }


def simulate_followup_checkin(user_id, habit_id=None, personality="enthusiastic", db_path=None):
    """
    Simulates the moment after a scheduled habit time has passed with personality tone.
    """
    habits = habit_manager.get_active_habits(user_id, db_path=db_path)
    if not habits:
        return {
            "reply": "You don't have any active habits scheduled yet. Tell me what habit you'd like to build!",
            "intent": "general_chat",
            "action_payload": {}
        }
    
    target_habit = None
    if habit_id:
        target_habit = next((h for h in habits if h["id"] == habit_id), None)
    if not target_habit:
        target_habit = habits[0]
        
    set_pending_action(user_id, "checkin_target", {"habit_id": target_habit["id"], "habit_name": target_habit["name"]}, db_path=db_path)
    
    p_key = personality.lower()
    if p_key == "dramatic":
        prompt_msg = (
            f"⏰ *peeks nervously* The clock passed {target_habit['target_time']} for **{target_habit['name']}**!\n\n"
            f"Please tell me good news... did you get to complete it today? 🥺✨"
        )
    elif p_key == "hopeful":
        prompt_msg = (
            f"⏰ Gentle Check-in: The scheduled window for **{target_habit['name']}** ({target_habit['target_time']}) has passed today.\n\n"
            f"I hope your day went with peace. Did you have a moment to complete your session? 🌱"
        )
    elif p_key == "stoic":
        prompt_msg = (
            f"⏰ Time Follow-up: Target window for **{target_habit['name']}** ({target_habit['target_time']}) has elapsed.\n\n"
            f"Confirm execution status."
        )
    else:
        prompt_msg = (
            f"⏰ Time Check, Champion! The scheduled time for **{target_habit['name']}** ({target_habit['target_time']}) has passed today! 🚀\n\n"
            f"Did you smash your session?"
        )
    
    action_payload = {
        "type": "checkin_prompt",
        "habit": target_habit
    }
    
    store_chat_message(user_id, "assistant", prompt_msg, db_path=db_path)
    
    return {
        "reply": prompt_msg,
        "intent": "checkin_prompt",
        "action_payload": action_payload,
        "user_state": {
            "habits": habits,
            "gamification": gamification_engine.get_user_xp_data(user_id, db_path=db_path)
        }
    }