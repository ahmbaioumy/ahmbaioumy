# AGENTS.md

## Cursor Cloud specific instructions

The product lives entirely under `AI-NPS-Agent/` (the repo-root `README.md` is an unrelated profile page). It is the **Azure AI Chat NPS Assistant**: a FastAPI backend + React/Vite frontend where an agent chats with a customer while an ML model scores detractor risk in real time and proposes agent-approved responses.

### Services

| Service | Dir | Dev command | Port | Notes |
|---------|-----|-------------|------|-------|
| Backend (FastAPI/uvicorn) | `AI-NPS-Agent/backend` | `source .venv/bin/activate && python -m app.main` | 8000 | uvicorn with reload; auto-creates SQLite + loads/trains model on startup |
| Frontend (Vite dev server) | `AI-NPS-Agent/frontend` | `npm run dev` | 5173 | proxies to backend at `localhost:8000` |

`.env` files: copy `*/.env.example` to `*/.env` once (local defaults work as-is: `AUTH_PROVIDER=mock`, SQLite DB).

### Non-obvious caveats

- **WebSocket chat requires the `websockets` package** (in `backend/requirements.txt`). Without a WS library, `uvicorn` returns HTTP 404 for `ws://localhost:8000/ws/chat` and the entire chat/AI-recommendation flow silently fails while HTTP endpoints still work.
- **Auth is mock**: `POST /auth/login` accepts any non-empty username/password and returns a JWT. A username ending in `@manager` gets the `manager` role. All routes except `/health` and `/auth/login` require an `Authorization: Bearer <token>` header.
- **`/predict` needs a trailing slash** (`POST /predict/`); without it FastAPI issues a redirect.
- **AI recommendation thresholds**: the WS emits an `alert` when `prob_detractor >= 0.6` and an `ai_recommendation` popup when a customer message has `prob_detractor >= 0.7`. Strongly negative phrasing (e.g. "I'm extremely angry. This is the worst experience ever.") crosses 0.7; mildly negative text may not.
- **Manager dashboard is empty until seeded.** Run `python database/init_db.py` (from `AI-NPS-Agent/database`, backend venv active) to seed 90 days of mock NPS records; this is optional and only affects dashboard totals.
- **`npm run build` currently fails** on pre-existing `tsc` type errors (missing `vite/client` types for `import.meta.env`, plus strict-null checks in `ChatView.tsx`). Develop with `npm run dev` (Vite does not typecheck). Do not treat the build failure as an environment problem.
- **Model pickle version warning**: `ai/model/model.pkl` was saved with a newer scikit-learn than the pinned `1.5.2`, so an `InconsistentVersionWarning` prints on prediction. It is benign — predictions work. Run `python ai/train_model.py` to regenerate if desired.
