package main

import (
	"log"
	"net/http"
	"worship-tracker/internal/handler"
	"worship-tracker/internal/repository"
	"worship-tracker/internal/service"
)

func main() {
	// 1. Init DB
	dbPath := "worship.db"
	store, err := repository.NewStore(dbPath)
	if err != nil {
		log.Fatalf("Failed to init DB: %v", err)
	}
	defer store.DB.Close()

	// 2. Init Services
	authService := &service.AuthService{Store: store}
	worshipService := &service.WorshipService{Store: store}

	// 3. Init Handler
	h := handler.NewHandler(authService, worshipService)

	// 4. Setup Router
	mux := http.NewServeMux()
	h.RegisterRoutes(mux)

	// CORS Middleware (simplified)
	corsMux := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "POST, GET, OPTIONS, PUT, DELETE")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		mux.ServeHTTP(w, r)
	})

	// 5. Start Server
	log.Println("Server starting on :8080")
	if err := http.ListenAndServe(":8080", corsMux); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}
