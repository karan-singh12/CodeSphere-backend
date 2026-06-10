#  — Backend API

This is the backend API server for **CodeSphere** (also known as Forge), a full-stack AI-powered React application builder (similar to Cursor, bolt.new, and Lovable) integrated with real-time observability telemetry and inference analytics.

---

## Features

### 🚀 AI App Builder & Sandbox State
- **Gemini Streaming Generation**: Generates full React components styled with Tailwind CSS, utilizing `gemini-3.5-flash` with thought streams.
- **Autonomous Refinement Agent**: Incorporates a `@cline/sdk` Agent that self-corrects code, edits sandbox files, and applies updates incrementally.
- **Sandboxed Workspace Persistence**: Manages and persists workspace code state, dependencies list, and complete chat prompt histories in PostgreSQL via Prisma.
- **Credit-Based Usage**: Built-in credit billing check (Pro plan permissions check, Starter/Free credits allocations).

### 📊 Observability & Telemetry Analytics
- **Inference Log Tracking**: Records model latency, token costs, input prompts, and outputs for all generated code.
- **Analytics Dashboard**: Aggregates latency trends, daily requests volume, and cost analyses across multiple LLM providers.
- **Anomalies Detection**: Detects latency spikes, error rate outliers, and large token consumption anomalously.

---

## Technology Stack

- **Framework**: Node.js + TypeScript + Express.js
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: JWT token verification + bcryptjs password hashing
- **AI Integrations**: Google Gen AI SDK (`@google/genai`), Cline SDK (`@cline/sdk`)
- **Validation**: Zod (for request validation)

---

## Directory Structure

```
backend/
├── prisma/             # Prisma Schema & Migrations
└── src/
    ├── config/         # Prisma client, database connection config
    ├── controllers/    # API request handlers (auth, workspaces, logs, dashboard, etc.)
    ├── middleware/     # Auth checks, error handling, rate limiters
    ├── routes/         # Express API endpoint definitions
    ├── services/       # AI streaming, Agent execution, and telemetry tracking logic
    ├── types/          # Shared TypeScript type definitions
    └── utils/          # Logger, response formatters, PII redactors
```

---

## Getting Started

### Prerequisites

- Node.js >= 22
- PostgreSQL instance
- Google Gemini API Key (set in environment)

### Installation

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up the environment variables:
   ```bash
   cp .env.example .env
   ```
   *Modify the database credentials and set `GEMINI_API_KEY`.*

4. Sync database migrations:
   ```bash
   npx prisma db push
   ```

5. Run development server:
   ```bash
   npm run dev
   ```
   The backend will run on [http://localhost:4000](http://localhost:4000).

---

## API Reference

### 🔐 Authentication (`/api/auth`)
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/signup` | Create a new user account |
| POST | `/api/auth/login` | Login and retrieve access token |
| GET | `/api/auth/profile` | Retrieve user details (plan, credits, email) |
| PUT | `/api/auth/profile` | Update user name or email |
| POST | `/api/auth/upgrade` | Upgrade subscription tier (starter / pro) |

### 🛠️ Workspaces (`/api/workspaces`)
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/workspaces` | List all sandbox workspaces for the current user |
| GET | `/api/workspaces/:id` | Get details and files JSON of a specific workspace |
| DELETE | `/api/workspaces/:id` | Delete a workspace |
| POST | `/api/workspaces/generate-code` | SSE: Stream code generation using Gemini |
| POST | `/api/workspaces/improve-code` | SSE: Run autonomous Cline Agent to self-refine code |

### 💬 Chats & Conversations (`/api/conversations`, `/api/chat`)
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/conversations` | List all conversation threads |
| GET | `/api/conversations/:id` | Get messages in a conversation |
| POST | `/api/conversations` | Create a new conversation |
| POST | `/api/chat` | Send a general message |

### 📈 Dashboard & Observability (`/api/dashboard`, `/api/logs`)
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/dashboard/stats` | Retrieve overall telemetry statistics summary |
| GET | `/api/dashboard/daily-requests` | Retrieve daily request counts |
| GET | `/api/dashboard/latency-trends` | Retrieve average latencies grouped by day |
| GET | `/api/dashboard/anomalies` | List anomalies and calculate system health score |
| GET | `/api/logs` | Fetch raw inference database logs |
