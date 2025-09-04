from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware

# Minimal FastAPI app with health + stub endpoints

app = FastAPI()

# Allow local dev from extension/popup and web origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Dev only; tighten later when extension id is known
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health() -> dict[str, str]:
    """Basic health check endpoint."""
    return {"status": "ok"}


@app.get("/dashboard/summary")
async def dashboard_summary() -> dict:
    """Stubbed dashboard summary for development.

    Mirrors the structure expected by the extension panel.
    """
    payload = {
        "actionRequired": 3,
        "bills": 2,
        "subscriptions": 5,
        "top": [
            {"id": "msg1", "subject": "Invoice #123 due", "kind": "bill"},
            {"id": "msg2", "subject": "Reminder: reply to Alex", "kind": "action"},
            {"id": "msg3", "subject": "Spotify subscription renewed", "kind": "subscription"},
        ],
    }
    return {"ok": True, "payload": payload}


@app.get("/search")
async def search(q: str = Query(..., min_length=1, description="Semantic search query")) -> dict:
    """Stubbed semantic search endpoint.

    Returns mock results that include the query string for visibility.
    """
    results = [
        {"id": "s1", "subject": f"Results for: {q} — invoice from ACME", "kind": "bill"},
        {"id": "s2", "subject": f"Results for: {q} — follow up with Alex", "kind": "action"},
        {"id": "s3", "subject": f"Results for: {q} — subscription receipt", "kind": "subscription"},
    ]
    return {"ok": True, "query": q, "results": results}
