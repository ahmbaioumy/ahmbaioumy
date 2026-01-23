package repository

import (
	"database/sql"
	"worship-tracker/internal/domain"
)

func (s *Store) UpsertPrayerRecord(r *domain.PrayerRecord) error {
	query := `INSERT INTO prayer_records (user_id, date, prayer_name, status, marked_at, scheduled_time) 
			  VALUES (?, ?, ?, ?, ?, ?)
			  ON CONFLICT(user_id, date, prayer_name) DO UPDATE SET
			  status = excluded.status,
			  marked_at = excluded.marked_at,
			  scheduled_time = excluded.scheduled_time`
	
	_, err := s.DB.Exec(query, r.UserID, r.Date, r.PrayerName, r.Status, r.MarkedAt, r.Scheduled)
	return err
}

func (s *Store) GetPrayersForDate(userID int64, date string) ([]domain.PrayerRecord, error) {
	rows, err := s.DB.Query(`SELECT id, user_id, date, prayer_name, status, marked_at, scheduled_time FROM prayer_records WHERE user_id = ? AND date = ?`, userID, date)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var records []domain.PrayerRecord
	for rows.Next() {
		var r domain.PrayerRecord
		var markedAt sql.NullTime
		err := rows.Scan(&r.ID, &r.UserID, &r.Date, &r.PrayerName, &r.Status, &markedAt, &r.Scheduled)
		if err != nil {
			return nil, err
		}
		if markedAt.Valid {
			r.MarkedAt = &markedAt.Time
		}
		records = append(records, r)
	}
	return records, nil
}

func (s *Store) UpsertExtraDeed(d *domain.ExtraDeed) error {
	query := `INSERT INTO extra_deeds (user_id, date, type, completed, value, updated_at)
			  VALUES (?, ?, ?, ?, ?, ?)
			  ON CONFLICT(user_id, date, type) DO UPDATE SET
			  completed = excluded.completed,
			  value = excluded.value,
			  updated_at = excluded.updated_at`
	_, err := s.DB.Exec(query, d.UserID, d.Date, d.Type, d.Completed, d.Value, d.UpdatedAt)
	return err
}

func (s *Store) GetDeedsForDate(userID int64, date string) ([]domain.ExtraDeed, error) {
	rows, err := s.DB.Query(`SELECT id, user_id, date, type, completed, value, updated_at FROM extra_deeds WHERE user_id = ? AND date = ?`, userID, date)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var deeds []domain.ExtraDeed
	for rows.Next() {
		var d domain.ExtraDeed
		err := rows.Scan(&d.ID, &d.UserID, &d.Date, &d.Type, &d.Completed, &d.Value, &d.UpdatedAt)
		if err != nil {
			return nil, err
		}
		deeds = append(deeds, d)
	}
	return deeds, nil
}

// GetPrayerStats returns map of Date -> Count of completed prayers (not missed)
func (s *Store) GetPrayerStats(userID int64, startDate, endDate string) (map[string]int, error) {
	query := `SELECT date, COUNT(*) FROM prayer_records 
			  WHERE user_id = ? AND date BETWEEN ? AND ? AND status != 'MISSED'
			  GROUP BY date`
	rows, err := s.DB.Query(query, userID, startDate, endDate)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	
	stats := make(map[string]int)
	for rows.Next() {
		var date string
		var count int
		if err := rows.Scan(&date, &count); err != nil {
			return nil, err
		}
		stats[date] = count
	}
	return stats, nil
}
