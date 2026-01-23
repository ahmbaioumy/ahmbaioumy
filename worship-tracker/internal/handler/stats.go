package handler

import (
	"encoding/json"
	"net/http"
	"time"
)

func (h *Handler) handleStats(w http.ResponseWriter, r *http.Request, userID int64) {
	startDate := r.URL.Query().Get("start_date")
	endDate := r.URL.Query().Get("end_date")

	if startDate == "" || endDate == "" {
		// Default to MTD
		now := time.Now()
		currentYear, currentMonth, _ := now.Date()
		firstOfMonth := time.Date(currentYear, currentMonth, 1, 0, 0, 0, 0, now.Location())
		startDate = firstOfMonth.Format("2006-01-02")
		endDate = now.Format("2006-01-02")
	}

	stats, err := h.Worship.Store.GetPrayerStats(userID, startDate, endDate)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(stats)
}
