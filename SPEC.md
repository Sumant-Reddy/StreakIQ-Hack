# YAMI Learn — Feature Specification

> CaratLane AI Learning OS · Internal Platform

---

## Architecture Overview

```
Admin/Manager UI
     │  Create / Edit / Delete docs
     ▼
Docmost (wiki)  ──── sync ────►  PostgreSQL (docmost DB)
     │                                   │
     │  page content                     │ full text
     ▼                                   ▼
docmostService.js ──── embed ───► Qdrant (vector DB)
                      Gemini             │  768-dim vectors
                   text-embedding-004    │
                                         │ semantic search
                                         ▼
JC asks question ──► socketService ──► embeddingService.searchSimilar
                                         │  top-K context chunks
                                         ▼
                                     aiService.ragAnswer
                                         │  Gemini 1.5 Flash
                                         ▼
                                     Answer + Source citations
                                         │
                                         ▼
                                    JC AI Companion UI
```

---

## Feature 1 — Multi-Language Support (EN / HI / TE / TA / KN / MR / BN)

- **i18next** with 7 translation JSON files (`en`, `hi`, `te`, `ta`, `kn`, `mr`, `bn`)
- Language stored per user in DB (`Language` enum in `User` model)
- UI language switcher in Layout navbar — click-based toggle with `useRef` click-outside handler; closes on selection
- Language persisted via `i18nApi.setLanguage(lang.toUpperCase())` → `PUT /api/auth/me/language`
- `LANG_LABELS` map covers all 7 languages with native-script labels (`हिंदी`, `தமிழ்`, `ಕನ್ನಡ`, `తెలుగు`, `मराठी`, `বাংলা`)
- Course metadata supports per-language title/description fields in DB
- All UI pages use `useTranslation()` + `t()` hooks

### Translation completeness (all 7 languages)

| File | Keys added | Bugs fixed |
|------|-----------|------------|
| `en.json` | `common.marathi`, `common.bengali` | — |
| `hi.json` | `nav.certifications`, `nav.teamReadiness`, `common.marathi`, `common.bengali` | — |
| `te.json` | `nav.certifications`, `nav.teamReadiness`, `common.marathi`, `common.bengali` | — |
| `ta.json` | `nav.certifications`, `nav.teamReadiness`, `common.marathi`, `common.bengali` | `manager.ready` wrong word fixed; stray Arabic char removed from `learningPath.aiPersonalizedPath` |
| `kn.json` | `nav.certifications`, `nav.teamReadiness`, `common.marathi`, `common.bengali` | — |
| `mr.json` | `nav.knowledgeBase`, `nav.certifications`, `nav.teamReadiness`, `common.marathi`, `common.bengali` | — |
| `bn.json` | `nav.knowledgeBase`, `nav.certifications`, `nav.teamReadiness`, `common.marathi`, `common.bengali` | — |

**Status: ✅ Implemented — 7 languages, all keys complete**

---

## Feature 2 — Multi-Format Content Types

Admin can upload course modules as:
| Type | Storage | Delivery |
|------|---------|---------|
| VIDEO | AWS S3 / external URL | Embedded video player |
| PDF / SOP | AWS S3 URL | PDF viewer |
| PPT | Google Slides embed URL | Iframe embed |
| ARTICLE | Rich text (DB) | Rendered markdown |

Content-type-specific fields shown in CourseManager form.  
AI quiz/flashcard generation works for all types.

**Status: ✅ Implemented**

---

## Feature 3 — JC Onboarding & Role-Based Auth

### Flow
1. Admin/Manager creates invite → `POST /api/admin/invite`
2. System generates 32-byte token, 7-day expiry, stores user as `status: INVITED`
3. Invite email link: `http://app/invite/:token`
4. JC sets name + password on `InviteAccept` page → `POST /api/auth/accept-invite/:token`
5. Backend validates token, hashes password, updates `status: ACTIVE`
6. JC is auto-enrolled in all `isMandatory: true` courses in same `$transaction`
7. JWT issued → JC lands on `/learn` dashboard

### Roles
| Role | Access |
|------|--------|
| `LEARNER` (JC) | `/learn/*` — dashboard, courses, AI companion, roleplay, leaderboard |
| `MANAGER` | `/manage/*` — team view, AI copilot, risk heatmap, doc management |
| `ADMIN` | `/admin/*` — user mgmt, course mgmt, doc mgmt, full access |

**Status: ✅ Implemented**

---

## Feature 4 — Docmost Knowledge Base + Gemini RAG

### 4.1 Docmost Integration

Docmost (open-source wiki, runs as Docker service on port 3001) is the **source of truth** for training documentation.

#### Docker service
```yaml
docmost:
  image: docmost/docmost:latest
  ports: ['3001:3000']
  environment:
    DATABASE_URL: postgresql://docmost:docmost123@docmost-db:5432/docmost
    REDIS_URL: redis://redis:6379
    APP_SECRET: changeme-docmost-secret-32chars-min
```

#### Document CRUD (Admin + Manager)
Admin and Manager can manage knowledge base documents directly from the YAMI UI — no need to open Docmost separately.

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/admin/docmost/documents` | GET | Admin, Manager | List all synced docs |
| `/api/admin/docmost/documents` | POST | Admin, Manager | Create new doc in Docmost + embed |
| `/api/admin/docmost/documents/:id` | PUT | Admin, Manager | Update doc content + re-embed |
| `/api/admin/docmost/documents/:id` | DELETE | Admin, Manager | Delete from Docmost + Qdrant + DB |
| `/api/admin/sync-docmost` | POST | Admin | Full re-sync all spaces from Docmost |
| `/api/admin/docmost/status` | GET | Admin | Sync stats |

#### Doc creation flow
```
1. Admin/Manager fills title + content in YAMI UI
2. POST /api/admin/docmost/documents
3. docmostService.createDocmostPage():
   a. POST /api/pages to Docmost (creates wiki page)
   b. upsert to DocmostDocument table in MySQL
   c. chunkText() → Gemini text-embedding-004 → upsert to Qdrant
4. Document immediately available for RAG queries
```

---

### 4.2 Gemini Embedding Pipeline

**Model**: `text-embedding-004` (Google) — 768-dimensional vectors  
**Chunk size**: 500 words per chunk  
**Collection**: `yami_knowledge` (Qdrant, cosine distance, 768 dims)

```
Document text
    │
    ▼ chunkText(500 words)
[chunk_0, chunk_1, ..., chunk_N]
    │
    ▼ Gemini text-embedding-004
[vector_0, vector_1, ..., vector_N]  (768 dims each)
    │
    ▼ Qdrant upsert
point_id: `docmost_{pageId}_{chunkIndex}`
payload:  { source: 'docmost', title, docmostId, chunkIndex, text }
```

**Fallback**: If `GEMINI_API_KEY` not set, uses OpenAI `text-embedding-3-small` (1536 dims on separate collection `yami_knowledge_openai`).

---

### 4.3 Gemini RAG Answer Pipeline

**Model**: `gemini-1.5-flash`  
**Primary LLM** for all AI features (replaces OpenAI GPT-4o-mini as default)

#### JC Question → RAG Answer flow
```
1. JC types question in AI Companion
2. socket event: ai:message { message, courseId }
3. socketService → embeddingService.searchSimilar(question)
   - Gemini embeds the question (768-dim)
   - Qdrant top-5 search (optionally filtered by courseId)
   - Also searches docmost source docs (no courseId filter)
4. aiService.ragAnswer(question, context, userId)
   - Gemini 1.5 Flash generates answer grounded in context
   - Returns { answer, sources[] }
5. socket emit: ai:response { message, sources }
6. JC sees answer with source document citations
```

#### Prompt structure
```
System: You are YAMI, AI learning companion for CaratLane.
        Answer ONLY based on the provided context.
        If context is insufficient, say so. Never hallucinate.

Context (from knowledge base):
  [source: Diamond Grading SOP] chunk text...
  [source: Customer Handling Guide] chunk text...

Question: {user question}
```

---

### 4.4 Environment Variables

```env
# Gemini (primary AI provider)
GEMINI_API_KEY=your-gemini-api-key

# Docmost
DOCMOST_URL=http://docmost:3000
DOCMOST_API_KEY=your-docmost-api-token
DOCMOST_DEFAULT_SPACE_ID=space-uuid-from-docmost

# Qdrant
QDRANT_URL=http://qdrant:6333
QDRANT_COLLECTION=yami_knowledge

# OpenAI (optional fallback)
OPENAI_API_KEY=sk-...
```

---

### 4.5 Frontend — Document Manager

Route: `/admin/docs` (Admin) + `/manage/docs` (Manager)  
Component: `frontend/src/pages/admin/DocmostManager.jsx`

Features:
- Table of all knowledge base documents (title, space, last synced, chunk count)
- **Create** button → modal with Title + rich text editor (textarea)
- **Edit** button → same modal pre-filled
- **Delete** button → confirmation → removes from Docmost + Qdrant
- **Sync All** button → triggers full Docmost re-sync
- Source badge shows `docmost` provenance
- Real-time chunk count after embedding

---

## Feature 5 — Content RAG Indexing (All Module Types)

Every course module (VIDEO, PDF, SOP, PPT, ARTICLE) is indexed in Qdrant for AI Companion Q&A.

### Indexing pipeline
```
Admin creates module (VIDEO/PDF/PPT/ARTICLE)
        ↓ (async, non-blocking)
generateSummary(title + description + content)
        ↓
indexDocument({ id: module_{id}, content: summary, metadata: { courseId, moduleId, source: 'course', contentType } })
        ↓
Qdrant — JC AI Companion searches with courseId filter for course-specific context
```

### Video handling
- Videos don't have extractable text, so AI summary is generated from **title + description + course context**
- Summary describes what the video covers, key takeaways, related topics
- This summary is embedded and indexed for RAG — JCs can ask questions about video content

---

## Feature 6 — Post-Module Quiz + Retry Delta Points

### Post-module quiz trigger
- After completing any module (video watched 90%+ or PDF/PPT marked as read)
- CoursePlayer shows a "Quiz Unlocked" banner with attempt history
- JC can dismiss or immediately take the quiz

### Retry scoring logic (prevents points farming)
```
First attempt:  scored 70/100 → earns 14 points  (70/100 × 20 = 14)
Retry attempt:  scored 85/100 → earns 3 additional points (delta: 15/100 × 20 = 3)
Retry again:    scored 80/100 → earns 0 points (no improvement)
```

Only **delta improvement** is rewarded. Points are calculated: `floor(deltaScore / totalPoints × 20)`

### Attempt history
- QuizPage shows "Attempt #N · Your best: X%"
- Results screen shows before/after comparison
- Retry button always available, always resets timer

---

## Feature 7 — AI Recommendation Engine

### Signals used
| Signal | Weight |
|--------|--------|
| Knowledge risk level (HIGH/CRITICAL) | Highest — triggers refresher courses |
| Quiz weak categories (avg < 70%) | High — improvement courses |
| In-progress enrollments (0–99% complete) | Highest — shown first to resume |
| Department courses not enrolled | Medium |

### Gemini-powered analysis
Route: `GET /api/ai/ai-recommendations/:userId`

1. Builds user profile (enrollment history + quiz scores + risk level)
2. Sends to Gemini 1.5 Flash: "Given this learner's profile, rank these available courses"
3. Returns `{ courseId, reason, urgency: high|medium|low, source: 'ai'|'rules' }`
4. Merged with rules-based recommendations (AI first, rules fill gaps)
5. UI shows **content type badges** (VIDEO/PPT/PDF) and urgency indicator

---

## Data Models

### DocmostDocument (MySQL via Prisma)
```prisma
model DocmostDocument {
  id           Int      @id @default(autoincrement())
  docmostId    String   @unique      // Docmost page UUID
  title        String
  content      String   @db.LongText
  spaceId      String?
  embeddingId  String?              // Qdrant point id prefix
  chunkCount   Int      @default(0)
  lastSyncedAt DateTime @default(now())
  updatedAt    DateTime @updatedAt
  @@index([spaceId])
}
```

### User (additions for JC onboarding)
```prisma
model User {
  // ...existing fields
  language     Language    @default(EN)
  status       UserStatus  @default(ACTIVE)
  inviteToken  String?     @unique
  inviteExpiry DateTime?
  storeCode    String?
  region       String?
}
enum Language   { EN HI TE TA KN MR BN }
enum UserStatus { ACTIVE INVITED DISABLED }
```

---

## Running Locally

```bash
# Start all services
docker compose up -d

# MySQL migration (after schema changes)
cd backend && npx prisma migrate dev

# Seed admin user
cd backend && node prisma/seed.js

# Setup Docmost
# 1. Open http://localhost:3001 → create workspace + admin account
# 2. Generate API token in Docmost settings
# 3. Set DOCMOST_API_KEY in backend/.env
# 4. Note your default space ID from Docmost URL

# Start dev servers
cd backend && npm run dev
cd frontend && npm run dev

# Run E2E tests (requires dev servers running on :3000 and :5173)
cd e2e && npm install && npx playwright install
npx playwright test           # all specs headless
npx playwright test --ui      # interactive mode
```

### Environment variables (local dev additions)
```env
# Redis — falls back to localhost:6379 when REDIS_URL is not set
REDIS_URL=redis://localhost:6379   # override only if using custom port

# Gemini — required for AI features (RAG, roleplay scoring, embeddings)
GEMINI_API_KEY=AIzaSy...           # must start with AIzaSy
```

---

## Status

| Feature | Status |
|---------|--------|
| Multi-language (EN/HI/TE/TA/KN/MR/BN) — all keys complete | ✅ Done |
| Language switcher — click-toggle, all 7 languages, i18nApi | ✅ Done |
| Multi-format content types | ✅ Done |
| JC Onboarding (invite → accept → enroll) | ✅ Done |
| Docmost Docker service | ✅ Done |
| Docmost → Qdrant sync (read) | ✅ Done |
| Admin/Manager document CRUD | ✅ Done |
| Gemini text-embedding-004 (768-dim) | ✅ Done |
| Gemini 1.5 Flash as primary LLM | ✅ Done |
| RAG-grounded AI Companion answers | ✅ Done |
| RAG answer caching (Redis 30min TTL, fromCache flag) | ✅ Done |
| Source citations in AI responses | ✅ Done |
| Content RAG indexing (all module types) | ✅ Done |
| Video AI summary indexing | ✅ Done |
| Post-module quiz trigger (90% video / PDF read) | ✅ Done |
| Quiz retry delta scoring (no points farming) | ✅ Done |
| AI Recommendation Engine (Gemini 1.5 Flash) | ✅ Done |
| Rules-based recommendation fallback | ✅ Done |
| File upload (video/PDF/PPT/thumbnail) | ✅ Done |
| Printable achievement certificates | ✅ Done |
| Manager AI copilot (DB-grounded) | ✅ Done |
| Roleplay — connection-aware start (connected/connecting/offline) | ✅ Done |
| Roleplay — offline fallback (BUILT_IN_RESPONSES, 4 scenarios) | ✅ Done |
| Roleplay — Redis session persist + restore on reconnect | ✅ Done |
| Roleplay — pre-built AI scripts (ROLEPLAY_SCRIPTS in aiService) | ✅ Done |
| Roleplay — ping/pong health check event | ✅ Done |
| Redis service — localhost fallback, safeGet/safeSet/cached/clearPattern | ✅ Done |
| SocketContext — exposes connected/connecting/reconnect | ✅ Done |
| E2E test suite (Playwright) — auth/language/roleplay/certifications | ✅ Done |
| Embedding health check | ✅ Done |
| RAG searchSimilar fixed (all sources) | ✅ Done |
| Certification builder (admin/manager) | ✅ Done |
| My Certifications page (learner) | ✅ Done |
| Badge system — 21 badges, auto-award on all events | ✅ Done |
| Badges page (learner — earned/locked, category filter) | ✅ Done |
| Certificate redesign — YAMI Learn logo, badges, achievement story | ✅ Done |

---

## Feature 8 — File Upload & Course Media

Admin and Manager can upload videos, PDFs, PPTs, and thumbnails directly in the Course Builder.

### Upload pipeline
```
POST /api/upload (multipart/form-data)
        ↓ multer → local disk: backend/uploads/
        ↓
Response: { url: "http://host/uploads/filename.mp4" }
        ↓
Admin pastes URL into module contentUrl OR auto-filled after upload
        ↓
Module created → embeddingService.indexDocument() called
```

| Field | Accept | Max Size |
|-------|--------|----------|
| Video | mp4, webm, mov | 500 MB |
| PDF/SOP | pdf, doc, docx | 500 MB |
| PPT | ppt, pptx | 500 MB |
| Thumbnail | jpg, png, gif, webp | 10 MB |

Thumbnails shown in: Course cards, CoursePlayer header, course preview.

---

## Feature 9 — Achievement Certificates (Redesigned)

When a learner achieves READY status on a Certification, a downloadable certificate is generated.

Route: `GET /learn/certificate/:certId`
Data: `GET /api/learner/certifications/:certId/certificate` + `GET /api/gamification/badges`

### Certificate design
- **YAMI Learn diamond logo** — inline SVG (purple-pink gradient faceted gem, no external deps)
- Gold gradient top bar + corner ornaments (purple, A4 landscape)
- Two-column layout:
  - **Left**: JC name (36pt serif), certification name, achievement narrative, department info, badges earned as colored pills
  - **Right**: award medal, score metrics (overall %, quiz %, courses done, badge count)
- Footer: YAMI Learning Team signature, cert ID (`CERT-XXXXX-YYYY`), date awarded
- Screen view also shows stats strip (courses / quiz score / badges count) below the card
- Preview shown greyed-out if not yet eligible (readinessScore shown)

### Print
Full standalone HTML generated inline (Google Fonts + inline CSS) — works offline.

### Eligibility
readinessScore ≥ 70 AND avgCompletion ≥ minCourseCompletion AND avgQuizScore ≥ minQuizScore

---

## Feature 10 — AI Manager Copilot (DB-grounded)

Manager can ask natural language questions about their team. The backend:
1. Fetches live team data from DB (retention, risk, quiz scores, streak, points, course progress)
2. Passes structured team summary to Gemini 1.5 Flash
3. Returns LLM-generated insight + structured team stats card

Suggested queries surfaced in UI:
- "Who are my top 3 performers this week?"
- "Which team members are at high risk?"
- "Who hasn't completed any courses in 7 days?"
- "What is the average retention score?"

---

## Feature 11 — AI Mock Roleplay (Resilient, Redis-Backed)

Full lifecycle of a roleplay session, with offline fallback and session restore.

### Connection-aware start flow

```
JC clicks "Start Roleplay"
        ↓
socket.connected?
  YES  → emit roleplay:start immediately
  NO, connecting → store scenario in pendingScenarioRef; start 5s offline timeout
                   → when connected fires → emit roleplay:start (useEffect watcher)
                   → if 5s timeout fires first → activateOfflineMode()
  NO, offline → activateOfflineMode() immediately
```

### Online mode (Socket.io + AI)

```
roleplay:start event
        ↓
Redis GET roleplay:greeting:{scenario+persona base64 hash}
  HIT  → return cached greeting instantly
  MISS → call generateRoleplayResponse → Redis SET (1hr TTL)
        ↓
Active session transcript stored in Redis (session:{sessionId}) after every turn
        ↓
roleplay:end → scoreRoleplay → save to RoleplaySessions DB
```

Socket events added:
- `roleplay:error` — emitted on any `roleplay:respond` failure (try/catch added)
- `roleplay:restore` — client sends sessionId; server fetches from Redis and re-emits all transcript turns with `restored: true` flag (enables page-refresh recovery)
- `roleplay:ping` / `roleplay:pong` — lightweight health check before scenario start

### Offline / AI-unavailable fallback (`BUILT_IN_RESPONSES`)

When the socket is offline or AI providers are down, the frontend activates offline mode using pre-built dialogue arrays:

| Scenario key | Customer persona | Dialogue lines |
|-------------|-----------------|----------------|
| `anniversary` | Middle-aged couple, 15th anniversary | 4 lines cycling by turn |
| `engagement` | First-time buyer, nervous | 4 lines |
| `upgrade` | Knowledgeable customer comparing prices | 4 lines |
| `gifting` | Corporate executive, efficiency-focused | 4 lines |

Backend `generateRoleplayResponse()` also uses the same `ROLEPLAY_SCRIPTS` constant when all LLM providers fail — so the feature works end-to-end with no API key configured.

Offline mode features:
- 800–1400ms simulated response delay (realistic feel)
- Lines cycle by transcript customer-turn count (modulo)
- Local mock scorer on `endSession()`
- Connection status indicator in chat: green "Live" / amber "Connecting..." / red "Offline · Retry"

### RAG answer caching (ai:message)

Each `ai:message` response is cached in Redis for 30 min:
```
key = 'ai:answer:' + base64(sessionId + message[:50]).replace(/\W/g,'').slice(0,32)
```
Cache hits are returned immediately with `fromCache: true` flag — no LLM or embedding call.

---

## Feature 16 — Badge System (Auto-Award)

JCs earn badges automatically whenever they meet criteria. 21 badges across 7 categories.

### Badge categories
| Category | Badges | Criteria |
|----------|--------|----------|
| Onboarding | Welcome!, First Step, Perfectionist | Join platform, first quiz, 100% quiz score |
| Achievement | Fast Learner, Course Champion, Scholar | 5 / 10 / 20 courses completed |
| Quiz | Quiz Pro, Quiz Master | 5 / 10 quizzes at 90%+ |
| Streak | 7-Day, 15-Day, Elite Learner, 90-Day Champion | Consecutive daily learning |
| Expertise | Diamond Expert, Communication Star, Sales Guru | Domain course mastery (tag-based) |
| AI & Roleplay | AI Curious, AI Champion, Roleplay Pro | 10/100 AI interactions; 5 roleplays 80%+ |
| Points | Point Collector, High Achiever, Legend | 100 / 500 / 1000 total points |

### `checkAllBadges(userId)` — core engine
Called after every key event. Fires one `Promise.all` fetching all 8 data sources, then evaluates every un-earned badge against 11 criteria types:

```
courses_completed | streak | high_score_quizzes | first_quiz | perfect_quiz
course_mastery | category_complete | ai_interactions | roleplay_score
points_milestone | first_login
```

Triggered from:
- `courses.js` — `POST /:courseId/modules/:moduleId/watch` (when `completed: true`)
- `learningQueue.js` — `QUIZ_COMPLETED` event (after `onQuizCompleted`)
- `socketService.js` — `ai:message` handler (after saving AI interaction row)
- `socketService.js` — `roleplay:end` handler (after saving session to DB)

Badges auto-seeded on server startup via `seedBadges()` (upsert by name — safe to re-run).

### Badges page
Route: `GET /learn/badges`  
Component: `frontend/src/pages/learner/Badges.jsx`

- Stats header: earned count / locked count / completion %
- Rainbow progress bar (yellow → purple → pink)
- Category filter chips (All / Earned / Locked / per-category)
- Earned badges: colored glow ring + category color, emoji icon, earned date
- Locked badges: grayscale, lock icon, criteria shown
- CTA card if zero badges earned (links to courses)

---

## Feature 12 — Redis Service (Resilient, Local-Dev Ready)

`backend/src/services/redisService.js` — complete rewrite.

### Config
- Primary URL: `REDIS_URL` env var (Docker: `redis://yami-redis:6379`)
- Fallback: `redis://localhost:6379` (local dev without Docker)
- `maxRetriesPerRequest: 3`, exponential backoff up to 3s
- All errors are logged as warnings — never crash the process

### API surface
| Export | Description |
|--------|-------------|
| `getRedis()` | Singleton ioredis client |
| `isRedisReady()` | Returns `true` only when `redis.status === 'ready'` |
| `safeGet(key)` | JSON-parsed GET; returns `null` on any error |
| `safeSet(key, ttl, value)` | JSON-serialised SETEX; returns `false` on error |
| `cached(key, ttl, fn)` | Cache-aside helper: skip Redis if not ready, call `fn()`, cache result |
| `clearPattern(pattern)` | SCAN-based pattern delete (never uses `KEYS` — production safe) |

All callers use `safeGet`/`safeSet` or `cached` — Redis being unavailable is always a graceful degradation, not an error.

---

## Feature 13 — SocketContext Refactor

`frontend/src/contexts/SocketContext.jsx` — exposes a richer context object.

### Before
```js
const socket = useSocket(); // raw Socket.io instance
```

### After
```js
const { socket, connected, connecting, reconnect } = useSocket();
```

| Field | Type | Description |
|-------|------|-------------|
| `socket` | Socket.io instance | Raw socket for emitting events |
| `connected` | boolean | `true` only after `connect` event fires |
| `connecting` | boolean | `true` while socket is attempting connection |
| `reconnect()` | function | Calls `socket.connect()` — for manual retry button |

Connection options: `reconnectionAttempts: 3`, `reconnectionDelay: 1000ms`.

`MockRoleplay.jsx` uses `{ connected, connecting, reconnect }` to drive the 3-branch start logic and the connection status indicator in chat.

---

## Feature 14 — E2E Test Suite (Playwright)

`/yami-learn/e2e/` — Playwright tests covering the four critical user flows.

### Setup
```bash
cd e2e
npm install
npx playwright install
npx playwright test           # run all
npx playwright test --ui      # interactive mode
```

### Test files

| File | Scenarios |
|------|-----------|
| `auth.spec.js` | Login success, wrong password, protected route redirect, logout |
| `language.spec.js` | Switch to Hindi/Telugu, verify UI text changes, persist on reload |
| `roleplay.spec.js` | Start session, send messages, offline fallback, end + score display |
| `certifications.spec.js` | Summary counts, card expand/collapse, View Certificate link, empty state |

### Helpers
`e2e/helpers/auth.js` — `loginAs(page, role)` fixture; handles login flow for `learner`, `manager`, `admin` roles using env-configured test credentials.

### Config (`playwright.config.js`)
- baseURL: `http://localhost:5173`
- Browsers: Chromium (primary), Firefox, WebKit
- `webServer` block: auto-starts `npm run dev` in frontend before tests
- Screenshots on failure, traces on first retry

---

## Feature 15 — Embedding Health & RAG Fix

`GET /api/ai/health` reports: Gemini embedding status, Redis status, Qdrant status.

### RAG fix (searchSimilar)
Previous bug: with no courseId, only `source:'docmost'` docs were searched — course module content was never returned for general queries.

Fixed logic:
- `courseId provided`: search course-specific chunks (filter courseId) + docmost (filter source:docmost)
- `no courseId`: search ALL indexed content (no filter) — includes course + docmost

All course modules (VIDEO, PDF, PPT, ARTICLE) are indexed at creation time with:
`{ source: 'course', courseId, moduleId, contentType, title }`
