# AGENTS.md

This file provides guidance to Codex when working in this repository.

## Project Overview

Pomodoro desktop application built with Electron, React, TypeScript, and npm workspaces.

Workspace layout:
- `packages/core`: shared business logic and file-backed persistence
- `tomato_app`: Electron desktop app

## Build & Test Commands

```bash
# Root level
npm test                 # Run all workspace tests
npm run build            # Build all workspaces
```

```bash
# Core package (@pomodoro/core)
cd packages/core
npm test                 # Run Jest tests with coverage
npm run test:watch       # Run tests in watch mode
npm run build            # Compile TypeScript to dist/
```

```bash
# Electron app (tomato-app)
cd tomato_app
npm run dev              # Start Vite dev server for renderer
npm run dev:electron     # Start Electron in development
npm run build            # Build main + preload + renderer and copy resources
npm run build:main       # Build only the Electron main process
npm run build:preload    # Build only the preload bundle
npm run build:renderer   # Build only the renderer bundle
npm run lint             # TypeScript type check (`tsc --noEmit`)
npm test                 # Run Vitest unit tests
npm run test:watch       # Vitest in watch mode
npm run test:e2e         # Run Playwright E2E tests
npm run pack             # Package app (no installer)
npm run dist             # Build distributable (DMG/zip for macOS)
```

## E2E Testing

- Run E2E from `tomato_app/`.
- The suite uses Playwright against a real Electron app.
- Test durations in the test environment are short: pomodoro 5s, short break 3s, long break 5s.
- The main process is launched from compiled output at `tomato_app/dist/main/main/index.js`, so rebuild `src/main/**` changes with `npm run build:main` or `npm run build` before running E2E.
- E2E fixtures isolate each worker with its own `userData` directory; keep that pattern when adding new specs.

Current E2E files:
- `tests/e2e/fixtures.ts`
- `tests/e2e/helpers/acceptance-helpers.ts`
- `tests/e2e/timer.spec.ts`
- `tests/e2e/tasks.spec.ts`
- `tests/e2e/task-timer-link.spec.ts`
- `tests/e2e/pomodoro-cycle.spec.ts`
- `tests/e2e/basic-acceptance-settings.spec.ts`
- `tests/e2e/basic-acceptance-task-notes.spec.ts`
- `tests/e2e/basic-acceptance-timer-stats.spec.ts`

Test-only IPC hooks are registered when `NODE_ENV=test` in `src/main/index.ts` and `src/main/ipc-handlers.ts`:
- `test:clear-database`
- `test:fast-forward`

## Architecture

### Monorepo Structure

```text
packages/core/       # Shared business logic and file-backed storage
tomato_app/          # Electron desktop application
```

### Core Package (`@pomodoro/core`)

Pure business logic with no Electron or React dependencies:

- `pomodoro/` - timer state machine and `PomodoroTimer`
- `tasks/` - `TaskManager` and task/group orchestration
- `storage/` - file-backed repositories and YAML serialization helpers
- `stats/` - statistics calculators for daily/weekly/monthly aggregations
- `types/` - shared TypeScript types
- `sync/` - git-based sync helpers
- `utils/` - shared utilities

Important correction: this repository does not use a `db/` layer or Drizzle schema under `packages/core`; persistence is file-based through `packages/core/src/storage/`.

### Electron App (`tomato_app`)

Three-process Electron architecture:

- Main (`src/main/`) - window creation, IPC handlers, tray icon, notifications, data initialization
- Renderer (`src/renderer/`) - React UI, Tailwind CSS, Radix UI components, Zustand stores
- Preload (`src/preload/`) - secure bridge exposing `window.electronAPI`

IPC channels are defined in `src/shared/ipc-channels.ts`.

## Key Patterns

- Repository pattern for task, group, stats, config, and notes persistence
- Timer state machine via pure `transition(state, event, config)` logic
- IPC type safety via `IpcChannelMap`
- Immutable updates in renderer stores and core models
- File-backed persistence uses YAML files under the app data directory

## Development Notes

- TypeScript ES modules (`"type": "module"`) throughout
- Jest for core package tests, Vitest for Electron app unit tests, Playwright for E2E
- Database/data root is `app.getPath('userData')/tomato-data`
- Default task group has special ID (`DEFAULT_GROUP_ID`) and cannot be deleted
- If you change `src/main/**`, rebuild the main process before E2E

