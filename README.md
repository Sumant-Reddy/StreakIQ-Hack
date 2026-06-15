# YAMI Learn AI — AI Learning Operating System

> Built for CaratLane Hackathon · Powered by OpenAI + Claude + Qdrant

## What is YAMI?

YAMI Learn AI transforms a traditional LMS into an **AI-powered Learning Intelligence Platform** that measures:

- **Knowledge Retention** (40% quiz accuracy + 20% watch rate + 15% revision + 15% streak + 10% AI)
- **Learning Effectiveness** via behavioral signals
- **Skill Proficiency** across 5 dimensions
- **Employee Readiness** for certification
- **Knowledge Decay Risk** (LOW / MEDIUM / HIGH / CRITICAL)
- **Learning Behavior Patterns** via AI Copilot

---

## Architecture

```
Frontend (React + Tailwind + ShadCN)
    ↓
Express.js API Gateway
    ↓
Core Services: Auth · Course · Quiz · Gamification · Analytics · AI
    ↓
MySQL (Prisma ORM) + Redis (BullMQ) + Qdrant (Vector DB)
    ↓
AI Layer: OpenAI GPT-4o / Claude (Anthropic) + text-embedding-3-small
```

---

## Key Features

### AI Modules
- **AI Quiz Generator** — Paste any video transcript/PDF/SOP, get scored MCQ + scenario questions instantly
- **AI Learning Companion (RAG)** — Real-time WebSocket chat using course vector embeddings
- **AI Personalized Learning Paths** — Based on quiz scores, watch behavior, department, skill gaps
- **AI Retention Score Engine** — 5-factor formula, recalculates in background via BullMQ
- **AI Manager Copilot** — NLP queries: "Who will fail certification?" → instant AI insights
- **AI Knowledge Decay Predictor** — Risk profiling with auto-interventions
- **AI Mock Customer Roleplay** — AI plays jewelry customer, scores consultant on 4 dimensions

### Gamification
- Streak engine (1→7→15→30→90 days) with badge awards
- Points system linked to quiz scores + learning hours
- Leaderboard (all-time / weekly / monthly)
- 10 badge types (Quiz Master, Diamond Expert, AI Champion, etc.)

### Manager Tools
- Team Heatmap (5 skills × N team members, color-coded)
- Individual Audit Screen (full metrics + AI risk analysis)
- Certification Readiness tracker
- AI Copilot (NLP queries about the team)
- AI Intervention Engine (auto-assigns refreshers when retention < 60)

---

## Quick Start

### Option 1: Docker (Recommended)

```bash
git clone <repo>
cd yami-learn

# Add your API keys
cp backend/.env.example backend/.env
# Edit OPENAI_API_KEY or ANTHROPIC_API_KEY

docker-compose up -d

# Wait for MySQL to be ready, then:
docker exec yami-backend npx prisma migrate dev --name init
docker exec yami-backend node prisma/seed.js
```

Visit: http://localhost:3000

### Option 2: Local Development

**Prerequisites:** Node 20+, MySQL 8, Redis 7

```bash
# Backend
cd backend
npm install
cp .env.example .env
# Edit .env with your DB + API keys

npx prisma migrate dev --name init
node prisma/seed.js
npm run dev

# Frontend (new terminal)
cd frontend
npm install
npm run dev
```

Backend: http://localhost:5000
Frontend: http://localhost:3000

---

## Demo Credentials

| Role    | Email                    | Password    |
|---------|--------------------------|-------------|
| Admin   | admin@catratlane.com     | admin123    |
| Manager | manager@catratlane.com   | manager123  |
| Learner | rahul@catratlane.com     | learner123  |

---

## API Reference

### AI Endpoints
```
POST /api/ai/generate-quiz          # AI Quiz Generator
POST /api/ai/generate-summary       # AI Course Summary
POST /api/ai/generate-flashcards    # AI Flashcard Generator
POST /api/ai/copilot/query          # Manager AI Copilot
GET  /api/ai/risk-analysis/:userId  # Knowledge Risk Engine
GET  /api/ai/retention/:userId      # Retention Score
GET  /api/ai/recommendations/:userId# Learning Recommendations
```

### Manager Endpoints
```
GET /api/manager/team               # Team list with metrics
GET /api/manager/team/summary       # Aggregated team stats
GET /api/manager/team/:id/audit     # Individual employee audit
GET /api/manager/skill-heatmap      # Team skill heatmap
GET /api/manager/certification-readiness
```

### WebSocket Events (AI Companion)
```
ai:message   → Send question
ai:response  ← AI answer

roleplay:start   → Begin roleplay session
roleplay:respond → Send consultant response
roleplay:message ← Customer reply
roleplay:end     → End session and get scored
roleplay:scored  ← Scores (product/confidence/communication/upsell)
```

---

## Tech Stack

| Layer       | Technology                        |
|-------------|-----------------------------------|
| Frontend    | React 18, Vite, Tailwind CSS      |
| Icons       | Lucide React                      |
| Backend     | Express.js, Socket.io             |
| Database    | MySQL 8 + Prisma ORM              |
| Cache/Queue | Redis + BullMQ                    |
| Vector DB   | Qdrant                            |
| AI          | OpenAI GPT-4o-mini / Claude Haiku |
| Embeddings  | text-embedding-3-small            |
| Auth        | JWT                               |
| Deployment  | Docker Compose                    |

---

## Retention Score Formula

```
Retention Score (0-100) =
  Quiz Accuracy       × 0.40   (avg of last 20 quizzes)
  + Watch Completion  × 0.20   (avg of all video sessions)
  + Revision Freq     × 0.15   (quiz attempts in last 30 days)
  + Streak Bonus      × 0.15   (current streak → 0-100 scale)
  + AI Interaction    × 0.10   (AI chats in last 7 days)
```

## Knowledge Risk Levels

| Score | Activity   | Quiz Score | Risk     |
|-------|------------|------------|----------|
| <40   | any        | any        | CRITICAL |
| <60   | any        | any        | HIGH     |
| any   | >14 days   | any        | CRITICAL |
| any   | 7-14 days  | any        | HIGH     |
| any   | any        | <50%       | HIGH     |
| 60-75 | active     | moderate   | MEDIUM   |
| >75   | active     | good       | LOW      |

---

## AI Intervention Engine

Triggers automatically when:
- Retention < 60 → Assigns refresher content
- Quiz score < 50 → Generates new quiz
- Inactive > 7 days → Sends reminder
- High/Critical risk → Notifies manager

---

## Hackathon Demo Flow

1. **Admin** → Create a course → Generate AI quiz from pasted content
2. **Learner (JC)** → Enroll → Watch video → Take AI quiz → Chat with AI Companion
3. **Learner** → Launch Mock Roleplay → Practice with AI customer → Get scored
4. **Manager** → View team heatmap → Check certif. readiness → Ask AI Copilot
5. **Manager** → Click individual employee → See full AI audit + risk analysis
