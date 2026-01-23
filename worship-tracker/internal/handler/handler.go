package handler

import (
	"encoding/json"
	"net/http"
	"strings"
	"time"
	"worship-tracker/internal/domain"
	"worship-tracker/internal/service"
)

type Handler struct {
	Auth    *service.AuthService
	Worship *service.WorshipService
}

func NewHandler(auth *service.AuthService, worship *service.WorshipService) *Handler {
	return &Handler{Auth: auth, Worship: worship}
}

func (h *Handler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("POST /api/register", h.handleRegister)
	mux.HandleFunc("POST /api/login", h.handleLogin)
	
	// Protected routes
	mux.HandleFunc("GET /api/dashboard", h.authMiddleware(h.handleGetDashboard))
	mux.HandleFunc("POST /api/prayer/mark", h.authMiddleware(h.handleMarkPrayer))
	mux.HandleFunc("POST /api/deed/toggle", h.authMiddleware(h.handleToggleDeed))
	mux.HandleFunc("GET /api/notifications", h.authMiddleware(h.handleNotifications))
	mux.HandleFunc("GET /api/stats", h.authMiddleware(h.handleStats))
}

func (h *Handler) authMiddleware(next func(http.ResponseWriter, *http.Request, int64)) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}

		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || parts[0] != "Bearer" {
			http.Error(w, "Invalid auth header", http.StatusUnauthorized)
			return
		}

		userID, err := h.Auth.ValidateToken(parts[1])
		if err != nil {
			http.Error(w, "Invalid token", http.StatusUnauthorized)
			return
		}

		next(w, r, userID)
	}
}

func (h *Handler) handleRegister(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Username string  `json:"username"`
		Password string  `json:"password"`
		Lat      float64 `json:"latitude"`
		Long     float64 `json:"longitude"`
		Timezone string  `json:"timezone"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	token, err := h.Auth.Register(req.Username, req.Password, req.Timezone, req.Lat, req.Long)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(map[string]string{"token": token})
}

func (h *Handler) handleLogin(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	token, err := h.Auth.Login(req.Username, req.Password)
	if err != nil {
		http.Error(w, "Invalid credentials", http.StatusUnauthorized)
		return
	}

	json.NewEncoder(w).Encode(map[string]string{"token": token})
}

func (h *Handler) handleGetDashboard(w http.ResponseWriter, r *http.Request, userID int64) {
	dateStr := r.URL.Query().Get("date")
	if dateStr == "" {
		dateStr = time.Now().Format("2006-01-02")
	}

	overview, err := h.Worship.GetDashboard(userID, dateStr)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(overview)
}

func (h *Handler) handleMarkPrayer(w http.ResponseWriter, r *http.Request, userID int64) {
	var req struct {
		Date       string              `json:"date"`
		PrayerName string              `json:"prayer_name"`
		Status     domain.PrayerStatus `json:"status"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if err := h.Worship.MarkPrayer(userID, req.Date, req.PrayerName, req.Status); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
}

func (h *Handler) handleToggleDeed(w http.ResponseWriter, r *http.Request, userID int64) {
	var req struct {
		Date      string          `json:"date"`
		Type      domain.DeedType `json:"type"`
		Completed bool            `json:"completed"`
		Value     int             `json:"value"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if err := h.Worship.ToggleDeed(userID, req.Date, req.Type, req.Completed, req.Value); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
}

func (h *Handler) handleNotifications(w http.ResponseWriter, r *http.Request, userID int64) {
	notif, err := h.Worship.CheckNotifications(userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(notif)
}
