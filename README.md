# VedaAI

AI Assessment Creator built as a Bun workspace monorepo. Teachers can create assignments, upload a reference file, generate a structured question paper with AI, track progress in real time, and export the result as PDF.

## Architecture

This repo is split into two apps:

- `apps/web`
  - Next.js 16 + React 19 frontend
  - Zustand state management
  - Figma-inspired responsive UI
  - Talks to the backend over HTTP + Socket.IO
- `apps/backend`
  - Express + TypeScript API server
  - MongoDB persistence
  - Redis caching + BullMQ queues
  - Socket.IO for real-time generation updates
  - PDF generation and upload text extraction

## Monorepo Structure

```text
vedaai_task/
├── apps/
│   ├── web/
│   │   ├── app/
│   │   ├── components/
│   │   ├── lib/
│   │   ├── public/
│   │   ├── store/
│   │   └── types/
│   └── backend/
│       ├── src/
│       │   ├── config/
│       │   ├── db/
│       │   ├── pdf/
│       │   ├── queue/
│       │   ├── redis/
│       │   ├── routes/
│       │   └── websocket/
│       ├── server.ts
│       └── worker.ts
├── package.json
└── turbo.json
```

## Tech Stack

### Frontend

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS v4
- Zustand
- Socket.IO client

### Backend

- Node.js + Express
- MongoDB
- Redis
- BullMQ
- Socket.IO
- jsPDF
- pdf-parse
- Vercel AI SDK with OpenAI-compatible providers

## Features

- Assignment creation with validation
- Optional file upload for `PDF` and `TXT`
- AI question paper generation through BullMQ
- Structured output page with sections, difficulty badges, marks, and answer key
- Real-time progress over WebSocket with polling fallback
- PDF export
- Regenerate action
- Mobile and desktop responsive layout

## Environment Setup

Create these files before running locally:

### `apps/backend/.env`

```bash
HOST=127.0.0.1
PORT=4000
MONGODB_URI=
REDIS_URL=
AI_API_URL=https://api.openai.com/v1
AI_API_KEY=
AI_MODEL=gpt-4-turbo
NEXT_PUBLIC_APP_URL=http://127.0.0.1:3000
FRONTEND_ORIGIN=http://127.0.0.1:3000
```

### `apps/web/.env.local`

```bash
NEXT_PUBLIC_APP_URL=http://127.0.0.1:3000
NEXT_PUBLIC_API_URL=http://127.0.0.1:4000
```

## Getting Started

This project uses `bun` for everything.

### Install

```bash
bun install
```

### Development

Start the full local stack from the repo root:

```bash
bun run dev
```

That starts:

- frontend on `http://127.0.0.1:3000`
- backend on `http://127.0.0.1:4000`
- BullMQ worker in a separate process

Optional package-level commands:

```bash
bun run dev:web
bun run dev:backend
bun run worker
```

## Build and Checks

Run these from the repo root:

```bash
bun run lint
bun run build
```

What they do:

- `bun run lint`
  - lints the web app
  - type-checks the backend
- `bun run build`
  - builds the web app
  - compiles the backend to `apps/backend/dist`

## Production

Build the workspace:

```bash
bun run build
```

Start the web app and backend:

```bash
bun start
```

If you are running queue-based generation/PDF jobs in production, run the worker as a separate process:

```bash
bun run start:worker
```

## API Overview

The Express backend serves these routes from `apps/backend/src/routes`:

- `GET /health`
- `GET /api/assignments`
- `POST /api/assignments`
- `GET /api/assignments/:id`
- `PUT /api/assignments/:id`
- `DELETE /api/assignments/:id`
- `POST /api/generate`
- `GET /api/generate?jobId=...`
- `GET /api/generated-papers/:id`
- `GET /api/generated-papers/:id/pdf`
- `POST /api/uploads/extract`
- `GET /api/websocket`

## AI Integration

The backend worker lives in `apps/backend/src/queue/worker.ts`.

Generation flow:

1. frontend creates an assignment
2. backend stores it in MongoDB
3. backend adds a BullMQ generation job
4. worker builds a structured prompt
5. AI response is parsed into sections/questions
6. result is stored and emitted to the frontend

The AI provider is configurable with:

- `AI_API_URL`
- `AI_API_KEY`
- `AI_MODEL`

The current worker supports OpenAI-compatible APIs, including custom hosted providers.

## Deployment

### Vercel Deployment

The frontend (`apps/web`) can be deployed directly to Vercel. The backend (`apps/backend`) should be deployed to a hosting service that supports Node.js/Express (e.g., Railway, Render, Fly.io).

#### Deploying to Vercel

1. Push your code to GitHub
2. Import the project in Vercel
3. Set the root directory to `apps/web`
4. Configure environment variables:
   ```bash
   NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
   NEXT_PUBLIC_API_URL=https://your-backend-url.com
   ```
5. Deploy

#### Deploying the Backend

Option 1: Deploy to Railway
```bash
railway up
```

Option 2: Deploy to Render
- Connect your GitHub repository
- Set root directory to `apps/backend`
- Add environment variables
- Deploy

Option 3: Deploy to Fly.io
```bash
fly launch
```

### Environment Variables for Production

**Backend (`apps/backend/.env`):**
```bash
HOST=0.0.0.0
PORT=4000
MONGODB_URI=mongodb+srv://...
REDIS_URL=redis://...
AI_API_URL=https://api.openai.com/v1
AI_API_KEY=sk-...
AI_MODEL=gpt-4-turbo
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
FRONTEND_ORIGIN=https://your-app.vercel.app
```

**Frontend (`apps/web/.env.production`):**
```bash
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
NEXT_PUBLIC_API_URL=https://your-backend-url.com
```

## Notes

- `apps/web` is frontend-only. It does not own backend API routes anymore.
- `apps/backend` owns Express routes, queues, Redis, MongoDB, WebSocket, and PDF generation.
- `bun run dev` is the intended local entrypoint for the whole monorepo.
- If Redis is missing, the app runs in demo mode without queue-backed processing.
- If MongoDB is missing, the app runs in demo mode without persistence.
- For production, ensure MongoDB, Redis, and AI API credentials are properly configured.

## Demo Mode

When `MONGODB_URI` and `REDIS_URL` are not configured, the application runs in demo mode:
- Assignments are stored in memory
- Question generation uses predefined templates
- Jobs complete automatically with simulated progress
- No database or Redis connection required

This is useful for testing and development without setting up external services.

## Approach

The goal of this implementation was to match the assignment spec closely:

- separate frontend and backend apps in a monorepo
- Express backend instead of frontend-owned API handlers
- BullMQ for async generation/PDF work
- WebSocket progress updates
- structured exam-paper output instead of rendering raw LLM text
- practical local dev flow with one root command
- demo mode for development without external dependencies
# Assessment-Creator
