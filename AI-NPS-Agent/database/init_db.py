import os
import sqlite3
from datetime import datetime, timedelta

DB_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "app.db"))


def main() -> None:
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS chat_sessions (
            id TEXT PRIMARY KEY,
            customer_id TEXT,
            agent_id TEXT,
            started_at DATETIME,
            ended_at DATETIME
        );
        """
    )

    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS chat_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT,
            sender TEXT,
            content TEXT,
            timestamp DATETIME,
            sentiment_score REAL,
            detractor_risk REAL
        );
        """
    )

    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS nps_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date_time DATETIME,
            chat_id TEXT,
            transcript TEXT,
            nps_score INTEGER,
            reason_cwc TEXT,
            m1 TEXT,
            m2 TEXT,
            m3 TEXT,
            segment TEXT,
            lang TEXT,
            agent_login TEXT,
            agent_site TEXT
        );
        """
    )

    # Seed NPS records for last 3 months
    now = datetime.utcnow()
    records = []
    for i in range(90):
        day = now - timedelta(days=i)
        score = 10 if i % 5 == 0 else (7 if i % 3 == 0 else (4 if i % 2 == 0 else 9))
        records.append((
            day.isoformat(sep=" ", timespec="seconds"),
            f"CHAT{i:03d}",
            "Sample transcript text",
            score,
            "Reason",
            "M1",
            "M2",
            "M3",
            "Consumer",
            "en",
            "agent",
            "Site"
        ))
    cur.executemany(
        """
        INSERT INTO nps_records (
            date_time, chat_id, transcript, nps_score, reason_cwc, m1, m2, m3, segment, lang, agent_login, agent_site
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        """,
        records,
    )

    conn.commit()
    conn.close()
    print(f"Initialized DB at {DB_PATH} with {len(records)} NPS records.")


if __name__ == "__main__":
    main()

