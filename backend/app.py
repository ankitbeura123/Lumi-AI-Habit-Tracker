import os
from datetime import datetime, timedelta
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from dotenv import load_dotenv

import db
import schedule_manager
import habit_manager
import behavior_analyzer
import companion_brain
import gamification_engine

load_dotenv()

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})

# Initialize database on startup
db.init_db()

@app.route("/api/health", methods=["GET"])
def health_check():
    client = habit_manager.get_mistral_client()
    return jsonify({
        "status": "ok",
        "service": "AI Habit Companion Backend",
        "mistral_configured": bool(client),
        "timestamp": datetime.now().isoformat()
    })

# Mistral Key Configuration
@app.route("/api/config/mistral-key", methods=["GET", "POST"])
def config_mistral_key():
    if request.method == "POST":
        data = request.get_json() or {}
        api_key = data.get("api_key", "").strip()
        habit_manager.set_custom_mistral_api_key(api_key)
        client = habit_manager.get_mistral_client()
        return jsonify({
            "status": "success",
            "mistral_configured": bool(client),
            "message": "Mistral API Key updated successfully" if client else "Key removed/empty"
        })
    else:
        client = habit_manager.get_mistral_client()
        return jsonify({
            "mistral_configured": bool(client)
        })

# 1. Chat Endpoints
@app.route("/api/chat", methods=["POST"])
def chat():
    data = request.get_json() or {}
    user_id = data.get("user_id", "user_default")
    message = data.get("message", "").strip()
    personality = data.get("personality", "enthusiastic")

    if not message:
        return jsonify({"error": "Message is required"}), 400

    response = companion_brain.handle_message(user_id, message, personality=personality)
    return jsonify(response)

@app.route("/api/simulate-followup", methods=["POST"])
def simulate_followup():
    data = request.get_json() or {}
    user_id = data.get("user_id", "user_default")
    habit_id = data.get("habit_id")
    personality = data.get("personality", "enthusiastic")
    res = companion_brain.simulate_followup_checkin(user_id, habit_id=habit_id, personality=personality)
    return jsonify(res)

# 2. Schedule Endpoints
@app.route("/api/schedule", methods=["POST"])
def add_schedule():
    data = request.get_json() or {}
    user_id = data.get("user_id", "user_default")
    days = data.get("days")
    day = data.get("day", "Monday")
    start = data.get("start", "09:00")
    end = data.get("end", "10:00")
    label = data.get("label", "Commitment")
    is_free_time = data.get("is_free_time", False)
    block_id = data.get("block_id")

    # If multiple days provided or batch requested
    if days and isinstance(days, (list, str)):
        res = schedule_manager.add_batch_schedule_blocks(
            user_id=user_id,
            days=days,
            start=start,
            end=end,
            label=label,
            is_free_time=is_free_time
        )
        return jsonify({
            "status": "success",
            "batch": True,
            "created_blocks": res["created_blocks"],
            "days": res["days"],
            "conflicts": res["conflicts"]
        })

    saved_id = schedule_manager.add_or_update_schedule_block(
        user_id=user_id,
        day=day,
        start=start,
        end=end,
        label=label,
        is_free_time=is_free_time,
        block_id=block_id
    )

    # Check for conflicts
    conflicts = schedule_manager.check_habit_conflicts(user_id, day, start, end)

    return jsonify({
        "status": "success",
        "block_id": saved_id,
        "conflicts": conflicts
    })

@app.route("/api/schedule/batch", methods=["POST"])
def add_batch_schedule():
    data = request.get_json() or {}
    user_id = data.get("user_id", "user_default")
    days = data.get("days", ["Monday"])
    start = data.get("start", "23:00")
    end = data.get("end", "07:00")
    label = data.get("label", "Sleep & Rest")
    is_free_time = data.get("is_free_time", False)

    res = schedule_manager.add_batch_schedule_blocks(
        user_id=user_id,
        days=days,
        start=start,
        end=end,
        label=label,
        is_free_time=is_free_time
    )

    return jsonify({
        "status": "success",
        "created_blocks": res["created_blocks"],
        "days": res["days"],
        "conflicts": res["conflicts"]
    })

@app.route("/api/schedule/clone", methods=["POST"])
def clone_schedule():
    data = request.get_json() or {}
    user_id = data.get("user_id", "user_default")
    source_day = data.get("source_day", "Monday")
    target_days = data.get("target_days", [])

    res = schedule_manager.clone_day_schedule(
        user_id=user_id,
        source_day=source_day,
        target_days=target_days
    )
    return jsonify(res)

@app.route("/api/schedule/<user_id>", methods=["GET"])
def get_schedule(user_id):
    blocks = schedule_manager.get_user_schedule(user_id)
    weekly_free_slots = {}
    for day in schedule_manager.DAYS_OF_WEEK:
        slots = schedule_manager.get_free_time_slots(user_id, day)
        weekly_free_slots[day] = slots

    return jsonify({
        "schedule": blocks,
        "free_slots": weekly_free_slots
    })

@app.route("/api/schedule/<user_id>/<int:block_id>", methods=["DELETE"])
def delete_schedule(user_id, block_id):
    deleted = schedule_manager.delete_schedule_block(user_id, block_id)
    return jsonify({"status": "success" if deleted else "not_found"})

@app.route("/api/schedule/<user_id>/day/<day>", methods=["DELETE"])
def clear_day(user_id, day):
    deleted_count = schedule_manager.clear_day_schedule(user_id, day)
    return jsonify({"status": "success", "deleted_count": deleted_count})

@app.route("/api/schedule/<user_id>/all", methods=["DELETE"])
def clear_all(user_id):
    deleted_count = schedule_manager.clear_all_schedule(user_id)
    return jsonify({"status": "success", "deleted_count": deleted_count})


# 3. Habits Endpoints
@app.route("/api/habits/<user_id>", methods=["GET"])
def get_habits(user_id):
    habits = habit_manager.get_active_habits(user_id)
    return jsonify({"habits": habits})

@app.route("/api/habits", methods=["POST"])
def create_habit():
    data = request.get_json() or {}
    user_id = data.get("user_id", "user_default")
    name = data.get("name", "New Habit")
    target_time = data.get("target_time", "08:00")
    duration_minutes = int(data.get("duration_minutes", 30))
    frequency = data.get("frequency", "daily")

    habit_id = habit_manager.save_confirmed_habit(
        user_id=user_id,
        name=name,
        target_time=target_time,
        duration_minutes=duration_minutes,
        frequency=frequency
    )
    return jsonify({"status": "success", "habit_id": habit_id})

@app.route("/api/habits/suggest", methods=["POST"])
def suggest_habit_from_goal():
    data = request.get_json() or {}
    user_id = data.get("user_id", "user_default")
    goal = data.get("goal", "")
    if not goal:
        return jsonify({"error": "Goal text is required"}), 400
    suggestion = habit_manager.create_habit_from_goal(user_id, goal)
    return jsonify({"suggestion": suggestion})

@app.route("/api/habits/<user_id>/<int:habit_id>", methods=["DELETE"])
def delete_habit(user_id, habit_id):
    conn = db.get_db_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE habits SET status = 'paused' WHERE id = ? AND user_id = ?", (habit_id, user_id))
    affected = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return jsonify({"status": "success" if affected else "not_found"})

# 4. Checkins Endpoints
@app.route("/api/checkins", methods=["POST"])
def record_checkin():
    data = request.get_json() or {}
    habit_id = data.get("habit_id")
    completed = bool(data.get("completed", True))
    reason_if_missed = data.get("reason_if_missed")
    checkin_date = data.get("date")

    if not habit_id:
        return jsonify({"error": "habit_id is required"}), 400

    res = habit_manager.record_checkin(
        habit_id=habit_id,
        completed=completed,
        reason_if_missed=reason_if_missed,
        checkin_date=checkin_date
    )
    return jsonify(res)

@app.route("/api/checkins/<user_id>", methods=["GET"])
def get_checkins(user_id):
    conn = db.get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        """SELECT c.id, c.habit_id, c.date, c.completed, c.reason_if_missed, c.adapted_duration, c.created_at, h.name as habit_name
           FROM checkins c
           JOIN habits h ON c.habit_id = h.id
           WHERE h.user_id = ?
           ORDER BY c.date DESC""",
        (user_id,)
    )
    rows = cursor.fetchall()
    conn.close()
    return jsonify({"checkins": [dict(r) for r in rows]})

# 5. Behavior Pattern Analysis & Proactive Suggestions
@app.route("/api/behavior/<user_id>", methods=["GET"])
def get_behavior(user_id):
    patterns = behavior_analyzer.analyze_patterns(user_id)
    streaks = habit_manager.get_habit_streaks(user_id)
    return jsonify({
        "patterns": patterns,
        "streaks": streaks
    })

@app.route("/api/proactive/<user_id>", methods=["GET"])
def get_proactive(user_id):
    suggestion = behavior_analyzer.generate_proactive_suggestion(user_id)
    return jsonify({"proactive_suggestion": suggestion})

# 6. Gamification Endpoint
@app.route("/api/gamification/<user_id>", methods=["GET"])
def get_gamification(user_id):
    data = gamification_engine.get_user_xp_data(user_id)
    return jsonify(data)

# 7. Chat History Endpoint (Full log for analytics and review)
@app.route("/api/chat-history/<user_id>", methods=["GET"])
def get_chat_log(user_id):
    history = db.get_full_chat_history(user_id)
    return jsonify({"chat_history": history})

@app.route("/api/chat-history/<user_id>", methods=["DELETE"])
def clear_chat_history_endpoint(user_id):
    deleted = db.clear_chat_history(user_id)
    return jsonify({"status": "success", "deleted_count": deleted})

@app.route("/api/reset-db", methods=["POST"])
def reset_db_endpoint():
    db.reset_all_data()
    return jsonify({"status": "success", "message": "All habits, schedules, and database logs reset successfully."})


# 8. Helper Seed Endpoint for Demonstrating Real Traction / Patterns
@app.route("/api/seed-demo", methods=["POST"])
def seed_demo_data():
    data = request.get_json() or {}
    user_id = data.get("user_id", "user_default")
    
    # 1. Setup weekly schedule with batch sleep (8h every day) and student commitments
    schedule_manager.clear_all_schedule(user_id)
    schedule_manager.add_batch_schedule_blocks(user_id, "all", "23:00", "07:00", "💤 Sleep & Rest", False)
    schedule_manager.add_batch_schedule_blocks(user_id, "weekdays", "13:00", "14:00", "🍱 Lunch Break", False)
    schedule_manager.add_or_update_schedule_block(user_id, "Monday", "09:00", "12:00", "🎓 CS Lectures", False)
    schedule_manager.add_or_update_schedule_block(user_id, "Monday", "14:00", "16:00", "🔬 Algorithms Lab", False)
    schedule_manager.add_or_update_schedule_block(user_id, "Tuesday", "14:00", "18:00", "💼 Internship Shift", False)
    schedule_manager.add_or_update_schedule_block(user_id, "Wednesday", "09:00", "12:00", "🎓 CS Lectures", False)
    schedule_manager.add_or_update_schedule_block(user_id, "Thursday", "14:00", "18:00", "💼 Internship Shift", False)
    schedule_manager.add_or_update_schedule_block(user_id, "Friday", "10:00", "13:00", "📚 Group Project Work", False)

    # 2. Add Habits
    h1 = habit_manager.save_confirmed_habit(user_id, "Morning Deep Study", "07:30", 45, "daily")
    h2 = habit_manager.save_confirmed_habit(user_id, "Evening Workout & Cardio", "18:30", 30, "daily")
    h3 = habit_manager.save_confirmed_habit(user_id, "Nightly Reading & Reflection", "21:30", 20, "daily")
    
    # 3. Seed historical check-ins over the past 14 days
    today = datetime.now().date()
    for day_offset in range(14, 0, -1):
        check_date = today - timedelta(days=day_offset)
        d_str = check_date.strftime("%Y-%m-%d")
        day_of_week = check_date.strftime("%A")
        
        # Morning study: mostly completed, missed on some Tuesdays due to late night
        if day_of_week == "Tuesday":
            habit_manager.record_checkin(h1, False, "Tired from late night prep", checkin_date=d_str)
        else:
            habit_manager.record_checkin(h1, True, checkin_date=d_str)
            
        # Evening workout: missed on Thursdays due to job conflict
        if day_of_week in ["Thursday", "Tuesday"]:
            habit_manager.record_checkin(h2, False, "Work / Internship shift ran late", checkin_date=d_str)
        else:
            habit_manager.record_checkin(h2, True, checkin_date=d_str)
            
        # Nightly reading: steady completion
        habit_manager.record_checkin(h3, True, checkin_date=d_str)
        
    return jsonify({"status": "seeded", "message": "Realistic demo data seeded successfully."})

# -------------------------------------------------------------
# Static Frontend Serving (Serves compiled React SPA from dist)
# -------------------------------------------------------------
frontend_dist = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend", "dist"))

@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve_frontend(path):
    if path.startswith("api/"):
        return jsonify({"error": "Endpoint not found"}), 404
    if os.path.exists(frontend_dist):
        file_path = os.path.join(frontend_dist, path)
        if path != "" and os.path.isfile(file_path):
            return send_from_directory(frontend_dist, path)
        index_file = os.path.join(frontend_dist, "index.html")
        if os.path.exists(index_file):
            return send_from_directory(frontend_dist, "index.html")
    return jsonify({
        "status": "backend_running",
        "service": "AI Habit Companion Backend",
        "message": "Backend API is online. Frontend build dist not found. Run Vite dev server at http://localhost:3000 or build frontend with npm run build."
    })

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    print(f"Starting AI Habit Companion API server on port {port}...")
    app.run(host="0.0.0.0", port=port, debug=True)
