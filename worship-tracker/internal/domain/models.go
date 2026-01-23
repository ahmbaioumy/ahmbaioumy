package domain

import (
	"time"
)

type PrayerStatus string

const (
	StatusPending  PrayerStatus = "PENDING"
	StatusFirstHr  PrayerStatus = "FIRST_HOUR"
	StatusSecondHr PrayerStatus = "SECOND_HOUR"
	StatusThirdHr  PrayerStatus = "THIRD_HOUR"
	StatusMissed   PrayerStatus = "MISSED" // Done but late, or missed completely
)

type DeedType string

const (
	DeedMorningAzkar DeedType = "MORNING_AZKAR"
	DeedEveningAzkar DeedType = "EVENING_AZKAR"
	DeedQuranPage    DeedType = "QURAN_PAGE"
	DeedDua          DeedType = "DUA_10MIN"
	DeedSadaqa       DeedType = "SADAQA"
	DeedTaraweeh     DeedType = "TARAWEEH"
	DeedTahajjud     DeedType = "TAHAJJUD"
)

type User struct {
	ID        int64     `json:"id"`
	Username  string    `json:"username"`
	Password  string    `json:"-"` // Hash
	Latitude  float64   `json:"latitude"`
	Longitude float64   `json:"longitude"`
	Timezone  string    `json:"timezone"` // e.g., "Asia/Dubai"
	CreatedAt time.Time `json:"created_at"`
}

type PrayerRecord struct {
	ID         int64        `json:"id"`
	UserID     int64        `json:"user_id"`
	Date       string       `json:"date"` // YYYY-MM-DD
	PrayerName string       `json:"prayer_name"` // Fajr, Dhuhr, Asr, Maghrib, Isha
	Status     PrayerStatus `json:"status"`
	MarkedAt   *time.Time   `json:"marked_at"`
	Scheduled  time.Time    `json:"scheduled_time"`
}

type ExtraDeed struct {
	ID        int64     `json:"id"`
	UserID    int64     `json:"user_id"`
	Date      string    `json:"date"`
	Type      DeedType  `json:"type"`
	Completed bool      `json:"completed"`
	Value     int       `json:"value"` // e.g., number of pages, or minutes
	UpdatedAt time.Time `json:"updated_at"`
}

type NotificationSetting struct {
	ID                 int64 `json:"id"`
	UserID             int64 `json:"user_id"`
	ReminderInterval   int   `json:"reminder_interval"`   // Minutes (e.g., 10, 15)
	CriticalThreshold  int   `json:"critical_threshold"`  // Minutes before next prayer
}
