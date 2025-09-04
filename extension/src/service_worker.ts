const BACKEND_URL = "http://localhost:8000"; // Dev default

chrome.runtime.onInstalled.addListener(() => {
  console.log("Email Buddy service worker installed");
});

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: "omit" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}

// Basic message handler scaffold
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || typeof message !== "object") return;

  switch (message.type) {
    case "ping": {
      sendResponse({ ok: true, type: "pong", ts: Date.now() });
      return true;
    }
    case "getDashboardSummary": {
      (async () => {
        try {
          const data = await fetchJSON<{ ok: boolean; payload: any }>(
            `${BACKEND_URL}/dashboard/summary`
          );
          if (data?.ok && data.payload) {
            sendResponse({ ok: true, payload: data.payload });
            return;
          }
        } catch (e) {
          // fall through to mock
          console.debug("Falling back to mock summary:", e);
        }
        const payload = {
          actionRequired: 3,
          bills: 2,
          subscriptions: 5,
          top: [
            { id: "msg1", subject: "Invoice #123 due", kind: "bill" },
            { id: "msg2", subject: "Reminder: reply to Alex", kind: "action" },
          ],
        };
        sendResponse({ ok: true, payload });
      })();
      return true; // keep message channel open for async response
    }
    case "search": {
      (async () => {
        const q: string = (message.q ?? "").toString();
        try {
          const data = await fetchJSON<{ ok: boolean; results: any[] }>(
            `${BACKEND_URL}/search?q=${encodeURIComponent(q)}`
          );
          if (data?.ok) {
            sendResponse({ ok: true, results: data.results });
            return;
          }
        } catch (e) {
          console.debug("Search fallback to mock:", e);
        }
        const results = [
          { id: "s1", subject: `Mock result for: ${q}`, kind: "action" },
        ];
        sendResponse({ ok: true, results });
      })();
      return true;
    }
    default:
      break;
  }
});
