# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

UIGen is an AI-powered React component generator with live preview. Users describe components in natural language via a chat interface, and Claude generates React+Tailwind components that render in a live iframe preview. Components exist in a virtual file system (nothing written to disk).

## Commands

- `npm run setup` — Install deps, generate Prisma client, run migrations (first-time setup)
- `npm run dev` — Start dev server with Turbopack at localhost:3000
- `npm run build` — Production build
- `npm run lint` — ESLint
- `npm test` — Run Vitest (all tests)
- `npx vitest run src/path/to/test.test.tsx` — Run a single test file
- `npm run db:reset` — Reset SQLite database

The dev server requires `NODE_OPTIONS='--require ./node-compat.cjs'` (already configured in scripts).

## Architecture

### Core Flow
1. User sends a message in the chat panel
2. `ChatContext` posts to `/api/chat` (POST `src/app/api/chat/route.ts`)
3. The API reconstructs a `VirtualFileSystem` from the client-sent file data, then calls `streamText` (Vercel AI SDK) with Claude Haiku 4.5
4. Claude uses two tools (`str_replace_editor`, `file_manager`) to create/modify files in the virtual FS
5. Streamed response + tool results flow back to the client; `FileSystemContext` updates in real-time
6. The preview iframe renders `App.jsx` using Babel standalone + esm.sh CDN imports

### Key Abstractions

- **VirtualFileSystem** (`src/lib/file-system.ts`) — In-memory FS with CRUD, rename, serialize/deserialize. All generated code lives here, never on disk.
- **FileSystemContext** (`src/lib/contexts/file-system-context.tsx`) — React context wrapping VirtualFileSystem state for components.
- **ChatContext** (`src/lib/contexts/chat-context.tsx`) — Wraps Vercel AI SDK's `useChat`; manages messages, streaming, and auto-save to DB.
- **AI Tools** (`src/lib/tools/str-replace.ts`, `src/lib/tools/file-manager.ts`) — Zod-validated tool definitions that the AI calls to manipulate the virtual FS.
- **MockLanguageModel** (`src/lib/provider.ts`) — Fallback when no `ANTHROPIC_API_KEY` is set; returns static component code so the app works without an API key.

### Preview System
- `PreviewFrame` (`src/components/preview/PreviewFrame.tsx`) renders an iframe with `srcdoc`
- `jsx-transformer.ts` (`src/lib/transform/jsx-transformer.ts`) uses Babel standalone to compile JSX in-browser
- An import map resolves `react`, `react-dom`, and `@/` prefixed paths via esm.sh CDN
- Entry point is always `/App.jsx` in the virtual FS

### Auth & Persistence
- JWT auth (jose) with bcrypt password hashing; server-only utilities in `src/lib/auth.ts`
- Server actions in `src/actions/` handle sign-up, sign-in, project CRUD
- Prisma + SQLite (`prisma/schema.prisma`) with User and Project models
- Anonymous users get localStorage-based persistence (`src/lib/anon-work-tracker.ts`), migrated to DB on sign-up

### UI Layout
- Resizable panels via `react-resizable-panels`: left panel = chat, right panel = preview/code
- Code view uses Monaco editor (`src/components/editor/CodeEditor.tsx`) with a file tree sidebar
- shadcn/ui components in `src/components/ui/` (new-york style, Tailwind CSS v4)

## Conventions

- Path alias: `@/*` maps to `src/*`
- Generated components in the virtual FS use `@/` import alias for cross-file imports (e.g., `import Foo from '@/components/Foo'`)
- The AI system prompt is in `src/lib/prompts/generation.tsx` — all generated projects must have a root `/App.jsx` with a default export
- shadcn/ui config in `components.json` — use `npx shadcn@latest add <component>` to add new UI components

## Environment Variables

- `ANTHROPIC_API_KEY` — Anthropic API key (optional; mock provider used if absent)
- `JWT_SECRET` — Secret for JWT signing
