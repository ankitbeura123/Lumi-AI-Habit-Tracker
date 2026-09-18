import unittest
import os
import db
import habit_manager
import schedule_manager
from companion_brain import handle_message, simulate_followup_checkin, LUMI_PERSONALITIES

TEST_DB = "test_personality.db"

class TestPersonalitySystem(unittest.TestCase):
    def setUp(self):
        if os.path.exists(TEST_DB):
            try:
                os.remove(TEST_DB)
            except Exception:
                pass
        db.init_db(TEST_DB)
        self.user_id = "test_user_persona"
        db.ensure_user_exists(self.user_id, "Persona Tester", db_path=TEST_DB)
        
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
        
        # Add a habit
        habit_manager.save_confirmed_habit(
            self.user_id,
            name="Deep Coding",
            target_time="09:00",
            duration_minutes=60,
            db_path=TEST_DB
        )


    def tearDown(self):
        if os.path.exists(TEST_DB):
            try:
                os.remove(TEST_DB)
            except Exception:
                pass

    def test_personality_definitions(self):
        self.assertIn("enthusiastic", LUMI_PERSONALITIES)
        self.assertIn("hopeful", LUMI_PERSONALITIES)
        self.assertIn("dramatic", LUMI_PERSONALITIES)
        self.assertIn("stoic", LUMI_PERSONALITIES)

    def test_simulated_followup_personalities(self):
        res_enthusiastic = simulate_followup_checkin(self.user_id, personality="enthusiastic", db_path=TEST_DB)
        self.assertIn("Champion", res_enthusiastic["reply"])

        res_hopeful = simulate_followup_checkin(self.user_id, personality="hopeful", db_path=TEST_DB)
        self.assertIn("peace", res_hopeful["reply"].lower())

        res_dramatic = simulate_followup_checkin(self.user_id, personality="dramatic", db_path=TEST_DB)
        self.assertIn("peeks", res_dramatic["reply"])

        res_stoic = simulate_followup_checkin(self.user_id, personality="stoic", db_path=TEST_DB)
        self.assertIn("execution", res_stoic["reply"].lower())

    def test_checkin_responses_personalities(self):
        # Enthusiastic miss
        res_enth_miss = handle_message(self.user_id, "I couldn't do my Deep Coding session today, had an urgent meeting", personality="enthusiastic", db_path=TEST_DB)
        self.assertTrue(len(res_enth_miss["reply"]) > 0)

        # Dramatic miss
        res_dram_miss = handle_message(self.user_id, "I missed Deep Coding today", personality="dramatic", db_path=TEST_DB)
        self.assertTrue(len(res_dram_miss["reply"]) > 0)

        # Hopeful completion
        res_hope_done = handle_message(self.user_id, "I finished my Deep Coding habit today!", personality="hopeful", db_path=TEST_DB)
        self.assertTrue(len(res_hope_done["reply"]) > 0)

    def test_goal_exploration_companion(self):
        """Test Problem 4: Broad goals like 'I want to get fit' trigger exploration chips rather than immediate assumptions."""
        res = handle_message(self.user_id, "I want to get fit", db_path=TEST_DB)
        self.assertEqual(res["action_payload"]["type"], "goal_exploration")
        self.assertIn("options", res["action_payload"])
        self.assertTrue(len(res["action_payload"]["options"]) >= 4)
        self.assertTrue(any("Weight loss" in opt for opt in res["action_payload"]["options"]))

    def test_emotional_support_companion(self):
        """Test Problem 3: Empathetic response when user is overwhelmed."""
        res = handle_message(self.user_id, "I'm feeling so overwhelmed", db_path=TEST_DB)
        self.assertEqual(res["action_payload"]["type"], "emotional_support")
        self.assertIn("pressure", res["reply"].lower())
        self.assertTrue(len(res["action_payload"]["options"]) >= 4)

    def test_candidate_windows_and_why_reasoning(self):
        """Test Problem 1, 2, 6: Multiple candidate time windows + Why reasoning checklist without immediate auto-insert."""
        res = handle_message(self.user_id, "I want to study 3 hours daily", db_path=TEST_DB)
        self.assertEqual(res["action_payload"]["type"], "habit_options")
        data = res["action_payload"]["data"]
        self.assertEqual(data["duration_minutes"], 180)
        self.assertTrue(len(data["candidate_windows"]) >= 3)
        self.assertTrue(len(data["why_bullets"]) >= 2)
        # Verify habit was not directly inserted yet
        all_habits = habit_manager.get_active_habits(self.user_id, db_path=TEST_DB)
        study_habits = [h for h in all_habits if "study" in h["name"].lower()]
        self.assertEqual(len(study_habits), 0)

    def test_behavioral_memory_and_stats(self):
        """Test Problem 7: Behavioral memory and time-of-day analytics."""
        import behavior_analyzer
        h_id = habit_manager.save_confirmed_habit(self.user_id, "Evening Workout", "19:00", 30, db_path=TEST_DB)
        habit_manager.record_checkin(h_id, False, reason_if_missed="Tired after class", checkin_date="2026-08-01", db_path=TEST_DB)
        habit_manager.record_checkin(h_id, False, reason_if_missed="Low energy in evenings", checkin_date="2026-08-02", db_path=TEST_DB)
        
        mem_summary = behavior_analyzer.get_behavioral_memory_summary(self.user_id, db_path=TEST_DB)
        self.assertIn("Evening", mem_summary)
        
        stats = behavior_analyzer.calculate_time_of_day_stats(self.user_id, db_path=TEST_DB)
        self.assertEqual(stats["evening"]["total"], 2)
        self.assertEqual(stats["evening"]["completed"], 0)

    def test_habit_struggle_does_not_create_habit(self):
        """Verify 'i cant do my habit' triggers empathetic support and friction options, NOT a habit named 'I cant do my habit'."""
        res = handle_message(self.user_id, "i cant do my habit", db_path=TEST_DB)
        self.assertEqual(res["action_payload"]["type"], "habit_struggle_support")
        self.assertIn("options", res["action_payload"])
        self.assertTrue(len(res["action_payload"]["options"]) >= 3)
        # Ensure no bogus habit was created
        all_habits = habit_manager.get_active_habits(self.user_id, db_path=TEST_DB)
        cant_habits = [h for h in all_habits if "cant" in h["name"].lower() or "can't" in h["name"].lower()]
        self.assertEqual(len(cant_habits), 0)

    def test_clean_schedule_prompt(self):
        """Verify 'clean schedule' clears all commitments cleanly."""
        schedule_manager.add_or_update_schedule_block(self.user_id, "Monday", "09:00", "12:00", "Lectures", False, db_path=TEST_DB)
        res = handle_message(self.user_id, "clean schedule", db_path=TEST_DB)
        self.assertEqual(res["action_payload"]["type"], "schedule_cleared")
        sched = schedule_manager.get_user_schedule(self.user_id, db_path=TEST_DB)
        self.assertEqual(len(sched), 0)

    def test_clear_chat_prompt_and_db(self):
        """Verify 'clear chat' empties chat history."""
        db.store_chat_message(self.user_id, "user", "hello lumi", db_path=TEST_DB)
        res = handle_message(self.user_id, "clear chat", db_path=TEST_DB)
        self.assertEqual(res["action_payload"]["type"], "chat_cleared")
        hist = db.get_full_chat_history(self.user_id, db_path=TEST_DB)
        # Only the fresh greeting remains
        self.assertEqual(len(hist), 1)
        self.assertEqual(hist[0]["role"], "assistant")

    def test_schedule_change_requires_confirmation(self):
        """Verify schedule changes ask for confirmation first, and commit only on confirmation."""
        # 1. Propose schedule change
        res = handle_message(self.user_id, "I have classes from 10:00 to 14:00 on Mondays", db_path=TEST_DB)
        self.assertEqual(res["action_payload"]["type"], "schedule_change_proposal")
        self.assertEqual(res["action_payload"]["data"]["start"], "10:00")
        self.assertEqual(res["action_payload"]["data"]["end"], "14:00")
        
        # Verify not committed yet
        sched = schedule_manager.get_user_schedule(self.user_id, db_path=TEST_DB)
        class_blocks = [s for s in sched if "class" in s.get("activity_label", "").lower() or "10:00" in s["start_time"]]
        self.assertEqual(len(class_blocks), 0)

        # 2. Confirm schedule change
        confirm_res = handle_message(self.user_id, "confirm schedule", db_path=TEST_DB)
        self.assertEqual(confirm_res["action_payload"]["type"], "schedule_changed")
        
        # Verify now committed
        sched_after = schedule_manager.get_user_schedule(self.user_id, db_path=TEST_DB)
        class_blocks_after = [s for s in sched_after if "class" in s.get("activity_label", "").lower() or "10:00" in s["start_time"]]
        self.assertEqual(len(class_blocks_after), 1)
        self.assertEqual(class_blocks_after[0]["start_time"], "10:00")
        self.assertEqual(class_blocks_after[0]["end_time"], "14:00")


if __name__ == '__main__':
    unittest.main()

