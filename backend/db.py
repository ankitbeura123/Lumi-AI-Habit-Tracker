import sqlite3
import os
import json
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(__file__), "habits.db")

def get_db_connection(db_path=None):
    if db_path is None:
        db_path = DB_PATH
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn

def init_db(db_path=None):
    conn = get_db_connection(db_path)
    cursor = conn.cursor()

    # 1. users
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    """)

    # 2. schedule
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS schedule (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            day_of_week TEXT NOT NULL,
            start_time TEXT NOT NULL,
            end_time TEXT NOT NULL,
            activity_label TEXT NOT NULL,
            is_free_time BOOLEAN DEFAULT 0,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        );
    """)

    # 3. habits
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS habits (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            name TEXT NOT NULL,
            target_time TEXT NOT NULL,
            duration_minutes INTEGER NOT NULL,
            frequency TEXT NOT NULL,
            status TEXT DEFAULT 'active',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_modified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        );
    """)

    # 4. checkins
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS checkins (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            habit_id INTEGER NOT NULL,
            date TEXT NOT NULL,
            completed BOOLEAN NOT NULL,
            reason_if_missed TEXT,
            adapted_duration INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (habit_id) REFERENCES habits (id) ON DELETE CASCADE
        );
    """)

    # 5. chat_history
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS chat_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            role TEXT NOT NULL,
            message TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        );
    """)

    # 6. behavior_log
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS behavior_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            event_type TEXT NOT NULL,
            details TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        );
    """)

    # 7. pending_actions - tracks what the assistant is currently waiting on
    # (e.g. an unconfirmed habit suggestion, or which habit a follow-up check-in refers to).
    # One row per user; new pending actions overwrite old ones.
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS pending_actions (
            user_id TEXT PRIMARY KEY,
            action_type TEXT NOT NULL,
            payload TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        );
    """)

    # Ensure default user exists
    cursor.execute("SELECT id FROM users WHERE id = ?", ("user_default",))
    if not cursor.fetchone():
        cursor.execute(
            "INSERT INTO users (id, name) VALUES (?, ?)",
            ("user_default", "Alex")
        )

    conn.commit()
    conn.close()

def ensure_user_exists(user_id, name=None, db_path=None):
    if not user_id:
        return
    conn = get_db_connection(db_path)
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM users WHERE id = ?", (user_id,))
    if not cursor.fetchone():
        cursor.execute(
            "INSERT OR IGNORE INTO users (id, name) VALUES (?, ?)",
            (user_id, name or user_id)
        )
        conn.commit()
    conn.close()

def log_behavior_event(user_id, event_type, details=None, db_path=None):
    ensure_user_exists(user_id, db_path=db_path)
    conn = get_db_connection(db_path)
    cursor = conn.cursor()
    details_str = json.dumps(details) if isinstance(details, (dict, list)) else (details or "")
    cursor.execute(
        "INSERT INTO behavior_log (user_id, event_type, details) VALUES (?, ?, ?)",
        (user_id, event_type, details_str)
    )
    conn.commit()
    conn.close()

def store_chat_message(user_id, role, message, db_path=None):
    ensure_user_exists(user_id, db_path=db_path)
    conn = get_db_connection(db_path)
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO chat_history (user_id, role, message) VALUES (?, ?, ?)",
        (user_id, role, message)
    )
    conn.commit()
    conn.close()

def get_chat_history(user_id, limit=20, db_path=None):
    conn = get_db_connection(db_path)
    cursor = conn.cursor()
    cursor.execute(
        """SELECT role, message, created_at 
           FROM chat_history 
           WHERE user_id = ? 
           ORDER BY id DESC 
           LIMIT ?""",
        (user_id, limit)
    )
    rows = cursor.fetchall()
    conn.close()
    # return in chronological order
    return [dict(r) for r in reversed(rows)]

def get_full_chat_history(user_id, db_path=None):
    conn = get_db_connection(db_path)
    cursor = conn.cursor()
    cursor.execute(
        """SELECT id, role, message, created_at 
           FROM chat_history 
           WHERE user_id = ? 
           ORDER BY id ASC""",
        (user_id,)
    )
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

def clear_chat_history(user_id, db_path=None):
    """Deletes all chat messages and pending actions for the given user."""
    conn = get_db_connection(db_path)
    cursor = conn.cursor()
    cursor.execute("DELETE FROM chat_history WHERE user_id = ?", (user_id,))
    cursor.execute("DELETE FROM pending_actions WHERE user_id = ?", (user_id,))
    deleted = cursor.rowcount
    conn.commit()
    conn.close()
    return deleted

# ---------------------------------------------------------------------------
# Pending actions: lightweight per-user conversation state.
# Used so a follow-up message like "yes add it" or "done" knows exactly which
# habit suggestion / check-in it refers to, instead of guessing.
# ---------------------------------------------------------------------------

def set_pending_action(user_id, action_type, payload, db_path=None):
    ensure_user_exists(user_id, db_path=db_path)
    conn = get_db_connection(db_path)
    cursor = conn.cursor()
    cursor.execute(
        """INSERT INTO pending_actions (user_id, action_type, payload, created_at)
           VALUES (?, ?, ?, CURRENT_TIMESTAMP)
           ON CONFLICT(user_id) DO UPDATE SET
             action_type = excluded.action_type,
             payload = excluded.payload,
             created_at = CURRENT_TIMESTAMP""",
        (user_id, action_type, json.dumps(payload))
    )
    conn.commit()
    conn.close()

def get_pending_action(user_id, db_path=None):
    """Returns {"action_type": str, "payload": dict} or None."""
    conn = get_db_connection(db_path)
    cursor = conn.cursor()
    cursor.execute(
        "SELECT action_type, payload FROM pending_actions WHERE user_id = ?",
        (user_id,)
    )
    row = cursor.fetchone()
    conn.close()
    if not row:
        return None
    try:
        payload = json.loads(row["payload"])
    except Exception:
        payload = {}
    return {"action_type": row["action_type"], "payload": payload}

def clear_pending_action(user_id, db_path=None):
    conn = get_db_connection(db_path)
    cursor = conn.cursor()
    cursor.execute("DELETE FROM pending_actions WHERE user_id = ?", (user_id,))
    conn.commit()
    conn.close()

def reset_all_data(db_path=None):
    """Wipes all data across all tables and re-initializes schema with default user."""
    conn = get_db_connection(db_path)
    cursor = conn.cursor()
    cursor.execute("PRAGMA foreign_keys = OFF;")
    tables = [
        row[0] for row in cursor.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
        ).fetchall()
    ]
    for table in tables:
        cursor.execute(f"DELETE FROM {table};")
    cursor.execute("PRAGMA foreign_keys = ON;")
    conn.commit()
    conn.close()

    init_db(db_path)

if __name__ == "__main__":
    init_db()
    print("Database initialized successfully at:", DB_PATH)