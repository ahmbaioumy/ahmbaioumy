# Gamified Worship Tracker

A Go + React application for tracking prayers, deeds, and spiritual progress.

## Features
- **Prayer Times**: Auto-calculated based on location (offline capable).
- **Tracking**: Mark prayers as Done (1st/2nd/3rd hour) or Missed.
- **Deeds**: Track daily habits (Azkar, Quran, Dua, etc.).
- **Gamification**: Daily scores and monthly stats.
- **Notifications**: Reminders before prayer times.
- **Responsive**: Mobile-first design.

## Setup

### Backend (Go)
1. Navigate to `worship-tracker`.
2. Run `go mod tidy`.
3. Run `make run-backend` (Starts on port 8080).

### Frontend (React)
1. Navigate to `worship-tracker/frontend`.
2. Run `npm install`.
3. Run `npm run dev` (Starts on port 5173).

## Architecture
- **Backend**: Go, Standard Library + SQLite, Clean Architecture.
- **Frontend**: React, Vite, TailwindCSS.
- **Data**: Local SQLite database `worship.db`.
