# email_buddy
Email assistant — Chrome MV3 extension + FastAPI backend.

## Quickstart

- Backend
  - Python 3.11+
  - Install deps: `pip install -r backend/requirements.txt`
  - Run API: `uvicorn backend.app.main:app --reload --port 8000`
  - Verify: open `http://localhost:8000/health` and `http://localhost:8000/dashboard/summary`

- Extension (development build)
  - `cd extension && npm install`
  - `npm run build` (outputs to `extension/dist`)
  - Load unpacked in Chrome: `chrome://extensions` → Developer mode → Load unpacked → select the `extension` folder
  - The popup shows the panel; it fetches summary/search from `http://localhost:8000` when available, else falls back to mock data.

## Status
- Backend: Health check + stub endpoints `/dashboard/summary` and `/search`.
- Extension: React panel with summary and basic search, wired through the service worker.

## Next
- Inject side panel into Gmail/Outlook DOM via content script.
- Add real data models, storage, and OAuth on the backend.
