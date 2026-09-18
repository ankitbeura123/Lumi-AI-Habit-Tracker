import os
import sys
import unittest
import json
from datetime import datetime, timedelta

TEST_DB = os.path.join(os.path.dirname(__file__), "test_habits.db")

import db
import schedule_manager
import habit_manager
import behavior_analyzer
import companion_brain
import gamification_engine
from app import app

class TestHabitCompanionCore(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if os.path.exists(TEST_DB):
            try:
                os.remove(TEST_DB)
            except Exception:
                pass
        db.init_db(TEST_DB)

    @classmethod
    def tearDownClass(cls):
        if os.path.exists(TEST_DB):
            try:
                os.remove(TEST_DB)
            except Exception:
                pass

    def setUp(self):
        self.user_id = "test_user"
        db.ensure_user_exists(self.user_id, "Test User", db_path=TEST_DB)
        # Clear tables
        conn = db.get_db_connection(TEST_DB)
        cursor = conn.cursor()
        cursor.execute("DELETE FROM checkins")
        cursor.execute("DELETE FROM habits")
        cursor.execute("DELETE FROM schedule")
        cursor.execute("DELETE FROM chat_history")
        cursor.execute("DELETE FROM behavior_log")
        conn.commit()
        conn.close()

    def test_database_schema(self):
        conn = db.get_db_connection(TEST_DB)
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = [row["name"] for row in cursor.fetchall()]
        conn.close()
        expected = ["users", "schedule", "habits", "checkins", "chat_history", "behavior_log"]
        for t in expected:
            self.assertIn(t, tables, f"Missing table {t}")

    def test_schedule_and_free_slots(self):
        # Add schedule blocks
        schedule_manager.add_or_update_schedule_block(
            self.user_id, "Monday", "09:00", "12:00", "CS 101", is_free_time=False, db_path=TEST_DB
        )
        schedule_manager.add_or_update_schedule_block(
            self.user_id, "Monday", "14:00", "16:00", "Physics Lab", is_free_time=False, db_path=TEST_DB
        )

        free_slots = schedule_manager.get_free_time_slots(self.user_id, "Monday", db_path=TEST_DB)
        self.assertTrue(len(free_slots) >= 2)
        starts = [s["start"] for s in free_slots]
        self.assertIn("07:00", starts)
        self.assertIn("12:00", starts)
        self.assertIn("16:00", starts)

    def test_batch_schedule_and_overnight_span(self):
        # Add 8 hours sleep from 23:00 to 07:00 across all 7 days
        batch_res = schedule_manager.add_batch_schedule_blocks(
            self.user_id, "all", "23:00", "07:00", "Sleep", is_free_time=False, db_path=TEST_DB
        )
        self.assertEqual(len(batch_res["created_blocks"]), 7)
        self.assertEqual(len(batch_res["days"]), 7)

        # Free slots on Monday should not start before 07:00
        free_slots = schedule_manager.get_free_time_slots(self.user_id, "Monday", start_boundary="06:00", end_boundary="22:00", db_path=TEST_DB)
        starts = [s["start"] for s in free_slots]
        self.assertIn("07:00", starts)
        self.assertNotIn("06:00", starts)

    def test_clone_and_clear_schedule(self):
        schedule_manager.add_or_update_schedule_block(
            self.user_id, "Monday", "10:00", "11:30", "Seminar", is_free_time=False, db_path=TEST_DB
        )
        clone_res = schedule_manager.clone_day_schedule(
            self.user_id, "Monday", ["Wednesday", "Friday"], db_path=TEST_DB
        )
        self.assertEqual(clone_res["status"], "success")
        self.assertEqual(len(clone_res["targets"]), 2)

        # Clear Friday
        deleted = schedule_manager.clear_day_schedule(self.user_id, "Friday", db_path=TEST_DB)
        self.assertGreaterEqual(deleted, 1)

    def test_habit_creation_and_streaks(self):
        # Create habit
        h_id = habit_manager.save_confirmed_habit(
            self.user_id, "Morning Workout", "07:30", 30, "daily", db_path=TEST_DB
        )
        self.assertTrue(h_id > 0)

        # Record checkins for 3 consecutive days
        d1 = (datetime.now() - timedelta(days=2)).strftime("%Y-%m-%d")
        d2 = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
        d3 = datetime.now().strftime("%Y-%m-%d")

        habit_manager.record_checkin(h_id, True, checkin_date=d1, db_path=TEST_DB)
        habit_manager.record_checkin(h_id, True, checkin_date=d2, db_path=TEST_DB)
        habit_manager.record_checkin(h_id, True, checkin_date=d3, db_path=TEST_DB)

        streaks = habit_manager.get_habit_streaks(self.user_id, db_path=TEST_DB)
        self.assertEqual(streaks[h_id]["current_streak"], 3)
        self.assertEqual(streaks[h_id]["best_streak"], 3)
        self.assertEqual(streaks[h_id]["total_completions"], 3)

    def test_habit_adaptation_on_miss(self):
        h_id = habit_manager.save_confirmed_habit(
            self.user_id, "Coding Practice", "19:00", 60, "daily", db_path=TEST_DB
        )
        res = habit_manager.record_checkin(
            h_id, False, reason_if_missed="Tired and session was too long", db_path=TEST_DB
        )
        self.assertFalse(res["completed"])
        self.assertIsNotNone(res["adapted_info"])

        # Check that habit duration in DB was adapted down
        habit = habit_manager.get_habit_by_id(h_id, db_path=TEST_DB)
        self.assertLess(habit["duration_minutes"], 60)

    def test_schedule_conflict_and_reschedule(self):
        # Habit at 14:00 on Tuesdays
        h_id = habit_manager.save_confirmed_habit(
            self.user_id, "Afternoon Reading", "14:00", 45, "daily", db_path=TEST_DB
        )
        # Add conflicting schedule block 13:30 - 15:00
        change_res = schedule_manager.handle_schedule_change(
            self.user_id, "Tuesday", "New Class added", start_time="13:30", end_time="15:00", label="Math Seminar", db_path=TEST_DB
        )
        self.assertEqual(len(change_res["conflicts"]), 1)
        self.assertEqual(change_res["conflicts"][0]["id"], h_id)
        self.assertTrue(len(change_res["reschedule_suggestions"]) > 0)

    def test_behavior_pattern_analysis(self):
        h_id = habit_manager.save_confirmed_habit(
            self.user_id, "Guitar", "17:00", 30, "daily", db_path=TEST_DB
        )
        # Seed checkins
        habit_manager.record_checkin(h_id, True, checkin_date="2026-08-01", db_path=TEST_DB)
        habit_manager.record_checkin(h_id, False, reason_if_missed="Work meeting ran late", checkin_date="2026-08-02", db_path=TEST_DB)
        habit_manager.record_checkin(h_id, False, reason_if_missed="Exhausted after class", checkin_date="2026-08-03", db_path=TEST_DB)

        patterns = behavior_analyzer.analyze_patterns(self.user_id, db_path=TEST_DB)
        self.assertEqual(patterns["total_checkins"], 3)
        self.assertEqual(patterns["total_completed"], 1)
        self.assertTrue("Schedule / Class / Work Conflict" in patterns["reason_clusters"] or "Tiredness & Low Energy" in patterns["reason_clusters"])

    def test_gamification_engine(self):
        h_id = habit_manager.save_confirmed_habit(
            self.user_id, "Morning Meditation", "07:00", 15, "daily", db_path=TEST_DB
        )
        habit_manager.record_checkin(h_id, True, db_path=TEST_DB)
        
        xp_data = gamification_engine.get_user_xp_data(self.user_id, db_path=TEST_DB)
        self.assertGreater(xp_data["total_xp"], 0)
        self.assertIn("first_step", xp_data["unlocked_badge_ids"])
        self.assertEqual(len(xp_data["daily_quests"]), 3)
        self.assertTrue(xp_data["daily_quests"][0]["completed"])

    def test_simulated_followup_and_adaptation(self):
        h_id = habit_manager.save_confirmed_habit(
            self.user_id, "Evening Stretch", "20:00", 25, "daily", db_path=TEST_DB
        )
        followup = companion_brain.simulate_followup_checkin(self.user_id, habit_id=h_id, db_path=TEST_DB)
        self.assertEqual(followup["intent"], "checkin_prompt")
        self.assertEqual(followup["action_payload"]["habit"]["id"], h_id)

    def test_chat_history_storage(self):
        db.store_chat_message(self.user_id, "user", "Hello companion", db_path=TEST_DB)
        db.store_chat_message(self.user_id, "assistant", "Hello! How can I help you?", db_path=TEST_DB)
        hist = db.get_chat_history(self.user_id, limit=10, db_path=TEST_DB)
        self.assertEqual(len(hist), 2)
        self.assertEqual(hist[0]["role"], "user")
        self.assertEqual(hist[1]["role"], "assistant")

    def test_flask_endpoints(self):
        client = app.test_client()
        unique_user = f"api_user_{datetime.now().timestamp()}"
        
        # Health check
        res = client.get("/api/health")
        self.assertEqual(res.status_code, 200)

        # Config Mistral Key
        res = client.post("/api/config/mistral-key", json={"api_key": "test_mock_key"})
        self.assertEqual(res.status_code, 200)

        # Post Schedule (single)
        res = client.post("/api/schedule", json={
            "user_id": unique_user,
            "day": "Monday",
            "start": "09:00",
            "end": "11:00",
            "label": "Deep Work"
        })
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json["status"], "success")

        # Post Schedule (batch everyday)
        res = client.post("/api/schedule/batch", json={
            "user_id": unique_user,
            "days": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
            "start": "23:00",
            "end": "07:00",
            "label": "Sleep & Rest"
        })
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.json["days"]), 7)

        # Post Habit
        res = client.post("/api/habits", json={
            "user_id": unique_user,
            "name": "Meditation",
            "target_time": "08:00",
            "duration_minutes": 15,
            "frequency": "daily"
        })
        self.assertEqual(res.status_code, 200)
        h_id = res.json["habit_id"]

        # Post Checkin
        res = client.post("/api/checkins", json={
            "habit_id": h_id,
            "completed": True
        })
        self.assertEqual(res.status_code, 200)

        # Get Gamification
        res = client.get(f"/api/gamification/{unique_user}")
        self.assertEqual(res.status_code, 200)
        self.assertIn("total_xp", res.json)

        # Simulate Followup
        res = client.post("/api/simulate-followup", json={"user_id": unique_user, "habit_id": h_id})
        self.assertEqual(res.status_code, 200)
        self.assertIn("reply", res.json)

        # Get Habits
        res = client.get(f"/api/habits/{unique_user}")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.json["habits"]), 1)

        # Chat
        res = client.post("/api/chat", json={
            "user_id": unique_user,
            "message": "I want to start a 20-minute evening stretching routine"
        })
        self.assertEqual(res.status_code, 200)
        self.assertIn("reply", res.json)

        # Chat History
        res = client.get(f"/api/chat-history/{unique_user}")
        self.assertEqual(res.status_code, 200)
        self.assertTrue(len(res.json["chat_history"]) >= 2)


if __name__ == "__main__":
    unittest.main()
