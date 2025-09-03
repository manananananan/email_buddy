# Email Buddy – Chrome Extension MVP Design Doc (No‑Regex, ML‑Only Search)

**Author:** Manan & Co‑pilot  
**Date:** Sept 3, 2025  
**Status:** Draft → Completed (MVP scope)

---

## 1) Summary
Email Buddy is a browser extension that augments Gmail/Outlook Web with an AI side panel. It reads your mailbox (with consent), converts messages into actionable categories (Reply Needed, Bills, Subscriptions), and provides an ML‑powered semantic search. **Constraint:** No regex heuristics; all detection, extraction, and search rely on ML models (classifiers, NER, embeddings, and learned recurrence detection).

**MVP Outcome:** A Chrome (MV3) extension with a right‑hand panel that:
- Surfaces: **Action Required**, **Bills**, **Subscriptions**.
- Adds inline chips on the inbox list (e.g., *Bill*, *Subscription*, *Reply Needed*).
- Supports **semantic search** across mail using vector embeddings and re‑ranking.

---

## 2) Goals & Non‑Goals
**Goals**
- Reduce cognitive load in email triage by surfacing tasks, bills, and subs next to the native inbox.
- Provide high‑quality ML semantic search (natural language queries, fuzzy concepts, synonym handling) without regex.
- Prioritize privacy: minimal storage, transparent controls, and strict scopes.

**Non‑Goals (MVP)**
- Sending payments or cancelling subscriptions inside the extension.
- Mobile client.  
- Full email client replacement; we remain a companion UX.

---

## 3) Target Users & JTBD
- **Student/Professional Power Users:** drowning in newsletters, receipts, and threads.  
  *JTBD:* “Help me see what actually needs my attention and quickly find any email by describing it in my own words.”
- **Freelancers/Contractors:** invoices and follow‑ups.  
  *JTBD:* “Show me who I owe replies to and which invoices are due.”
- **Personal Finance Trackers:**  
  *JTBD:* “Summarize my monthly subscriptions and upcoming bills from email.”

---

## 4) Product Requirements (MVP)
**FR‑1 – Side Panel Dashboard**
- Sections: **Action Required**, **Bills**, **Subscriptions** with counts and top items.
- Clicking an item focuses the underlying email thread in the main inbox window.

**FR‑2 – Inline Chips**
- Each message row may show ML‑inferred chips (Reply Needed / Bill / Subscription). Tooltip explains why.

**FR‑3 – Semantic Search**
- Query bar accepts natural language (e.g., “Airbnb receipts from last summer”).
- Returns ranked results using embeddings + cross‑encoder re‑ranker. No regex matching.

**FR‑4 – ML‑Only Extraction**
- Due dates, amounts, sender roles (merchant/individual), and subscription cadence are extracted via NER/sequence labeling or structured LLM extraction. No rule/regex heuristics.

**FR‑5 – Privacy Controls**
- User toggles: "Analyze last N months", "Exclude folders/labels".  
- Export & delete indexed data.

**NFR**
- Latency: Dashboard loads in < 800ms after Gmail DOM ready (cached summaries).  
- Search p95 < 1.5s for top 20 results.  
- Model quality: Target P/R ≥ 0.85 for category detection in pilot.
- Security: OAuth2, TLS 1.2+, encrypted at rest.

---

## 5) System Architecture (MVP)
**High‑Level Components**
1. **Chrome Extension (MV3)**
   - Content script injects side panel UI into Gmail/Outlook DOM.
   - Service worker handles auth flows, messaging, caching small artifacts.
2. **Backend API (FastAPI, Python)**
   - Handles OAuth callbacks, mailbox syncing, ML inference, and search API.
3. **Vector + Metadata Store (Postgres + pgvector)**
   - Stores message embeddings and minimal metadata (ids, sender, timestamps, top‑k ML fields).  
4. **Message Cache/Queue (Redis)**
   - Job queue for ingestion, incremental sync, and background inference.
5. **Model Service(s)**
   - **Embeddings:** sentence‑transformers (MiniLM/E5) hosted behind FastAPI or ONNX Runtime Server.  
   - **Classifiers:** DistilBERT fine‑tunes for (ReplyNeeded / Bill / Subscription).  
   - **NER:** Token‑classification head for DUE_DATE, AMOUNT, BILLER, PERIOD.
6. **Gmail/Outlook Integrations**
   - Gmail REST API (read‑only for MVP) with incremental sync polling (later: Pub/Sub watch).

**Data Flow**
1) User installs extension → OAuth → backend obtains tokens (read‑only).  
2) Ingestion worker fetches headers + bodies for last N months.  
3) Model pipeline runs per message: embeddings, classifiers, NER → persist to Postgres/pgvector.  
4) Panel requests `/dashboard/summary` + `/labels` to render chips; `/search?q=` for semantic queries.  
5) Clicking an item scrolls/opens the thread in the native UI via content script DOM hooks.

---

## 6) Tech Stack & Rationale
**Extension**: Chrome MV3, TypeScript, React, Vite.  
**UI**: Tailwind + Headless UI; minimal footprint; dark/light themes.  
**Backend**: Python **FastAPI** (tight ML ecosystem).  
**Workers**: Celery + Redis.  
**DB**: Postgres 15 with **pgvector**; GIN/GIST indexes for metadata.  
**Search**: Embeddings (all‑MiniLM‑L6‑v2 or e5‑small) → pgvector ANN → cross‑encoder re‑rank (MiniLM).  
**NER/Classification**: HuggingFace Transformers; ONNX Runtime for low‑latency inference.  
**Auth**: Google OAuth2 (gmail.readonly). Outlook later.  
**Telemetry**: OpenTelemetry, Sentry.  
**CI/CD**: GitHub Actions; Docker for API + worker.

---

## 7) ML Design (No‑Regex)
**Tasks**
1. **Category Classification** (multi‑label): {ReplyNeeded, Bill, Subscription}.  
   - Base: DistilBERT; metrics: macro F1.
2. **Sequence Labeling (NER)**: {DUE_DATE, AMOUNT, BILLER, PERIOD, INVOICE_ID, PLAN}.  
   - Base: RoBERTa‑base token‑classifier; add CRF head for robustness.
3. **Semantic Search**
   - Index: e5‑small embeddings (email body + subject; optionally split long bodies into chunks).  
   - Retrieve: ANN top‑k from pgvector.  
   - Re‑rank: cross‑encoder (ms‑marco MiniLM) on top‑k candidates.
4. **Recurring/Subscription Detection (No Rules)**
   - **Sender‑level model**: Learn probability sender == merchant/subscription using features from message content embeddings + sender metadata embeddings.  
   - **Recurrence model**: Temporal point process (neural Hawkes or simple GRU over time gaps) to learn periodicity (weekly/monthly/annual).

**Training Data Strategy**
- Bootstrap with public corpora (e.g., Enron) + synthetic generation via LLM to create Bills/Subscription templates.  
- Weak supervision: heuristic label functions expressed as *ML prompts* (not rules) to seed labels, then human‑in‑the‑loop via Label Studio.  
- Evaluation: holdout from pilot users with explicit consent + anonymization.

---

## 8) Data Model (Postgres)
**users**(id, email, provider, oauth_token_ref, created_at)

**messages**(id, user_id, provider_id, thread_id, sender, subject, sent_ts, snippet, body_ref, hash)

**message_vectors**(message_id, embedding VECTOR, chunk_idx)

**classifications**(message_id, reply_needed BOOL, bill BOOL, subscription BOOL, scores JSONB)

**extractions**(message_id, due_date TIMESTAMP NULL, amount NUMERIC NULL, biller TEXT NULL, period TEXT NULL, invoice_id TEXT NULL, plan TEXT NULL, confidence JSONB)

**dashboard_summary_cache**(user_id, payload JSONB, updated_at)

---

## 9) API Design (FastAPI)
- **Auth**: `/auth/google/start`, `/auth/google/callback`  
- **Ingestion**: `/ingest/bootstrap`, `/ingest/incremental`  
- **Dashboard**: `/dashboard/summary`, `/labels`  
- **Search**: `/search?q=`  
- **Messages**: `/messages/:id`

---

## 10) Extension UX (Chrome MV3)
**Layout**: Right side panel with tabs: *All*, *Action*, *Bills*, *Subs*, *Search*.  
**Inline chips**: Injected into message list rows.  
**Accessibility**: ARIA roles, tab order, reduced motion option.

---

## 11) Privacy, Security, and Compliance
- Scopes: Gmail read‑only (gmail.readonly).  
- Storage minimization: persist only ids, embeddings, ML fields; no raw bodies unless opted in.  
- Encryption: TLS + AES‑256.  
- User controls: pause/resume, retention window, delete all data.  
- Logs & monitoring: Sentry, audit trails.

---

## 12) Performance & Sizing
- **Ingestion**: ~1–3k msgs/month typical.  
- **Embedding**: 10ms/msg GPU; 60–120ms/msg CPU.  
- **Search**: ANN retrieval <80ms + re‑rank <120ms.  
- **Cache**: Dashboard summary precomputed.

---

## 13) Testing & Quality
- Unit tests for API + DB + DOM injection.  
- Integration: end‑to‑end from ingestion → ML → DB → search.  
- ML Eval: category F1, token‑level NER F1, MRR/NDCG@10 for search.  
- Usability tests with pilot users.

---

## 14) Rollout Plan
- **Alpha (Friends/Test Accounts)**: 10–20 users.  
- **Beta (Chrome Web Store – unlisted)**: 100–200 users; add Outlook.  
- **GA**: free tier (limited history), paid tier (deep history, pro search).

---

## 15) Risks & Mitigations
- **DOM fragility**: design selectors to be resilient; test weekly.  
- **Privacy concerns**: transparency + user controls.  
- **Cost of inference**: batch + ONNX quantization.  
- **Cold start**: index most recent 7 days first.

---

## 16) Open Questions
- Can some models run on‑device with WebGPU to minimize server costs?  
- Should we cache embeddings locally for small accounts?  
- Do we need a separate UI for multiple accounts?

---

## 17) MVP Timeline (8 Weeks)
- **W1–2**: Gmail OAuth, ingestion, Postgres/pgvector, baseline classifier.  
- **W3–4**: Extension panel, inline chips, embeddings pipeline.  
- **W5–6**: NER extraction, dashboard summary, alpha test.  
- **W7**: QA + telemetry.  
- **W8**: Beta on Chrome Web Store.

---

## 18) Appendix
**Alternatives Considered**
- Vector store: Pinecone vs pgvector; chose pgvector for simplicity.  
- Backend: TypeScript/NestJS vs Python; chose Python for ML ergonomics.  
- LLM‑only extraction: feasible but costly; kept hybrid with lightweight transformers.

---

# ✅ Completed Design Doc (MVP Scope)
This document defines Email Buddy’s MVP technical stack, architecture, ML approach, privacy model, and rollout path. The project is now fully spec’d for development handoff.



---

## 19) Chrome MV3 & Permissions
**Manifest highlights**
```json
{
  "manifest_version": 3,
  "name": "Email Buddy",
  "version": "0.1.0",
  "action": { "default_title": "Email Buddy" },
  "background": { "service_worker": "sw.js" },
  "permissions": ["storage", "scripting", "activeTab", "tabs"],
  "host_permissions": [
    "https://mail.google.com/*",
    "https://outlook.office.com/*",
    "https://outlook.live.com/*"
  ],
  "content_scripts": [
    {
      "matches": ["https://mail.google.com/*", "https://outlook.*/*"],
      "js": ["content.js"],
      "run_at": "document_idle"
    }
  ],
  "icons": {"16":"icons/16.png","48":"icons/48.png","128":"icons/128.png"}
}
```
**Panel injection & resilience**
- Use a **Shadow DOM** root to isolate styles.
- Attach to a stable container (e.g., Gmail’s right rail) discovered via semantic attributes when possible; fall back to MutationObserver.
- Defer heavy work with `requestIdleCallback` and microtasks to avoid jank.
- Maintain a **DOM watchdog** to re‑insert the panel on route/view changes.
- Keep per‑page CPU < 2–3% and memory < 50 MB.

---

## 20) Provider Integrations
**Gmail**
- OAuth2 with limited scopes (read‑only for MVP).
- Incremental sync via **`historyId`** checkpoints; prefer **`watch` + Pub/Sub** for low‑latency updates; fall back to polling with exponential backoff on 429s.
- Use partial responses (`fields=`) to minimize payload.

**Outlook / Microsoft 365**
- Microsoft identity platform OAuth.
- Use **delta query** for incremental changes, store delta tokens per user.

**Token hygiene**
- Encrypt refresh tokens with KMS; rotate at 90 days; strict RBAC for access.

---

## 21) Authentication & Session Model
- Extension completes OAuth in a popup → backend exchanges code using **PKCE** and validates `state` to prevent CSRF.
- Backend issues a short‑lived **session JWT** for the extension; refresh via silent endpoints.
- Support **multi‑account** linking (personal + work), scoped per panel tab.

---

## 22) Data Retention, User Controls & Compliance
- Default retention: **metadata + embeddings only**; full bodies are opt‑in for better recall.
- User actions: export, purge, pause indexing, exclude labels/folders, set lookback window.
- Compliance posture: user consent screens, privacy policy, data processing addendum, CCPA/GDPR requests (access/erasure) workflow.
- Google OAuth app verification requirements tracked as a launch gate.

---

## 23) Threat Model & Security Controls
**Key risks (STRIDE)**
- **Spoofing:** OAuth flow hardened with PKCE; JWT audience/issuer checks.
- **Tampering:** Signed requests; server‑side input validation; idempotency keys on ingestion.
- **Repudiation:** Immutable audit logs (user‑scoped) for model access and data export.
- **Information disclosure:** Row‑level security (RLS) in Postgres; envelope encryption; least‑privilege IAM.
- **Denial of service:** Rate limits per user/IP; circuit breakers on model services.
- **Elevation of privilege:** No eval/`postMessage` to wild origins; strict CSP; Trusted Types.

**Extension hardening**
- Content script → service worker messaging schema‑validated.
- Shadow DOM to prevent third‑party style/JS interference.
- Never inject inline scripts; use nonces if needed.

---

## 24) Observability, SLOs & Metrics
**SLOs (MVP)**
- API availability ≥ 99.9% monthly.
- Search p95 ≤ 1.5s for top‑20 results.
- Indexing lag p95 ≤ 5 minutes (push) or 15 minutes (polling).

**Product metrics**
- Chip coverage (% of inbox rows with a chip), false‑positive/negative rates (label feedback), searches/day, clicks/result, task clearance rate.

**Platform metrics**
- Ingestion throughput, queue depth, model latency, DB p95, vector ANN recall@k.

Dashboards: Grafana/Loki + Sentry; alerts via PagerDuty.

---

## 25) Capacity & Cost (Back‑of‑Envelope)
Assume 200 users, 3k msgs/user/month ⇒ 600k msgs/month.
- **Embeddings** (e5‑small, CPU): ~80ms/msg ⇒ ~13.3 CPU‑hours/month; batch & quantize to cut in half.
- **Storage**: 600k × 768‑dim float32 ≈ 1.8 GB (embeddings) + metadata ~2–3 GB.
- **Infra**: 1× small API node, 1× worker node, RDS `db.t4g.medium`, ElastiCache `cache.t4g.small`. Optional T4 GPU for NER bursts.
These are rough; refine after alpha telemetry.

---

## 26) Deployment & DevOps
- **AWS reference**
  - API/Model: ECS Fargate services behind ALB.
  - Workers: ECS service for Celery; SQS for durable queue (or Redis streams).
  - DB: Amazon RDS Postgres + pgvector extension.
  - Cache/Queue: ElastiCache Redis.
  - Static assets: S3 + CloudFront.
  - Secrets: AWS Secrets Manager; KMS for envelope encryption.
  - CI/CD: GitHub Actions → ECR → ECS deploy; migrations via Alembic.
- **Blue/Green** deploy, feature flags for model rollouts.

---

## 27) Accessibility & Internationalization
- WCAG 2.1 AA targets; full keyboard nav; ARIA roles; reduced motion.
- Time zones via Luxon/Temporal; locale‑aware amounts/dates.
- Multilingual support: switch to **multilingual embeddings (e5‑mistral‑multilingual/similar)** when user language ≠ English.

---

## 28) QA & Testing Strategy
- **Unit**: API endpoints, token storage, DB repos, vector search utilities.
- **ML**: Offline evaluation sets; dataset drift monitors; golden sets for Bills/Subscriptions.
- **E2E**: Playwright automation across Gmail/Outlook; DOM snapshots for resilience.
- **Perf**: Lighthouse + custom RUM probes in the extension.
- **Security**: OAuth flow fuzzing; dependency scanning; secret lints.

---

## 29) Release Process & Channels
- Channels: **Alpha** (private), **Beta** (unlisted), **Stable** (public listing).
- Versioning: semver; extension auto‑updates; backend feature flags.
- Kill‑switch: remotely disable specific features if DOM changes break chips.

---

## 30) Roadmap (Post‑MVP)
1. **Quick actions**: unsubscribe, snooze, reply snippets with LLM rewrite.
2. **Thread digests**: abstractive summarization with citations back to spans.
3. **Relationship graph**: per‑contact SLA reminders and response patterns.
4. **Mobile companion**: push notifications for bills/due replies.
5. **On‑device embeddings**: WebGPU/Transformers.js for private/local mode.
6. **Admin workspace**: teams view for shared mailboxes (support/sales).

---

## 31) Team & Ownership
- **PM/Founder**: product scope, privacy posture, alpha/beta program.
- **Tech Lead**: architecture, quality gates, incident response.
- **ML Lead**: classifiers, NER, eval harness, labeling pipeline.
- **FE Lead**: extension UX, DOM resilience, performance.
- **BE Lead**: ingestion, search, data model, scalability.

---

## 32) Launch Checklist
- [ ] Google OAuth app verification submitted & approved.
- [ ] Privacy policy, ToS, data deletion instructions published.
- [ ] Security review passed; dependency licenses audited.
- [ ] Chrome Web Store listing (screenshots, description, permissions rationale).
- [ ] Onboarding walkthrough and sample queries.

---

## 33) Open Tasks to GA
- Implement delta sync for Outlook; parity with Gmail features.
- Human‑in‑the‑loop labeling workflow (Label Studio) seeded with alpha data.
- Instrument feedback loop on chips (correct/incorrect) to drive retraining.
- Evaluate re‑ranker options for quality vs latency on CPU.

---

## 34) Glossary
- **Chip**: Inline label rendered on a message row (e.g., Bill, Subscription).
- **RLS**: Row‑Level Security in Postgres to isolate tenant data.
- **ANN**: Approximate Nearest Neighbor vector search.

---

## 35) Sign‑off
**MVP scope locked** for build; changes tracked via RFCs. Next artifact: wireframes (panel tabs, chip placements) and API stubs for `/dashboard/summary`, `/search`, and ingestion jobs.

