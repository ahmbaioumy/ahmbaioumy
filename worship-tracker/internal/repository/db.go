package repository

import (
	"database/sql"
	"fmt"

	_ "github.com/mattn/go-sqlite3"
)

type Store struct {
	DB *sql.DB
}

func NewStore(dbPath string) (*Store, error) {
	db, err := sql.Open("sqlite3", dbPath)
	if err != nil {
		return nil, err
	}

	if err := db.Ping(); err != nil {
		return nil, err
	}

	s := &Store{DB: db}
	if err := s.migrate(); err != nil {
		return nil, err
	}

	return s, nil
}

func (s *Store) migrate() error {
	queries := []string{
		`CREATE TABLE IF NOT EXISTS users (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			username TEXT UNIQUE NOT NULL,
			password TEXT NOT NULL,
			latitude REAL NOT NULL,
			longitude REAL NOT NULL,
			timezone TEXT NOT NULL,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		);`,
		`CREATE TABLE IF NOT EXISTS prayer_records (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			user_id INTEGER NOT NULL,
			date TEXT NOT NULL,
			prayer_name TEXT NOT NULL,
			status TEXT NOT NULL,
			marked_at DATETIME,
			scheduled_time DATETIME NOT NULL,
			FOREIGN KEY(user_id) REFERENCES users(id),
			UNIQUE(user_id, date, prayer_name)
		);`,
		`CREATE TABLE IF NOT EXISTS extra_deeds (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			user_id INTEGER NOT NULL,
			date TEXT NOT NULL,
			type TEXT NOT NULL,
			completed BOOLEAN NOT NULL DEFAULT 0,
			value INTEGER DEFAULT 0,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY(user_id) REFERENCES users(id),
			UNIQUE(user_id, date, type)
		);`,
		`CREATE TABLE IF NOT EXISTS notification_settings (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			user_id INTEGER NOT NULL UNIQUE,
			reminder_interval INTEGER DEFAULT 15,
			critical_threshold INTEGER DEFAULT 10,
			FOREIGN KEY(user_id) REFERENCES users(id)
		);`,
	}

	for _, q := range queries {
		if _, err := s.DB.Exec(q); err != nil {
			return fmt.Errorf("migration failed: %w", err)
		}
	}
	return nil
}
