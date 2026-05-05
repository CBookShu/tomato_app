# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Pomodoro desktop application built with Electron, React, and TypeScript. Uses a monorepo structure with npm workspaces.

## Build & Test Commands

```bash
# Root level (runs for all workspaces)
npm test                 # Run all tests
npm run build            # Build all workspaces

# Core package (@pomodoro/core)
cd packages/core
npm test                 # Run Jest tests with coverage
npm run test:watch       # Run tests in watch mode
npm run build            # Compile TypeScript to dist/

# Electron app (tomato-app)
cd tomato_app
npm run dev              # Start Vite dev server for renderer
npm run dev:electron     # Start Electron in development
npm run build            # Build main process + renderer
npm run lint             # TypeScript type check (--noEmit)
npm test                 # Run Vitest unit tests
npm run test:watch       # Vitest in watch mode
npm run test:e2e         # Run Playwright E2E tests
npm run pack             # Package app (no installer)
npm run dist             # Build distributable (DMG/zip for macOS)
```

## Architecture

### Monorepo Structure

```
packages/core/       # Shared business logic (published as @pomodoro/core)
tomato_app/          # Electron desktop application
```

### Core Package (`@pomodoro/core`)

Pure business logic with no framework dependencies:

- **`pomodoro/`** — Timer state machine and `PomodoroTimer` class with event-based architecture
- **`tasks/`** — `TaskManager` orchestrates task/group operations via repository interfaces
- **`db/`** — SQLite repositories using Drizzle ORM (`better-sqlite3`)
- **`types/`** — Shared TypeScript types (`TimerState`, `Task`, `TaskGroup`, `DailyStats`)
- **`stats/`** — Statistics calculators for daily/weekly/monthly aggregations

### Electron App (`tomato_app`)

Three-process Electron architecture:

- **Main** (`src/main/`) — Node.js process: window creation, IPC handlers, tray icon, notifications, database init
- **Renderer** (`src/renderer/`) — React UI with Tailwind CSS, Radix UI components, Zustand stores
- **Preload** (`src/preload/`) — Secure bridge exposing `window.electronAPI`

IPC channels defined in `src/shared/ipc-channels.ts` with full type safety.

### Renderer Architecture

React components organized by feature (`Timer`, `TaskList`, `Stats`, `Settings`). State management via Zustand stores (`timer-store`, `task-store`, `stats-store`, `settings-store`). Custom hooks in `hooks/` for IPC communication.

## Key Patterns

- **Repository Pattern**: `ITaskRepository`, `ITaskGroupRepository` interfaces allow swapping storage implementations
- **State Machine**: Timer transitions via `transition(state, event, config)` pure function
- **IPC Type Safety**: `IpcChannelMap` defines request/response types for all channels
- **Immutable Updates**: All state changes use spread operators, never mutation

## Development Notes

- TypeScript ES modules (`"type": "module"`) throughout
- Jest for core package tests, Vitest for Electron app unit tests, Playwright for E2E
- Database schema in `packages/core/src/db/schema.ts` using Drizzle ORM
- Default task group has special ID (`DEFAULT_GROUP_ID`) and cannot be deleted
