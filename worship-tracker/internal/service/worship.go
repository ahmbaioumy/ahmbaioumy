package service

import (
	"fmt"
	"time"
	"worship-tracker/internal/domain"
	"worship-tracker/internal/repository"
	"worship-tracker/pkg/calc"
)

type WorshipService struct {
	Store *repository.Store
}

type DailyOverview struct {
	Date    string                `json:"date"`
	Prayers []domain.PrayerRecord `json:"prayers"`
	Deeds   []domain.ExtraDeed    `json:"deeds"`
	Score   int                   `json:"score"`
}

func (s *WorshipService) GetDashboard(userID int64, dateStr string) (*DailyOverview, error) {
	user, err := s.Store.GetUserByID(userID)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, fmt.Errorf("user not found")
	}

	date, err := time.Parse("2006-01-02", dateStr)
	if err != nil {
		return nil, err
	}

	loc, err := time.LoadLocation(user.Timezone)
	if err != nil {
		loc = time.UTC // Fallback
	}

	// Calculate Times
	// We need to use the date in the user's timezone? 
	// The calculation library takes a Go time.Time. We should construct it properly.
	targetDate := time.Date(date.Year(), date.Month(), date.Day(), 12, 0, 0, 0, loc)
	
	// Assuming MWL method for now, user preference could be added later
	pt := calc.Calculate(targetDate, user.Latitude, user.Longitude, float64(targetDate.Hour()), calc.MethodMWL) // Offset logic in calc is simplified, passing simple hour offset might be wrong if calc expects timezone offset in hours.
	// Actually my calc package expects `tzOffset` float64. 
	_, offset := targetDate.Zone()
	tzOffset := float64(offset) / 3600.0
	pt = calc.Calculate(targetDate, user.Latitude, user.Longitude, tzOffset, calc.MethodMWL)

	records, err := s.Store.GetPrayersForDate(userID, dateStr)
	if err != nil {
		return nil, err
	}

	deeds, err := s.Store.GetDeedsForDate(userID, dateStr)
	if err != nil {
		return nil, err
	}

	// Map DB records
	recordMap := make(map[string]domain.PrayerRecord)
	for _, r := range records {
		recordMap[r.PrayerName] = r
	}

	prayerNames := []string{"Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"}
	times := []time.Time{pt.Fajr, pt.Dhuhr, pt.Asr, pt.Maghrib, pt.Isha}

	var finalPrayers []domain.PrayerRecord
	for i, name := range prayerNames {
		pTime := times[i]
		
		if rec, exists := recordMap[name]; exists {
			rec.Scheduled = pTime
			finalPrayers = append(finalPrayers, rec)
		} else {
			// Create placeholder
			status := domain.StatusPending
			// If time passed, mark as Missed (visual only, don't save yet unless user confirms?)
			// Or just leave Pending.
			// Let's check if we should auto-mark missed. 
			// For now, leave Pending so user can mark it.
			if time.Now().In(loc).After(pTime.Add(3 * time.Hour)) { // Simple logic
				// status = domain.StatusMissed // Optional: Auto-mark missed
			}

			finalPrayers = append(finalPrayers, domain.PrayerRecord{
				UserID:     userID,
				Date:       dateStr,
				PrayerName: name,
				Status:     status,
				Scheduled:  pTime,
			})
		}
	}

	// Ensure all 6 deeds are present
	deedTypes := []domain.DeedType{
		domain.DeedMorningAzkar, domain.DeedEveningAzkar, domain.DeedQuranPage,
		domain.DeedDua, domain.DeedSadaqa, domain.DeedTaraweeh, // Tahajjud?
	}
	// Add Tahajjud if needed
	deedTypes = append(deedTypes, domain.DeedTahajjud)

	deedMap := make(map[domain.DeedType]domain.ExtraDeed)
	for _, d := range deeds {
		deedMap[d.Type] = d
	}

	var finalDeeds []domain.ExtraDeed
	for _, t := range deedTypes {
		if d, exists := deedMap[t]; exists {
			finalDeeds = append(finalDeeds, d)
		} else {
			finalDeeds = append(finalDeeds, domain.ExtraDeed{
				UserID: userID,
				Date:   dateStr,
				Type:   t,
				Completed: false,
			})
		}
	}

	return &DailyOverview{
		Date:    dateStr,
		Prayers: finalPrayers,
		Deeds:   finalDeeds,
		Score:   calculateScore(finalPrayers, finalDeeds),
	}, nil
}

func calculateScore(prayers []domain.PrayerRecord, deeds []domain.ExtraDeed) int {
	score := 0
	for _, p := range prayers {
		switch p.Status {
		case domain.StatusFirstHr:
			score += 10
		case domain.StatusSecondHr:
			score += 7
		case domain.StatusThirdHr:
			score += 4
		case domain.StatusMissed:
			score += 0
		}
	}
	for _, d := range deeds {
		if d.Completed {
			score += 5
		}
	}
	return score
}

func (s *WorshipService) MarkPrayer(userID int64, dateStr, prayerName string, forceStatus domain.PrayerStatus) error {
	// If forceStatus provided, use it. Else calculate.
	// We'll trust the input for now as the user might be setting it manually.
	
	// Get scheduled time to save it correctly
	// Recalculate time... (Optimally, we should pass it or fetch from cache, but recalculating is cheap enough)
	overview, err := s.GetDashboard(userID, dateStr)
	if err != nil {
		return err
	}
	
	var targetPrayer *domain.PrayerRecord
	for _, p := range overview.Prayers {
		if p.PrayerName == prayerName {
			targetPrayer = &p
			break
		}
	}
	
	if targetPrayer == nil {
		return fmt.Errorf("prayer not found")
	}

	now := time.Now()
	
	status := forceStatus
	if status == "" {
		// Auto calculate
		// diff := now.Sub(targetPrayer.Scheduled)
		// ... logic for 1st/2nd/3rd hour ...
		// For simplicity, we default to FirstHr if not specified, 
		// or requires client to send specific status based on their UI logic.
		// I will assume client sends the status or we use "FirstHr" as default for "Done now".
		status = domain.StatusFirstHr 
	}

	record := &domain.PrayerRecord{
		UserID:     userID,
		Date:       dateStr,
		PrayerName: prayerName,
		Status:     status,
		MarkedAt:   &now,
		Scheduled:  targetPrayer.Scheduled,
	}

	return s.Store.UpsertPrayerRecord(record)
}

func (s *WorshipService) ToggleDeed(userID int64, dateStr string, deedType domain.DeedType, completed bool, value int) error {
	deed := &domain.ExtraDeed{
		UserID:    userID,
		Date:      dateStr,
		Type:      deedType,
		Completed: completed,
		Value:     value,
		UpdatedAt: time.Now(),
	}
	return s.Store.UpsertExtraDeed(deed)
}

type NotificationPayload struct {
	Type    string `json:"type"` // REMINDER, CRITICAL, NONE
	Message string `json:"message"`
	Prayer  string `json:"prayer"`
	Minutes int    `json:"minutes_remaining"`
}

func (s *WorshipService) CheckNotifications(userID int64) (*NotificationPayload, error) {
	// Simple implementation: Check next prayer for today
	now := time.Now()
	dateStr := now.Format("2006-01-02")
	
	overview, err := s.GetDashboard(userID, dateStr)
	if err != nil {
		return nil, err
	}

	// Find next pending prayer
	for _, p := range overview.Prayers {
		// If scheduled time is in future
		diff := p.Scheduled.Sub(now)
		if diff > 0 {
			minutes := int(diff.Minutes())
			
			// Check thresholds (hardcoded for now, or fetch from settings)
			// User asked for "every 10 min" or "critical reminder".
			// We return the status, client decides to show alert.
			
			msg := fmt.Sprintf("Next prayer %s in %d minutes", p.PrayerName, minutes)
			type_ := "INFO"
			
			if minutes <= 15 {
				type_ = "REMINDER"
			}
			if minutes <= 5 {
				type_ = "CRITICAL"
			}
			
			return &NotificationPayload{
				Type:    type_,
				Message: msg,
				Prayer:  p.PrayerName,
				Minutes: minutes,
			}, nil
		}
	}
	
	return &NotificationPayload{Type: "NONE"}, nil
}
