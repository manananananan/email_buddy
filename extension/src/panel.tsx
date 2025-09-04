import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

type Summary = {
  actionRequired: number;
  bills: number;
  subscriptions: number;
  top: { id: string; subject: string; kind: string }[];
};

type SearchResult = { id: string; subject: string; kind: string };

export const Panel: React.FC = () => {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    // Try requesting the mocked dashboard summary from SW
    try {
      // @ts-ignore chrome is available in extension contexts
      chrome?.runtime?.sendMessage?.({ type: "getDashboardSummary" }, (resp: any) => {
        if (resp?.ok && resp.payload) setSummary(resp.payload as Summary);
      });
    } catch {}
  }, []);

  const doSearch = () => {
    if (!query.trim()) return;
    setIsSearching(true);
    setResults(null);
    try {
      // @ts-ignore chrome is available in extension contexts
      chrome?.runtime?.sendMessage?.({ type: "search", q: query }, (resp: any) => {
        setIsSearching(false);
        if (resp?.ok && Array.isArray(resp.results)) setResults(resp.results as SearchResult[]);
      });
    } catch {
      setIsSearching(false);
    }
  };

  return (
    <div style={{ padding: 12, fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif' }}>
      <h1 style={{ fontSize: 16, margin: 0, marginBottom: 8 }}>Email Buddy</h1>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <span style={{ background: '#eef2ff', color: '#3730a3', padding: '4px 8px', borderRadius: 6 }}>Action {summary ? `(${summary.actionRequired})` : ''}</span>
        <span style={{ background: '#ecfeff', color: '#155e75', padding: '4px 8px', borderRadius: 6 }}>Bills {summary ? `(${summary.bills})` : ''}</span>
        <span style={{ background: '#f0fdf4', color: '#166534', padding: '4px 8px', borderRadius: 6 }}>Subs {summary ? `(${summary.subscriptions})` : ''}</span>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') doSearch(); }}
          placeholder="Search emails (semantic)"
          style={{ flex: 1, padding: '8px 10px', border: '1px solid #e5e7eb', borderRadius: 6, outline: 'none' }}
        />
        <button onClick={doSearch} style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fafafa' }}>
          Search
        </button>
      </div>
      <div style={{ marginTop: 12 }}>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>Top Items</div>
        <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
          {(summary?.top ?? []).map((t) => (
            <li key={t.id} style={{ padding: '6px 0', borderBottom: '1px solid #f3f4f6' }}>
              <span style={{ fontSize: 12, color: '#6b7280', marginRight: 8 }}>[{t.kind}]</span>
              {t.subject}
            </li>
          ))}
          {!summary && <li style={{ color: '#6b7280' }}>Loading…</li>}
        </ul>
      </div>
      <div style={{ marginTop: 12 }}>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>Search Results</div>
        {isSearching && <div style={{ color: '#6b7280' }}>Searching…</div>}
        <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
          {(results ?? []).map((r) => (
            <li key={r.id} style={{ padding: '6px 0', borderBottom: '1px solid #f3f4f6' }}>
              <span style={{ fontSize: 12, color: '#6b7280', marginRight: 8 }}>[{r.kind}]</span>
              {r.subject}
            </li>
          ))}
          {!isSearching && results !== null && results.length === 0 && (
            <li style={{ color: '#6b7280' }}>No results</li>
          )}
        </ul>
      </div>
    </div>
  );
};

const rootEl = document.getElementById("root");
if (rootEl) {
  const root = createRoot(rootEl);
  root.render(<Panel />);
}
