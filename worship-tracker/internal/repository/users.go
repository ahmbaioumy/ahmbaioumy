package repository

import (
	"database/sql"
	"worship-tracker/internal/domain"
)

func (s *Store) CreateUser(u *domain.User) error {
	query := `INSERT INTO users (username, password, latitude, longitude, timezone) VALUES (?, ?, ?, ?, ?)`
	res, err := s.DB.Exec(query, u.Username, u.Password, u.Latitude, u.Longitude, u.Timezone)
	if err != nil {
		return err
	}
	id, err := res.LastInsertId()
	if err != nil {
		return err
	}
	u.ID = id
	
	// Create default notification settings
	_, err = s.DB.Exec(`INSERT INTO notification_settings (user_id) VALUES (?)`, id)
	return err
}

func (s *Store) GetUserByUsername(username string) (*domain.User, error) {
	u := &domain.User{}
	err := s.DB.QueryRow(`SELECT id, username, password, latitude, longitude, timezone, created_at FROM users WHERE username = ?`, username).Scan(
		&u.ID, &u.Username, &u.Password, &u.Latitude, &u.Longitude, &u.Timezone, &u.CreatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return u, nil
}

func (s *Store) GetUserByID(id int64) (*domain.User, error) {
	u := &domain.User{}
	err := s.DB.QueryRow(`SELECT id, username, password, latitude, longitude, timezone, created_at FROM users WHERE id = ?`, id).Scan(
		&u.ID, &u.Username, &u.Password, &u.Latitude, &u.Longitude, &u.Timezone, &u.CreatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return u, nil
}
