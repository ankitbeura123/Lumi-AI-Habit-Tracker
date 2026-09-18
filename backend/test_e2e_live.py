import sys
sys.stdout.reconfigure(encoding='utf-8')
import urllib.request
import json
import time

BASE_URL = "http://127.0.0.1:5000/api"
USER_ID = f"live_test_user_{int(time.time())}"

def request(endpoint, method="GET", data=None):
    url = f"{BASE_URL}/{endpoint}"
    headers = {"Content-Type": "application/json"}
    body = json.dumps(data).encode("utf-8") if data else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        print(f"Error calling {url}: {e}")
        raise

print("==================================================")
print("RUNNING LIVE END-TO-END VERIFICATION SUITE")
print("==================================================")

# Step 1: Health check
health = request("health")
print(f"1. Health Check: status={health['status']}, service={health['service']}")
assert health["status"] == "ok"

# Step 2: Schedule Intake via Chat
sched_chat = request("chat", method="POST", data={
    "user_id": USER_ID,
    "message": "I have college classes Monday to Friday from 09:00 to 13:00 and sleep from 23:00 to 07:00 everyday"
})
print(f"2. Chat Schedule Intake Reply:\n   \"{sched_chat['reply']}\"")
assert "reply" in sched_chat

# Step 3: Verify Schedule & Free Slots
sched_data = request(f"schedule/{USER_ID}")
blocks = sched_data.get("schedule", [])
free_slots = sched_data.get("free_slots", {})
print(f"3. Stored Schedule Blocks: {len(blocks)} blocks recorded")
print(f"   Sample Monday Free Slots: {free_slots.get('Monday', [])}")
assert len(blocks) >= 1

# Step 4: Habit Goal Intake via Chat (testing 2-hour explicit duration)
habit_chat = request("chat", method="POST", data={
    "user_id": USER_ID,
    "message": "I want to study for 2 hours daily"
})
print(f"4. Habit Proposal Reply (2hr Goal):\n   \"{habit_chat['reply']}\"")
payload = habit_chat.get("action_payload", {})
assert payload.get("type") == "habit_suggestion"
print(f"   Proposed Time: {payload['data']['target_time']} ({payload['data']['duration_minutes']}m)")
print(f"   Alternative Free Slots: {payload['data'].get('alternative_slots')}")
assert payload["data"]["duration_minutes"] == 120, f"Expected 120 minutes, got {payload['data']['duration_minutes']}"

# Step 5: Confirm & Lock In Habit
habit_res = request("habits", method="POST", data={
    "user_id": USER_ID,
    "name": payload["data"]["name"],
    "target_time": payload["data"]["target_time"],
    "duration_minutes": payload["data"]["duration_minutes"],
    "frequency": "daily"
})
habit_id = habit_res["habit_id"]
print(f"5. Habit Confirmed: ID={habit_id}")
assert habit_id > 0

# Step 6: Gamification XP & Level Check
gamify = request(f"gamification/{USER_ID}")
print(f"6. Gamification: Level {gamify['current_level']['level']} ({gamify['current_level']['title']}), XP={gamify['total_xp']}")
assert gamify["total_xp"] >= 20
assert "first_step" in gamify["unlocked_badge_ids"]

# Step 7: Simulate Habit Time Passed Follow-up Check-in
followup = request("simulate-followup", method="POST", data={
    "user_id": USER_ID,
    "habit_id": habit_id
})
print(f"7. Simulated Time Passed Follow-up Message:\n   \"{followup['reply']}\"")
assert followup["intent"] == "checkin_prompt"

# Step 8: Friction Reason Submission & Adaptive Habit Adjustment
friction_res = request("checkins", method="POST", data={
    "habit_id": habit_id,
    "completed": False,
    "reason_if_missed": "College coursework and lab ran late and was exhausted"
})
print(f"8. Check-in Recorded (Missed with Friction):")
print(f"   Adapted Duration: {friction_res['adapted_info']['adapted_duration_minutes']}m (was {payload['data']['duration_minutes']}m)")
print(f"   Adaptation Message: \"{friction_res['adapted_info']['adaptation_message']}\"")
assert friction_res["adapted_info"]["adapted_duration_minutes"] <= payload["data"]["duration_minutes"]

# Step 9: Behavior Pattern Analytics & Clustered Reasons
behavior = request(f"behavior/{USER_ID}")
patterns = behavior["patterns"]
print(f"9. Behavior Analytics:")
print(f"   Total checkins: {patterns['total_checkins']}")
print(f"   Reason Clusters: {patterns['reason_clusters']}")
assert patterns["total_checkins"] >= 1
assert len(patterns["reason_clusters"]) >= 1

# Step 10: Seed Demo Data (14-day history)
demo_res = request("seed-demo", method="POST", data={"user_id": USER_ID})
print(f"10. Seed Demo Data: {demo_res['message']}")

# Verify updated demo gamification
gamify_after = request(f"gamification/{USER_ID}")
print(f"    Post-seed Gamification: Level {gamify_after['current_level']['level']} ({gamify_after['current_level']['title']}), Total XP={gamify_after['total_xp']}")
print(f"    Unlocked Badges: {gamify_after['unlocked_badge_ids']}")
assert gamify_after["total_xp"] >= 200
assert len(gamify_after["unlocked_badge_ids"]) >= 3

# Step 11: Mistral Key Config API
key_res = request("config/mistral-key", method="POST", data={"api_key": "test_key_config"})
print(f"11. Mistral Key Config: status={key_res['status']}, configured={key_res['mistral_configured']}")
assert key_res["status"] == "success"

print("==================================================")
print("ALL LIVE END-TO-END TEST SUITES PASSED CLEANLY! 🎉")
print("==================================================")
