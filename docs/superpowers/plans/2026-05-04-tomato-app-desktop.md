# Tomato App Desktop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Electron + React desktop app in `tomato_app/` with timer UI, task management, stats, settings, system tray, and notifications — wired to the existing `@pomodoro/core` package.

**Architecture:** `tomato_app/` is a standalone Electron app using Vite for the renderer (React + Tailwind + shadcn/ui) and tsc for the main process. The renderer communicates with the main process via a typed preload IPC bridge. All business logic lives in `@pomodoro/core`; the desktop layer handles UI, window management, tray, notifications, and shortcuts.

**Tech Stack:** Electron 33.x, React 18.x, TypeScript 5.x (strict), Vite 6.x, Tailwind CSS 4.x, shadcn/ui, Zustand 5.x, Lucide React, better-sqlite3, Drizzle ORM, Playwright (E2E)

---

## File Map

```
tomato_app/
├── package.json
├── tsconfig.json
├── tsconfig.main.json
├── vite.config.ts
├── electron-builder.yml
├── postcss.config.js
├── tailwind.config.ts
├── src/
│   ├── main/
│   │   ├── index.ts              # Electron app entry: creates window, tray, registers IPC
│   │   ├── window.ts             # BrowserWindow factory
│   │   ├── tray.ts               # Tray icon + context menu
│   │   ├── ipc-handlers.ts       # All IPC handler registrations
│   │   ├── shortcuts.ts          # Global keyboard shortcuts
│   │   └── notifications.ts      # Desktop notification helpers
│   ├── preload/
│   │   └── index.ts              # contextBridge exposing typed IPC API
│   ├── shared/
│   │   └── ipc-channels.ts       # Channel name constants + request/response types
│   └── renderer/
│       ├── index.html
│       ├── main.tsx              # React entry point
│       ├── App.tsx               # Root component with router
│       ├── index.css             # Tailwind directives + CSS variables
│       ├── components/
│       │   ├── ui/               # shadcn/ui primitives (Button, Input, Card, etc.)
│       │   ├── Timer/
│       │   │   ├── TimerDisplay.tsx    # Circular progress + countdown
│       │   │   └── TimerControls.tsx   # Start/pause/resume/stop/skip buttons
│       │   ├── TaskList/
│       │   │   ├── TaskGroupList.tsx   # List of groups with accordion
│       │   │   ├── TaskGroupHeader.tsx # Group name, collapse, color dot
│       │   │   ├── TaskItem.tsx        # Single task row
│       │   │   └── TaskForm.tsx        # Inline add/edit form
│       │   ├── Stats/
│       │   │   ├── DailyStatsCard.tsx  # Today's stats summary
│       │   │   └── WeeklyTrend.tsx     # 7-day bar chart
│       │   ├── Settings/
│       │   │   └── SettingsPage.tsx    # All settings sections
│       │   └── Layout/
│       │       ├── AppShell.tsx        # Top bar + sidebar + content
│       │       └── StatusBar.tsx       # Bottom status bar
│       ├── hooks/
│       │   ├── useTimer.ts             # Timer store + side effects
│       │   └── useIpc.ts               # Typed IPC invoke wrapper
│       ├── stores/
│       │   ├── timer-store.ts          # Zustand store for timer state
│       │   ├── task-store.ts           # Zustand store for tasks/groups
│       │   ├── stats-store.ts          # Zustand store for stats
│       │   └── settings-store.ts       # Zustand store for settings
│       └── lib/
│           └── utils.ts                # Format seconds → mm:ss, etc.
├── resources/
│   ├── icon.png
│   ├── tray-idle.png
│   ├── tray-working.png
│   └── tray-paused.png
└── tests/
    ├── stores/
    │   ├── timer-store.test.ts
    │   └── task-store.test.ts
    └── e2e/
        ├── timer.spec.ts
        ├── tasks.spec.ts
        └── settings.spec.ts
```

---

### Task 1: Desktop Package Scaffolding

**Files:**
- Create: `tomato_app/package.json`
- Create: `tomato_app/tsconfig.json`
- Create: `tomato_app/tsconfig.main.json`
- Create: `tomato_app/vite.config.ts`
- Create: `tomato_app/postcss.config.js`
- Create: `tomato_app/tailwind.config.ts`
- Create: `tomato_app/src/main/index.ts`
- Create: `tomato_app/src/preload/index.ts`
- Create: `tomato_app/src/renderer/index.html`
- Create: `tomato_app/src/renderer/main.tsx`
- Create: `tomato_app/src/renderer/App.tsx`
- Create: `tomato_app/src/renderer/index.css`
- Create: `tomato_app/resources/icon.png` (placeholder)

- [ ] **Step 1: Create package.json**

File: `tomato_app/package.json`

```json
{
  "name": "tomato-app",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./dist/main/index.js",
  "scripts": {
    "dev": "vite",
    "dev:electron": "node scripts/dev.mjs",
    "build": "tsc -p tsconfig.main.json && vite build",
    "build:main": "tsc -p tsconfig.main.json",
    "build:renderer": "vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "lint": "tsc --noEmit",
    "pack": "electron-builder --dir",
    "dist": "electron-builder"
  },
  "dependencies": {
    "@pomodoro/core": "*",
    "better-sqlite3": "^11.7.0",
    "drizzle-orm": "^0.39.0"
  },
  "devDependencies": {
    "@playwright/test": "^1.48.0",
    "@radix-ui/react-accordion": "^1.2.0",
    "@radix-ui/react-dialog": "^1.1.0",
    "@radix-ui/react-dropdown-menu": "^2.1.0",
    "@radix-ui/react-label": "^2.1.0",
    "@radix-ui/react-select": "^2.1.0",
    "@radix-ui/react-slider": "^1.2.0",
    "@radix-ui/react-switch": "^1.1.0",
    "@radix-ui/react-tooltip": "^1.1.0",
    "@tailwindcss/vite": "^4.0.0",
    "@types/better-sqlite3": "^7.6.12",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "autoprefixer": "^10.4.0",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.0",
    "electron": "^33.2.0",
    "electron-builder": "^25.1.0",
    "lucide-react": "^0.460.0",
    "postcss": "^8.4.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "tailwind-merge": "^2.6.0",
    "tailwindcss": "^3.4.0",
    "typescript": "^5.7.0",
    "vite": "^6.0.0",
    "vitest": "^2.1.0",
    "zustand": "^5.0.0"
  },
  "build": {
    "appId": "com.pomodoro.tomato-app",
    "productName": "Tomato",
    "directories": {
      "output": "release"
    },
    "files": [
      "dist/**/*",
      "resources/**/*"
    ],
    "mac": {
      "category": "public.app-category.productivity",
      "target": ["dmg", "zip"]
    }
  }
}
```

- [ ] **Step 2: Create tsconfig.json (renderer)**

File: `tomato_app/tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "paths": {
      "@/*": ["./src/renderer/*"],
      "@shared/*": ["./src/shared/*"]
    },
    "baseUrl": "."
  },
  "include": ["src/renderer", "src/shared"],
  "references": [{ "path": "./tsconfig.main.json" }]
}
```

- [ ] **Step 3: Create tsconfig.main.json (main process)**

File: `tomato_app/tsconfig.main.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "outDir": "./dist/main",
    "rootDir": "./src",
    "paths": {
      "@shared/*": ["./src/shared/*"]
    },
    "baseUrl": "."
  },
  "include": ["src/main", "src/shared", "src/preload"]
}
```

- [ ] **Step 4: Create vite.config.ts**

File: `tomato_app/vite.config.ts`

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  root: 'src/renderer',
  base: './',
  build: {
    outDir: '../../dist/renderer',
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src/renderer'),
      '@shared': path.resolve(__dirname, 'src/shared'),
    },
  },
  server: {
    port: 5173,
  },
});
```

- [ ] **Step 5: Create postcss.config.js**

File: `tomato_app/postcss.config.js`

```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

- [ ] **Step 6: Create tailwind.config.ts**

File: `tomato_app/tailwind.config.ts`

```typescript
import type { Config } from 'tailwindcss';

export default {
  content: ['./src/renderer/**/*.{ts,tsx,html}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        tomato: {
          DEFAULT: '#EF4444',
          50: '#FEF2F2',
          100: '#FEE2E2',
          500: '#EF4444',
          600: '#DC2626',
          700: '#B91C1C',
        },
      },
      fontFamily: {
        sans: ['Inter', 'SF Pro Display', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'SF Mono', 'monospace'],
      },
    },
  },
  plugins: [],
} satisfies Config;
```

- [ ] **Step 7: Create minimal Electron main entry**

File: `tomato_app/src/main/index.ts`

```typescript
import { app, BrowserWindow } from 'electron';
import { createWindow } from './window.js';
import path from 'node:path';

let mainWindow: BrowserWindow | null = null;

app.whenReady().then(() => {
  mainWindow = createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    mainWindow = createWindow();
  }
});
```

- [ ] **Step 8: Create window.ts**

File: `tomato_app/src/main/window.ts`

```typescript
import { BrowserWindow } from 'electron';
import path from 'node:path';

const isDev = !app.isPackaged;

export function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 900,
    height: 650,
    minWidth: 700,
    minHeight: 500,
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: path.join(__dirname, 'preload', 'index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  }

  return win;
}
```

- [ ] **Step 9: Create preload script**

File: `tomato_app/src/preload/index.ts`

```typescript
import { contextBridge, ipcRenderer } from 'electron';

const api = {
  invoke: (channel: string, ...args: unknown[]) => ipcRenderer.invoke(channel, ...args),
  on: (channel: string, callback: (...args: unknown[]) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, ...args: unknown[]) => callback(...args);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  },
};

contextBridge.exposeInMainWorld('electronAPI', api);
```

- [ ] **Step 10: Create renderer entry files**

File: `tomato_app/src/renderer/index.html`

```html
<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Tomato</title>
  </head>
  <body class="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-50">
    <div id="root"></div>
    <script type="module" src="./main.tsx"></script>
  </body>
</html>
```

File: `tomato_app/src/renderer/main.tsx`

```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.js';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

File: `tomato_app/src/renderer/App.tsx`

```typescript
export default function App() {
  return (
    <div className="flex h-screen items-center justify-center">
      <h1 className="text-4xl font-bold text-tomato">Tomato</h1>
    </div>
  );
}
```

File: `tomato_app/src/renderer/index.css`

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 255 255 255;
    --foreground: 17 24 39;
  }
  .dark {
    --background: 31 41 55;
    --foreground: 249 250 251;
  }
}
```

- [ ] **Step 11: Install dependencies and verify build**

Run: `cd /Users/cbookshu/dev/temp/tomato_app/tomato_app && npm install`
Expected: dependencies install without errors

Run: `cd /Users/cbookshu/dev/temp/tomato_app/tomato_app && npx tsc -p tsconfig.main.json --noEmit`
Expected: no TypeScript errors

Run: `cd /Users/cbookshu/dev/temp/tomato_app/tomato_app && npx vite build`
Expected: renderer builds successfully

- [ ] **Step 12: Commit**

```bash
git add tomato_app/
git commit -m "chore: scaffold tomato_app Electron + React desktop package"
```

---

### Task 2: Shared IPC Channel Types

**Files:**
- Create: `tomato_app/src/shared/ipc-channels.ts`
- Modify: `tomato_app/src/renderer/hooks/useIpc.ts`

- [ ] **Step 1: Write shared IPC channel definitions**

File: `tomato_app/src/shared/ipc-channels.ts`

```typescript
import type { Task, TaskGroup, NewTask, NewTaskGroup, TaskStatus } from '@pomodoro/core';
import type { DailyStats, MonthlyStats } from '@pomodoro/core';
import type { PomodoroConfig } from '@pomodoro/core';

// Channel name constants
export const IPC = {
  // Timer
  TIMER_START: 'timer:start',
  TIMER_PAUSE: 'timer:pause',
  TIMER_RESUME: 'timer:resume',
  TIMER_STOP: 'timer:stop',
  TIMER_SKIP: 'timer:skip',
  TIMER_STATE: 'timer:state',
  TIMER_TICK: 'timer:tick',
  TIMER_STATUS_CHANGE: 'timer:statusChange',
  TIMER_COMPLETE: 'timer:complete',

  // Tasks
  TASK_CREATE: 'task:create',
  TASK_GET: 'task:get',
  TASK_GET_ALL: 'task:getAll',
  TASK_GET_BY_STATUS: 'task:getByStatus',
  TASK_EDIT: 'task:edit',
  TASK_COMPLETE: 'task:complete',
  TASK_DELETE: 'task:delete',
  TASK_MOVE_TO_GROUP: 'task:moveToGroup',
  TASK_REORDER: 'task:reorder',
  TASK_INCREMENT_POMODORO: 'task:incrementPomodoro',

  // Groups
  GROUP_CREATE: 'group:create',
  GROUP_GET: 'group:get',
  GROUP_GET_ALL: 'group:getAll',
  GROUP_RENAME: 'group:rename',
  GROUP_DELETE: 'group:delete',

  // Stats
  STATS_GET_DAILY: 'stats:getDaily',
  STATS_GET_WEEKLY: 'stats:getWeekly',
  STATS_GET_MONTHLY: 'stats:getMonthly',

  // Settings
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',
  SETTINGS_GET_ALL: 'settings:getAll',
  SETTINGS_DELETE: 'settings:delete',
} as const;

// Request/Response type pairs for each channel
export interface IpcChannelMap {
  [IPC.TIMER_START]: { request: { taskId?: string }; response: void };
  [IPC.TIMER_PAUSE]: { request: void; response: void };
  [IPC.TIMER_RESUME]: { request: void; response: void };
  [IPC.TIMER_STOP]: { request: void; response: void };
  [IPC.TIMER_SKIP]: { request: void; response: void };
  [IPC.TIMER_STATE]: { request: void; response: import('@pomodoro/core').TimerState };

  [IPC.TASK_CREATE]: { request: { input: NewTask; referenceTaskId?: string; insertAfter?: boolean }; response: Task };
  [IPC.TASK_GET]: { request: { id: string }; response: Task | null };
  [IPC.TASK_GET_ALL]: { request: void; response: Task[] };
  [IPC.TASK_GET_BY_STATUS]: { request: { status: TaskStatus }; response: Task[] };
  [IPC.TASK_EDIT]: { request: { id: string; updates: Partial<Pick<Task, 'title' | 'description' | 'tags'>> }; response: Task };
  [IPC.TASK_COMPLETE]: { request: { id: string }; response: Task };
  [IPC.TASK_DELETE]: { request: { id: string }; response: void };
  [IPC.TASK_MOVE_TO_GROUP]: { request: { taskId: string; newGroupId: string }; response: Task };
  [IPC.TASK_REORDER]: { request: { taskId: string; newIndex: number }; response: void };
  [IPC.TASK_INCREMENT_POMODORO]: { request: { id: string; dateStr?: string }; response: Task };

  [IPC.GROUP_CREATE]: { request: { input: NewTaskGroup }; response: TaskGroup };
  [IPC.GROUP_GET]: { request: { id: string }; response: TaskGroup | null };
  [IPC.GROUP_GET_ALL]: { request: void; response: TaskGroup[] };
  [IPC.GROUP_RENAME]: { request: { id: string; name: string }; response: TaskGroup };
  [IPC.GROUP_DELETE]: { request: { id: string }; response: void };

  [IPC.STATS_GET_DAILY]: { request: { date: string }; response: DailyStats };
  [IPC.STATS_GET_WEEKLY]: { request: { endDate: string }; response: DailyStats[] };
  [IPC.STATS_GET_MONTHLY]: { request: void; response: MonthlyStats[] };

  [IPC.SETTINGS_GET]: { request: { key: string; defaultValue?: string }; response: string | null };
  [IPC.SETTINGS_SET]: { request: { key: string; value: string }; response: void };
  [IPC.SETTINGS_GET_ALL]: { request: void; response: Record<string, string> };
  [IPC.SETTINGS_DELETE]: { request: { key: string }; response: void };

  // Events from main → renderer (no request)
  [IPC.TIMER_TICK]: { request: void; response: (remainingTime: number) => void };
  [IPC.TIMER_STATUS_CHANGE]: { request: void; response: (status: string) => void };
  [IPC.TIMER_COMPLETE]: { request: void; response: (type: 'work' | 'break') => void };
}

declare global {
  interface Window {
    electronAPI: {
      invoke<C extends keyof IpcChannelMap>(
        channel: C,
        ...args: IpcChannelMap[C]['request'] extends void ? [] : [IpcChannelMap[C]['request']]
      ): Promise<IpcChannelMap[C]['response']>;
      on(channel: string, callback: (...args: unknown[]) => void): () => void;
    };
  }
}
```

- [ ] **Step 2: Write typed IPC hook**

File: `tomato_app/src/renderer/hooks/useIpc.ts`

```typescript
import { useCallback } from 'react';
import type { IpcChannelMap } from '@shared/ipc-channels.js';

export function useIpc() {
  const invoke = useCallback(
    <C extends keyof IpcChannelMap>(
      channel: C,
      ...args: IpcChannelMap[C]['request'] extends void ? [] : [IpcChannelMap[C]['request']]
    ): Promise<IpcChannelMap[C]['response']> => {
      return window.electronAPI.invoke(channel, ...args);
    },
    [],
  );

  const listen = useCallback((channel: string, callback: (...args: unknown[]) => void) => {
    return window.electronAPI.on(channel, callback);
  }, []);

  return { invoke, listen };
}
```

- [ ] **Step 3: Verify TypeScript compilation**

Run: `cd /Users/cbookshu/dev/temp/tomato_app/tomato_app && npx tsc -p tsconfig.main.json --noEmit && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add tomato_app/src/shared/ tomato_app/src/renderer/hooks/useIpc.ts
git commit -m "feat: define typed IPC channel map and useIpc hook"
```

---

### Task 3: shadcn/ui Primitives Setup

**Files:**
- Create: `tomato_app/src/renderer/lib/utils.ts`
- Create: `tomato_app/src/renderer/components/ui/button.tsx`
- Create: `tomato_app/src/renderer/components/ui/card.tsx`
- Create: `tomato_app/src/renderer/components/ui/input.tsx`
- Create: `tomato_app/src/renderer/components/ui/checkbox.tsx`
- Create: `tomato_app/src/renderer/components/ui/select.tsx`
- Create: `tomato_app/src/renderer/components/ui/switch.tsx`
- Create: `tomato_app/src/renderer/components/ui/slider.tsx`
- Create: `tomato_app/src/renderer/components/ui/dialog.tsx`
- Create: `tomato_app/src/renderer/components/ui/dropdown-menu.tsx`
- Create: `tomato_app/src/renderer/components/ui/tooltip.tsx`
- Create: `tomato_app/src/renderer/components/ui/accordion.tsx`
- Create: `tomato_app/src/renderer/components/ui/label.tsx`

- [ ] **Step 1: Write cn() utility**

File: `tomato_app/src/renderer/lib/utils.ts`

```typescript
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function formatMinutes(hours: number): string {
  const h = Math.floor(hours / 60);
  const m = hours % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
```

- [ ] **Step 2: Write button component**

File: `tomato_app/src/renderer/components/ui/button.tsx`

```typescript
import * as React from 'react';
import { cn } from '@/lib/utils.js';

const variants = {
  default: 'bg-tomato text-white hover:bg-tomato-600 shadow-sm',
  destructive: 'bg-red-600 text-white hover:bg-red-700 shadow-sm',
  outline: 'border border-gray-300 dark:border-gray-600 bg-transparent hover:bg-gray-100 dark:hover:bg-gray-800',
  secondary: 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-50 hover:bg-gray-200 dark:hover:bg-gray-700',
  ghost: 'hover:bg-gray-100 dark:hover:bg-gray-800',
  link: 'text-tomato underline-offset-4 hover:underline',
} as const;

const sizes = {
  default: 'h-9 px-4 py-2',
  sm: 'h-8 rounded-md px-3 text-xs',
  lg: 'h-10 rounded-md px-8',
  icon: 'h-9 w-9',
} as const;

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tomato/50 disabled:pointer-events-none disabled:opacity-50',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  ),
);
Button.displayName = 'Button';
```

- [ ] **Step 3: Write card component**

File: `tomato_app/src/renderer/components/ui/card.tsx`

```typescript
import * as React from 'react';
import { cn } from '@/lib/utils.js';

export const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm', className)} {...props} />
  ),
);
Card.displayName = 'Card';

export const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex flex-col gap-1.5 p-6', className)} {...props} />
  ),
);
CardHeader.displayName = 'CardHeader';

export const CardTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn('font-semibold leading-none tracking-tight', className)} {...props} />
  ),
);
CardTitle.displayName = 'CardTitle';

export const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('p-6 pt-0', className)} {...props} />
  ),
);
CardContent.displayName = 'CardContent';
```

- [ ] **Step 4: Write input component**

File: `tomato_app/src/renderer/components/ui/input.tsx`

```typescript
import * as React from 'react';
import { cn } from '@/lib/utils.js';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        'flex h-9 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tomato/50 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';
```

- [ ] **Step 5: Write checkbox component**

File: `tomato_app/src/renderer/components/ui/checkbox.tsx`

```typescript
import * as React from 'react';
import { cn } from '@/lib/utils.js';
import { Check } from 'lucide-react';

interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  onCheckedChange?: (checked: boolean) => void;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, onCheckedChange, onChange, ...props }, ref) => (
    <label className={cn('relative flex items-center', className)}>
      <input
        ref={ref}
        type="checkbox"
        className="peer sr-only"
        onChange={(e) => {
          onChange?.(e);
          onCheckedChange?.(e.target.checked);
        }}
        {...props}
      />
      <div className="h-4 w-4 rounded border border-gray-300 dark:border-gray-600 flex items-center justify-center peer-checked:bg-tomato peer-checked:border-tomato transition-colors">
        <Check className="h-3 w-3 text-white opacity-0 peer-checked:opacity-100" />
      </div>
    </label>
  ),
);
Checkbox.displayName = 'Checkbox';
```

- [ ] **Step 6: Write label component**

File: `tomato_app/src/renderer/components/ui/label.tsx`

```typescript
import * as React from 'react';
import { cn } from '@/lib/utils.js';

export const Label = React.forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(
  ({ className, ...props }, ref) => (
    <label
      ref={ref}
      className={cn('text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70', className)}
      {...props}
    />
  ),
);
Label.displayName = 'Label';
```

- [ ] **Step 7: Write dialog component**

File: `tomato_app/src/renderer/components/ui/dialog.tsx`

```typescript
import * as React from 'react';
import { cn } from '@/lib/utils.js';
import { X } from 'lucide-react';

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

export function Dialog({ open, onOpenChange, children }: DialogProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={() => onOpenChange(false)} />
      <div className="relative z-50 w-full max-w-lg rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg p-6">
        {children}
        <button
          onClick={() => onOpenChange(false)}
          className="absolute right-4 top-4 rounded-sm opacity-70 hover:opacity-100"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col gap-1.5 mb-4', className)} {...props} />
);

export const DialogTitle = ({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
  <h2 className={cn('text-lg font-semibold', className)} {...props} />
);
```

- [ ] **Step 8: Verify build**

Run: `cd /Users/cbookshu/dev/temp/tomato_app/tomato_app && npx tsc --noEmit`
Expected: no TypeScript errors

- [ ] **Step 9: Commit**

```bash
git add tomato_app/src/renderer/lib/ tomato_app/src/renderer/components/ui/
git commit -m "feat: add shadcn/ui primitives (Button, Card, Input, Dialog, Checkbox)"
```

---

### Task 4: Zustand Stores

**Files:**
- Create: `tomato_app/src/renderer/stores/timer-store.ts`
- Create: `tomato_app/src/renderer/stores/task-store.ts`
- Create: `tomato_app/src/renderer/stores/stats-store.ts`
- Create: `tomato_app/src/renderer/stores/settings-store.ts`
- Create: `tomato_app/tests/stores/timer-store.test.ts`
- Create: `tomato_app/tests/stores/task-store.test.ts`
- Create: `tomato_app/vitest.config.ts`

- [ ] **Step 1: Create vitest config**

File: `tomato_app/vitest.config.ts`

```typescript
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src/renderer'),
      '@shared': path.resolve(__dirname, 'src/shared'),
    },
  },
});
```

- [ ] **Step 2: Write failing timer store test**

File: `tomato_app/tests/stores/timer-store.test.ts`

```typescript
import { describe, test, expect, beforeEach } from 'vitest';
import { useTimerStore } from '../../src/renderer/stores/timer-store.js';

describe('timerStore', () => {
  beforeEach(() => {
    useTimerStore.setState({
      status: 'idle',
      remainingTime: 0,
      currentCycle: 0,
      currentTaskId: undefined,
    });
  });

  test('initial state is idle', () => {
    const state = useTimerStore.getState();
    expect(state.status).toBe('idle');
    expect(state.remainingTime).toBe(0);
    expect(state.currentCycle).toBe(0);
  });

  test('setState updates timer state from IPC', () => {
    useTimerStore.getState().setState({
      status: 'working',
      remainingTime: 1500,
      currentCycle: 1,
      currentTaskId: 't1',
    });
    const state = useTimerStore.getState();
    expect(state.status).toBe('working');
    expect(state.remainingTime).toBe(1500);
  });

  test('tick decrements remainingTime by 1', () => {
    useTimerStore.setState({ status: 'working', remainingTime: 100, currentCycle: 1 });
    useTimerStore.getState().tick(99);
    expect(useTimerStore.getState().remainingTime).toBe(99);
  });

  test('formatTime returns mm:ss', () => {
    useTimerStore.setState({ remainingTime: 125 });
    expect(useTimerStore.getState().formattedTime()).toBe('02:05');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd /Users/cbookshu/dev/temp/tomato_app/tomato_app && npx vitest run tests/stores/timer-store.test.ts`
Expected: FAIL — "Cannot find module"

- [ ] **Step 4: Write timer store implementation**

File: `tomato_app/src/renderer/stores/timer-store.ts`

```typescript
import { create } from 'zustand';
import type { TimerStatus, TimerState } from '@pomodoro/core';

interface TimerStoreState {
  status: TimerStatus;
  remainingTime: number;
  currentCycle: number;
  currentTaskId?: string;

  setState: (state: TimerState) => void;
  tick: (remainingTime: number) => void;
  formattedTime: () => string;
}

export const useTimerStore = create<TimerStoreState>((set, get) => ({
  status: 'idle',
  remainingTime: 0,
  currentCycle: 0,
  currentTaskId: undefined,

  setState: (timerState) =>
    set({
      status: timerState.status,
      remainingTime: timerState.remainingTime,
      currentCycle: timerState.currentCycle,
      currentTaskId: timerState.currentTaskId,
    }),

  tick: (remainingTime) => set({ remainingTime }),

  formattedTime: () => {
    const t = get().remainingTime;
    const m = Math.floor(t / 60);
    const s = t % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  },
}));
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd /Users/cbookshu/dev/temp/tomato_app/tomato_app && npx vitest run tests/stores/timer-store.test.ts`
Expected: all 4 tests PASS

- [ ] **Step 6: Write task store**

File: `tomato_app/src/renderer/stores/task-store.ts`

```typescript
import { create } from 'zustand';
import type { Task, TaskGroup, TaskStatus } from '@pomodoro/core';

interface TaskStoreState {
  tasks: Task[];
  groups: TaskGroup[];
  loading: boolean;

  setTasks: (tasks: Task[]) => void;
  setGroups: (groups: TaskGroup[]) => void;
  addTask: (task: Task) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  removeTask: (id: string) => void;
  addGroup: (group: TaskGroup) => void;
  updateGroup: (id: string, updates: Partial<TaskGroup>) => void;
  removeGroup: (id: string) => void;
  getTasksByGroup: (groupId: string) => Task[];
  getTasksByStatus: (status: TaskStatus) => Task[];
  setLoading: (loading: boolean) => void;
}

export const useTaskStore = create<TaskStoreState>((set, get) => ({
  tasks: [],
  groups: [],
  loading: false,

  setTasks: (tasks) => set({ tasks }),
  setGroups: (groups) => set({ groups }),

  addTask: (task) => set((s) => ({ tasks: [...s.tasks, task] })),
  updateTask: (id, updates) =>
    set((s) => ({
      tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    })),
  removeTask: (id) => set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) })),

  addGroup: (group) => set((s) => ({ groups: [...s.groups, group] })),
  updateGroup: (id, updates) =>
    set((s) => ({
      groups: s.groups.map((g) => (g.id === id ? { ...g, ...updates } : g)),
    })),
  removeGroup: (id) => set((s) => ({ groups: s.groups.filter((g) => g.id !== id) })),

  getTasksByGroup: (groupId) => get().tasks.filter((t) => t.groupId === groupId),
  getTasksByStatus: (status) => get().tasks.filter((t) => t.status === status),

  setLoading: (loading) => set({ loading }),
}));
```

- [ ] **Step 7: Write task store test**

File: `tomato_app/tests/stores/task-store.test.ts`

```typescript
import { describe, test, expect, beforeEach } from 'vitest';
import { useTaskStore } from '../../src/renderer/stores/task-store.js';

const mockTask = (id: string, groupId?: string) => ({
  id,
  title: `Task ${id}`,
  completedPomodoros: 0,
  status: 'todo' as const,
  groupId,
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
});

const mockGroup = (id: string, name: string) => ({
  id,
  name,
  taskOrder: [],
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
});

describe('taskStore', () => {
  beforeEach(() => {
    useTaskStore.setState({ tasks: [], groups: [], loading: false });
  });

  test('addTask adds a task to the list', () => {
    const task = mockTask('t1', 'g1');
    useTaskStore.getState().addTask(task);
    expect(useTaskStore.getState().tasks).toHaveLength(1);
  });

  test('updateTask modifies existing task', () => {
    useTaskStore.getState().addTask(mockTask('t1'));
    useTaskStore.getState().updateTask('t1', { title: 'Updated' });
    expect(useTaskStore.getState().tasks[0].title).toBe('Updated');
  });

  test('removeTask removes a task', () => {
    useTaskStore.getState().addTask(mockTask('t1'));
    useTaskStore.getState().removeTask('t1');
    expect(useTaskStore.getState().tasks).toHaveLength(0);
  });

  test('getTasksByGroup filters correctly', () => {
    useTaskStore.getState().addTask(mockTask('t1', 'g1'));
    useTaskStore.getState().addTask(mockTask('t2', 'g2'));
    const inG1 = useTaskStore.getState().getTasksByGroup('g1');
    expect(inG1).toHaveLength(1);
    expect(inG1[0].id).toBe('t1');
  });

  test('addGroup and getGroups', () => {
    useTaskStore.getState().addGroup(mockGroup('g1', 'Work'));
    expect(useTaskStore.getState().groups).toHaveLength(1);
    expect(useTaskStore.getState().groups[0].name).toBe('Work');
  });

  test('removeGroup deletes a group', () => {
    useTaskStore.getState().addGroup(mockGroup('g1', 'Work'));
    useTaskStore.getState().removeGroup('g1');
    expect(useTaskStore.getState().groups).toHaveLength(0);
  });
});
```

- [ ] **Step 8: Write stats store**

File: `tomato_app/src/renderer/stores/stats-store.ts`

```typescript
import { create } from 'zustand';
import type { DailyStats, MonthlyStats } from '@pomodoro/core';

interface StatsStoreState {
  today: DailyStats | null;
  weekly: DailyStats[];
  monthly: MonthlyStats[];
  loading: boolean;

  setToday: (stats: DailyStats) => void;
  setWeekly: (stats: DailyStats[]) => void;
  setMonthly: (stats: MonthlyStats[]) => void;
  setLoading: (loading: boolean) => void;
}

export const useStatsStore = create<StatsStoreState>((set) => ({
  today: null,
  weekly: [],
  monthly: [],
  loading: false,

  setToday: (today) => set({ today }),
  setWeekly: (weekly) => set({ weekly }),
  setMonthly: (monthly) => set({ monthly }),
  setLoading: (loading) => set({ loading }),
}));
```

- [ ] **Step 9: Write settings store**

File: `tomato_app/src/renderer/stores/settings-store.ts`

```typescript
import { create } from 'zustand';

interface SettingsStoreState {
  settings: Record<string, string>;
  loading: boolean;

  setAll: (settings: Record<string, string>) => void;
  set: (key: string, value: string) => void;
  get: (key: string, defaultValue?: string) => string | null;
  remove: (key: string) => void;
  setLoading: (loading: boolean) => void;
}

export const useSettingsStore = create<SettingsStoreState>((set, get) => ({
  settings: {},
  loading: false,

  setAll: (settings) => set({ settings }),
  set: (key, value) => set((s) => ({ settings: { ...s.settings, [key]: value } })),
  get: (key, defaultValue) => get().settings[key] ?? defaultValue ?? null,
  remove: (key) =>
    set((s) => {
      const next = { ...s.settings };
      delete next[key];
      return { settings: next };
    }),
  setLoading: (loading) => set({ loading }),
}));
```

- [ ] **Step 10: Run all store tests**

Run: `cd /Users/cbookshu/dev/temp/tomato_app/tomato_app && npx vitest run tests/stores/`
Expected: all tests PASS

- [ ] **Step 11: Commit**

```bash
git add tomato_app/src/renderer/stores/ tomato_app/tests/stores/ tomato_app/vitest.config.ts
git commit -m "feat: add Zustand stores for timer, tasks, stats, and settings"
```

---

### Task 5: App Shell Layout

**Files:**
- Create: `tomato_app/src/renderer/components/Layout/AppShell.tsx`
- Create: `tomato_app/src/renderer/components/Layout/StatusBar.tsx`
- Modify: `tomato_app/src/renderer/App.tsx`

- [ ] **Step 1: Write AppShell component**

File: `tomato_app/src/renderer/components/Layout/AppShell.tsx`

```typescript
import React from 'react';
import { Timer, ListTodo, BarChart3, Settings } from 'lucide-react';
import { useTimerStore } from '@/stores/timer-store.js';

type Tab = 'timer' | 'tasks' | 'stats' | 'settings';

interface AppShellProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  children: React.ReactNode;
}

const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'timer', label: '计时', icon: <Timer className="h-5 w-5" /> },
  { id: 'tasks', label: '任务', icon: <ListTodo className="h-5 w-5" /> },
  { id: 'stats', label: '统计', icon: <BarChart3 className="h-5 w-5" /> },
  { id: 'settings', label: '设置', icon: <Settings className="h-5 w-5" /> },
];

export function AppShell({ activeTab, onTabChange, children }: AppShellProps) {
  const status = useTimerStore((s) => s.status);

  return (
    <div className="flex h-screen flex-col">
      {/* Title bar area (draggable for Electron) */}
      <header className="flex-none drag h-10" />

      {/* Main content */}
      <main className="flex-1 overflow-auto p-4">{children}</main>

      {/* Bottom status bar */}
      <footer className="flex-none border-t border-gray-200 dark:border-gray-700 px-4 py-1 flex items-center justify-between text-xs text-gray-500">
        <span>
          {status === 'working' ? '工作中' : status === 'breaking' ? '休息中' : status === 'paused' ? '已暂停' : '就绪'}
        </span>
      </footer>

      {/* Tab bar */}
      <nav className="flex-none border-t border-gray-200 dark:border-gray-700 flex">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-xs transition-colors ${
              activeTab === tab.id
                ? 'text-tomato'
                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
```

- [ ] **Step 2: Update App.tsx with tab routing**

File: `tomato_app/src/renderer/App.tsx`

```typescript
import { useState } from 'react';
import { AppShell } from '@/components/Layout/AppShell.js';
import { TimerDisplay } from '@/components/Timer/TimerDisplay.js';
import { TimerControls } from '@/components/Timer/TimerControls.js';

export default function App() {
  const [activeTab, setActiveTab] = useState<'timer' | 'tasks' | 'stats' | 'settings'>('timer');

  return (
    <AppShell activeTab={activeTab} onTabChange={setActiveTab}>
      {activeTab === 'timer' && (
        <div className="flex flex-col items-center justify-center h-full gap-8">
          <TimerDisplay />
          <TimerControls />
        </div>
      )}
      {activeTab === 'tasks' && (
        <div className="flex items-center justify-center h-full text-gray-400">
          Task list coming in Task 6
        </div>
      )}
      {activeTab === 'stats' && (
        <div className="flex items-center justify-center h-full text-gray-400">
          Stats coming in Task 12
        </div>
      )}
      {activeTab === 'settings' && (
        <div className="flex items-center justify-center h-full text-gray-400">
          Settings coming in Task 13
        </div>
      )}
    </AppShell>
  );
}
```

- [ ] **Step 3: Create placeholder Timer components (to be filled in Task 6)**

File: `tomato_app/src/renderer/components/Timer/TimerDisplay.tsx`

```typescript
import { useTimerStore } from '@/stores/timer-store.js';

export function TimerDisplay() {
  const status = useTimerStore((s) => s.status);
  const formattedTime = useTimerStore((s) => s.formattedTime());

  const statusLabels: Record<string, string> = {
    idle: '准备开始',
    working: '专注中',
    paused: '已暂停',
    breaking: '短休息',
    'long-break': '长休息',
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="text-sm font-medium text-gray-500">{statusLabels[status]}</div>
      <div className="font-mono text-8xl font-bold tabular-nums text-tomato">
        {formattedTime}
      </div>
      <div className="flex items-center gap-2 text-sm text-gray-400">
        {Array.from({ length: 4 }, (_, i) => (
          <div
            key={i}
            className={`h-2 w-2 rounded-full ${
              i < useTimerStore.getState().currentCycle ? 'bg-tomato' : 'bg-gray-200 dark:bg-gray-700'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
```

File: `tomato_app/src/renderer/components/Timer/TimerControls.tsx`

```typescript
import { Button } from '@/components/ui/button.js';
import { useTimerStore } from '@/stores/timer-store.js';
import { Play, Pause, RotateCcw, SkipForward } from 'lucide-react';

export function TimerControls() {
  const status = useTimerStore((s) => s.status);

  return (
    <div className="flex items-center gap-3">
      {status === 'idle' && (
        <Button size="lg" onClick={() => {}}>
          <Play className="h-5 w-5" />
          开始专注
        </Button>
      )}
      {status === 'working' && (
        <>
          <Button size="lg" variant="secondary" onClick={() => {}}>
            <Pause className="h-5 w-5" />
            暂停
          </Button>
          <Button size="icon" variant="ghost" onClick={() => {}}>
            <SkipForward className="h-5 w-5" />
          </Button>
          <Button size="icon" variant="ghost" onClick={() => {}}>
            <RotateCcw className="h-5 w-5" />
          </Button>
        </>
      )}
      {status === 'paused' && (
        <>
          <Button size="lg" onClick={() => {}}>
            <Play className="h-5 w-5" />
            继续
          </Button>
          <Button size="icon" variant="ghost" onClick={() => {}}>
            <RotateCcw className="h-5 w-5" />
          </Button>
        </>
      )}
      {(status === 'breaking' || status === 'long-break') && (
        <Button size="lg" variant="secondary" onClick={() => {}}>
          <SkipForward className="h-5 w-5" />
          跳过休息
        </Button>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Verify build**

Run: `cd /Users/cbookshu/dev/temp/tomato_app/tomato_app && npx tsc --noEmit && npx vite build`
Expected: no errors, renderer builds

- [ ] **Step 5: Commit**

```bash
git add tomato_app/src/renderer/App.tsx tomato_app/src/renderer/components/Layout/ tomato_app/src/renderer/components/Timer/
git commit -m "feat: add AppShell layout with tab navigation and timer display components"
```

---

### Task 6: Timer UI Integration with IPC

**Files:**
- Create: `tomato_app/src/renderer/hooks/useTimer.ts`
- Modify: `tomato_app/src/renderer/components/Timer/TimerControls.tsx`
- Modify: `tomato_app/src/renderer/components/Timer/TimerDisplay.tsx`

- [ ] **Step 1: Write useTimer hook**

File: `tomato_app/src/renderer/hooks/useTimer.ts`

```typescript
import { useEffect } from 'react';
import { useTimerStore } from '@/stores/timer-store.js';
import { useIpc } from './useIpc.js';
import { IPC } from '@shared/ipc-channels.js';
import type { TimerState } from '@pomodoro/core';

export function useTimer() {
  const { invoke, listen } = useIpc();
  const store = useTimerStore();

  useEffect(() => {
    // Listen for tick events from main process
    const unsubTick = listen(IPC.TIMER_TICK, (remainingTime: unknown) => {
      store.tick(remainingTime as number);
    });

    // Listen for status changes
    const unsubStatus = listen(IPC.TIMER_STATUS_CHANGE, (status: unknown) => {
      store.setState({ ...useTimerStore.getState(), status: status as TimerState['status'] });
    });

    // Listen for completion
    const unsubComplete = listen(IPC.TIMER_COMPLETE, (_type: unknown) => {
      if (_type === 'work') {
        store.setState({ ...useTimerStore.getState(), status: 'breaking' });
      }
    });

    return () => {
      unsubTick();
      unsubStatus();
      unsubComplete();
    };
  }, []);

  const start = (taskId?: string) => invoke(IPC.TIMER_START, taskId ? { taskId } : undefined);
  const pause = () => invoke(IPC.TIMER_PAUSE);
  const resume = () => invoke(IPC.TIMER_RESUME);
  const stop = () => invoke(IPC.TIMER_STOP);
  const skip = () => invoke(IPC.TIMER_SKIP);

  return { ...store, start, pause, resume, stop, skip };
}
```

- [ ] **Step 2: Update TimerControls to call IPC actions**

File: `tomato_app/src/renderer/components/Timer/TimerControls.tsx`

```typescript
import { Button } from '@/components/ui/button.js';
import { Play, Pause, RotateCcw, SkipForward } from 'lucide-react';
import { useTimer } from '@/hooks/useTimer.js';

export function TimerControls() {
  const { status, start, pause, resume, stop, skip } = useTimer();

  return (
    <div className="flex items-center gap-3">
      {status === 'idle' && (
        <Button size="lg" onClick={() => start()}>
          <Play className="h-5 w-5" />
          开始专注
        </Button>
      )}
      {status === 'working' && (
        <>
          <Button size="lg" variant="secondary" onClick={pause}>
            <Pause className="h-5 w-5" />
            暂停
          </Button>
          <Button size="icon" variant="ghost" onClick={skip}>
            <SkipForward className="h-5 w-5" />
          </Button>
          <Button size="icon" variant="ghost" onClick={stop}>
            <RotateCcw className="h-5 w-5" />
          </Button>
        </>
      )}
      {status === 'paused' && (
        <>
          <Button size="lg" onClick={resume}>
            <Play className="h-5 w-5" />
            继续
          </Button>
          <Button size="icon" variant="ghost" onClick={stop}>
            <RotateCcw className="h-5 w-5" />
          </Button>
        </>
      )}
      {(status === 'breaking' || status === 'long-break') && (
        <Button size="lg" variant="secondary" onClick={skip}>
          <SkipForward className="h-5 w-5" />
          跳过休息
        </Button>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Update TimerDisplay to use useTimer hook**

File: `tomato_app/src/renderer/components/Timer/TimerDisplay.tsx`

```typescript
import { useTimer } from '@/hooks/useTimer.js';

export function TimerDisplay() {
  const { status, formattedTime, currentCycle } = useTimer();

  const statusLabels: Record<string, string> = {
    idle: '准备开始',
    working: '专注中',
    paused: '已暂停',
    breaking: '短休息',
    'long-break': '长休息',
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="text-sm font-medium text-gray-500">{statusLabels[status] ?? status}</div>
      <div className="font-mono text-8xl font-bold tabular-nums text-tomato">
        {formattedTime()}
      </div>
      <div className="flex items-center gap-2 text-sm text-gray-400">
        {Array.from({ length: 4 }, (_, i) => (
          <div
            key={i}
            className={`h-2 w-2 rounded-full ${
              i < currentCycle ? 'bg-tomato' : 'bg-gray-200 dark:bg-gray-700'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Verify build**

Run: `cd /Users/cbookshu/dev/temp/tomato_app/tomato_app && npx tsc --noEmit && npx vite build`
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add tomato_app/src/renderer/hooks/useTimer.ts tomato_app/src/renderer/components/Timer/
git commit -m "feat: wire timer UI to IPC via useTimer hook"
```

---

### Task 7: Task List UI Components

**Files:**
- Create: `tomato_app/src/renderer/components/TaskList/TaskGroupList.tsx`
- Create: `tomato_app/src/renderer/components/TaskList/TaskGroupHeader.tsx`
- Create: `tomato_app/src/renderer/components/TaskList/TaskItem.tsx`
- Create: `tomato_app/src/renderer/components/TaskList/TaskForm.tsx`
- Modify: `tomato_app/src/renderer/App.tsx`

- [ ] **Step 1: Write TaskItem component**

File: `tomato_app/src/renderer/components/TaskList/TaskItem.tsx`

```typescript
import { Checkbox } from '@/components/ui/checkbox.js';
import { Button } from '@/components/ui/button.js';
import { cn } from '@/lib/utils.js';
import type { Task } from '@pomodoro/core';
import { GripVertical, Pencil, Trash2, Play } from 'lucide-react';
import { useState } from 'react';

interface TaskItemProps {
  task: Task;
  onCheck: (id: string) => void;
  onStart: (id: string) => void;
  onEdit: (id: string, title: string) => void;
  onDelete: (id: string) => void;
}

export function TaskItem({ task, onCheck, onStart, onEdit, onDelete }: TaskItemProps) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(task.title);
  const isCompleted = task.status === 'completed';

  const handleSave = () => {
    if (title.trim()) {
      onEdit(task.id, title.trim());
      setEditing(false);
    }
  };

  return (
    <div
      className={cn(
        'group flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors',
        isCompleted && 'opacity-50',
      )}
    >
      <GripVertical className="h-4 w-4 text-gray-300 opacity-0 group-hover:opacity-100 cursor-grab shrink-0" />
      <Checkbox
        checked={isCompleted}
        onCheckedChange={() => onCheck(task.id)}
        className="shrink-0"
      />
      {editing ? (
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={handleSave}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSave();
            if (e.key === 'Escape') setEditing(false);
          }}
          className="flex-1 bg-transparent border-b border-tomato px-1 text-sm outline-none"
        />
      ) : (
        <span
          className={cn('flex-1 text-sm truncate', isCompleted && 'line-through')}
          onDoubleClick={() => setEditing(true)}
        >
          {task.title}
        </span>
      )}
      <span className="text-xs text-gray-400 tabular-nums whitespace-nowrap">
        {task.completedPomodoros > 0 ? `x${task.completedPomodoros}` : ''}
      </span>
      <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => onStart(task.id)}>
          <Play className="h-3 w-3" />
        </Button>
        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setEditing(true)}>
          <Pencil className="h-3 w-3" />
        </Button>
        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => onDelete(task.id)}>
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Write TaskGroupHeader component**

File: `tomato_app/src/renderer/components/TaskList/TaskGroupHeader.tsx`

```typescript
import type { TaskGroup, Task } from '@pomodoro/core';
import { ChevronDown, ChevronRight, Plus, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button.js';
import { useState } from 'react';

interface TaskGroupHeaderProps {
  group: TaskGroup;
  tasks: Task[];
  collapsed: boolean;
  onToggle: () => void;
  onAddTask: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
}

export function TaskGroupHeader({
  group,
  tasks,
  collapsed,
  onToggle,
  onAddTask,
  onRename,
  onDelete,
}: TaskGroupHeaderProps) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(group.name);
  const isDefault = group.id === 'default';
  const completed = tasks.filter((t) => t.status === 'completed').length;

  const handleSave = () => {
    if (name.trim()) {
      onRename(name.trim());
      setEditing(false);
    }
  };

  return (
    <div className="flex items-center gap-1 px-2 py-1.5 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800/50">
      <button onClick={onToggle} className="p-0.5">
        {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      {group.color && (
        <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: group.color }} />
      )}
      {editing ? (
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={handleSave}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSave();
            if (e.key === 'Escape') setEditing(false);
          }}
          className="flex-1 bg-transparent border-b border-tomato px-1 text-sm font-medium outline-none"
        />
      ) : (
        <span
          className="flex-1 text-sm font-medium truncate"
          onDoubleClick={() => !isDefault && setEditing(true)}
        >
          {group.name}
        </span>
      )}
      <span className="text-xs text-gray-400 whitespace-nowrap">
        {completed}/{tasks.length}
      </span>
      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={onAddTask}>
        <Plus className="h-3.5 w-3.5" />
      </Button>
      {!isDefault && (
        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={onDelete}>
          <MoreHorizontal className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Write TaskForm component**

File: `tomato_app/src/renderer/components/TaskList/TaskForm.tsx`

```typescript
import { useState } from 'react';
import { Input } from '@/components/ui/input.js';
import { Button } from '@/components/ui/button.js';

interface TaskFormProps {
  onSubmit: (title: string) => void;
  onCancel: () => void;
}

export function TaskForm({ onSubmit, onCancel }: TaskFormProps) {
  const [title, setTitle] = useState('');

  const handleSubmit = () => {
    if (title.trim()) {
      onSubmit(title.trim());
      setTitle('');
    }
  };

  return (
    <div className="flex items-center gap-2 px-2 py-1">
      <Input
        autoFocus
        placeholder="输入任务标题..."
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleSubmit();
          if (e.key === 'Escape') onCancel();
        }}
        className="h-8 text-sm"
      />
      <Button size="sm" onClick={handleSubmit}>
        添加
      </Button>
      <Button size="sm" variant="ghost" onClick={onCancel}>
        取消
      </Button>
    </div>
  );
}
```

- [ ] **Step 4: Write TaskGroupList component**

File: `tomato_app/src/renderer/components/TaskList/TaskGroupList.tsx`

```typescript
import { useState } from 'react';
import { TaskGroupHeader } from './TaskGroupHeader.js';
import { TaskItem } from './TaskItem.js';
import { TaskForm } from './TaskForm.js';
import { useTaskStore } from '@/stores/task-store.js';
import { Button } from '@/components/ui/button.js';
import { Plus } from 'lucide-react';

export function TaskGroupList() {
  const groups = useTaskStore((s) => s.groups);
  const { getTasksByGroup, addTask, removeTask, updateTask, addGroup, removeGroup, updateGroup } =
    useTaskStore();
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [addingTo, setAddingTo] = useState<string | null>(null);

  const toggle = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  return (
    <div className="flex flex-col gap-1">
      {groups.map((group) => (
        <div key={group.id}>
          <TaskGroupHeader
            group={group}
            tasks={getTasksByGroup(group.id)}
            collapsed={collapsed.has(group.id)}
            onToggle={() => toggle(group.id)}
            onAddTask={() => setAddingTo(group.id)}
            onRename={(name) => updateGroup(group.id, { name })}
            onDelete={() => removeGroup(group.id)}
          />
          {!collapsed.has(group.id) && (
            <div className="ml-6">
              {getTasksByGroup(group.id).map((task) => (
                <TaskItem
                  key={task.id}
                  task={task}
                  onCheck={(id) =>
                    updateTask(id, {
                      status: task.status === 'completed' ? 'todo' : 'completed',
                      completedAt: task.status !== 'completed' ? new Date().toISOString() : undefined,
                    })
                  }
                  onStart={(id) => {
                    /* wired in Task 9 */
                  }}
                  onEdit={(id, title) => updateTask(id, { title })}
                  onDelete={(id) => removeTask(id)}
                />
              ))}
              {addingTo === group.id && (
                <TaskForm
                  onSubmit={(title) => {
                    addTask({
                      id: crypto.randomUUID(),
                      title,
                      completedPomodoros: 0,
                      status: 'todo',
                      groupId: group.id,
                      createdAt: new Date().toISOString(),
                      updatedAt: new Date().toISOString(),
                    });
                    setAddingTo(null);
                  }}
                  onCancel={() => setAddingTo(null)}
                />
              )}
            </div>
          )}
        </div>
      ))}
      <Button variant="ghost" size="sm" className="self-start mt-2" onClick={() => {}}>
        <Plus className="h-4 w-4" />
        新建分组
      </Button>
    </div>
  );
}
```

- [ ] **Step 5: Update App.tsx tasks tab**

File: `tomato_app/src/renderer/App.tsx`

In the App.tsx tasks tab section, replace:
```
<TaskGroupList />
```

Update the import and the tasks tab to use TaskGroupList.

- [ ] **Step 6: Verify build**

Run: `cd /Users/cbookshu/dev/temp/tomato_app/tomato_app && npx tsc --noEmit && npx vite build`
Expected: no errors

- [ ] **Step 7: Commit**

```bash
git add tomato_app/src/renderer/components/TaskList/ tomato_app/src/renderer/App.tsx
git commit -m "feat: add task list UI components (group list, items, inline editing)"
```

---

### Task 8: Stats Panel Components

**Files:**
- Create: `tomato_app/src/renderer/components/Stats/DailyStatsCard.tsx`
- Create: `tomato_app/src/renderer/components/Stats/WeeklyTrend.tsx`
- Modify: `tomato_app/src/renderer/App.tsx`

- [ ] **Step 1: Write DailyStatsCard**

File: `tomato_app/src/renderer/components/Stats/DailyStatsCard.tsx`

```typescript
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card.js';
import { useStatsStore } from '@/stores/stats-store.js';
import { formatMinutes } from '@/lib/utils.js';
import { Timer, CheckCircle2, Clock } from 'lucide-react';

export function DailyStatsCard() {
  const today = useStatsStore((s) => s.today);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">今日统计</CardTitle>
      </CardHeader>
      <CardContent>
        {today ? (
          <div className="grid grid-cols-3 gap-4">
            <div className="flex flex-col items-center gap-1 p-3 rounded-lg bg-red-50 dark:bg-red-950">
              <Timer className="h-5 w-5 text-tomato" />
              <span className="text-2xl font-bold tabular-nums">{today.totalPomodoros}</span>
              <span className="text-xs text-gray-500">番茄数</span>
            </div>
            <div className="flex flex-col items-center gap-1 p-3 rounded-lg bg-green-50 dark:bg-green-950">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <span className="text-2xl font-bold tabular-nums">{today.completedTasks}</span>
              <span className="text-xs text-gray-500">完成任务</span>
            </div>
            <div className="flex flex-col items-center gap-1 p-3 rounded-lg bg-blue-50 dark:bg-blue-950">
              <Clock className="h-5 w-5 text-blue-600" />
              <span className="text-2xl font-bold tabular-nums">
                {formatMinutes(today.totalPomodoros * 25)}
              </span>
              <span className="text-xs text-gray-500">专注时长</span>
            </div>
          </div>
        ) : (
          <div className="text-center text-gray-400 py-8">暂无数据，开始你的第一个番茄吧</div>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Write WeeklyTrend**

File: `tomato_app/src/renderer/components/Stats/WeeklyTrend.tsx`

```typescript
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card.js';
import { useStatsStore } from '@/stores/stats-store.js';

export function WeeklyTrend() {
  const weekly = useStatsStore((s) => s.weekly);
  const maxPomodoros = Math.max(...weekly.map((d) => d.totalPomodoros), 1);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">本周趋势</CardTitle>
      </CardHeader>
      <CardContent>
        {weekly.length > 0 ? (
          <div className="flex items-end gap-2 h-32">
            {weekly.map((day) => (
              <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-xs font-mono tabular-nums">{day.totalPomodoros}</span>
                <div
                  className="w-full rounded-t-sm bg-tomato transition-all"
                  style={{ height: `${(day.totalPomodoros / maxPomodoros) * 80}%` }}
                />
                <span className="text-xs text-gray-400">{day.date.slice(5)}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center text-gray-400 py-8">暂无本周数据</div>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: Update App.tsx stats tab**

Replace the stats placeholder in App.tsx with:

```typescript
import { DailyStatsCard } from '@/components/Stats/DailyStatsCard.js';
import { WeeklyTrend } from '@/components/Stats/WeeklyTrend.js';

// In the 'stats' tab:
<div className="flex flex-col gap-4 max-w-md mx-auto w-full pt-8">
  <DailyStatsCard />
  <WeeklyTrend />
</div>
```

- [ ] **Step 4: Verify build**

Run: `cd /Users/cbookshu/dev/temp/tomato_app/tomato_app && npx tsc --noEmit && npx vite build`
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add tomato_app/src/renderer/components/Stats/ tomato_app/src/renderer/App.tsx
git commit -m "feat: add stats panel (daily card and weekly trend bar chart)"
```

---

### Task 9: Settings Page

**Files:**
- Create: `tomato_app/src/renderer/components/Settings/SettingsPage.tsx`
- Modify: `tomato_app/src/renderer/App.tsx`

- [ ] **Step 1: Write SettingsPage**

File: `tomato_app/src/renderer/components/Settings/SettingsPage.tsx`

```typescript
import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card.js';
import { Label } from '@/components/ui/label.js';
import { Input } from '@/components/ui/input.js';
import { Checkbox } from '@/components/ui/checkbox.js';

export function SettingsPage() {
  const [pomodoroDuration, setPomodoroDuration] = useState('25');
  const [shortBreak, setShortBreak] = useState('5');
  const [longBreak, setLongBreak] = useState('15');
  const [longBreakInterval, setLongBreakInterval] = useState('4');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [notificationEnabled, setNotificationEnabled] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [autoStart, setAutoStart] = useState(false);

  return (
    <div className="flex flex-col gap-4 max-w-md mx-auto w-full pt-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">计时设置</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <Label>番茄时长 (分钟)</Label>
            <Input
              type="number"
              min={1}
              max={120}
              value={pomodoroDuration}
              onChange={(e) => setPomodoroDuration(e.target.value)}
              className="w-20"
            />
          </div>
          <div className="flex items-center justify-between">
            <Label>短休息 (分钟)</Label>
            <Input
              type="number"
              min={1}
              max={30}
              value={shortBreak}
              onChange={(e) => setShortBreak(e.target.value)}
              className="w-20"
            />
          </div>
          <div className="flex items-center justify-between">
            <Label>长休息 (分钟)</Label>
            <Input
              type="number"
              min={1}
              max={60}
              value={longBreak}
              onChange={(e) => setLongBreak(e.target.value)}
              className="w-20"
            />
          </div>
          <div className="flex items-center justify-between">
            <Label>长休息间隔 (番茄数)</Label>
            <Input
              type="number"
              min={1}
              max={10}
              value={longBreakInterval}
              onChange={(e) => setLongBreakInterval(e.target.value)}
              className="w-20"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">通知设置</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <Label>声音提醒</Label>
            <Checkbox checked={soundEnabled} onCheckedChange={setSoundEnabled} />
          </div>
          <div className="flex items-center justify-between">
            <Label>系统通知</Label>
            <Checkbox checked={notificationEnabled} onCheckedChange={setNotificationEnabled} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">外观</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <Label>暗色模式</Label>
            <Checkbox checked={darkMode} onCheckedChange={setDarkMode} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">高级</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <Label>开机自启动</Label>
            <Checkbox checked={autoStart} onCheckedChange={setAutoStart} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Update App.tsx settings tab**

Replace the settings placeholder in App.tsx with:
```typescript
import { SettingsPage } from '@/components/Settings/SettingsPage.js';
// In the 'settings' tab:
<SettingsPage />
```

- [ ] **Step 3: Verify build**

Run: `cd /Users/cbookshu/dev/temp/tomato_app/tomato_app && npx tsc --noEmit && npx vite build`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add tomato_app/src/renderer/components/Settings/ tomato_app/src/renderer/App.tsx
git commit -m "feat: add settings page with timer, notification, appearance, and advanced sections"
```

---

### Task 10: Electron Main Process - IPC Handlers + Timer

**Files:**
- Create: `tomato_app/src/main/ipc-handlers.ts`
- Modify: `tomato_app/src/main/index.ts`
- Modify: `tomato_app/src/main/window.ts`

- [ ] **Step 1: Write IPC handlers for timer + stores**

File: `tomato_app/src/main/ipc-handlers.ts`

```typescript
import { ipcMain, BrowserWindow } from 'electron';
import { IPC } from '../shared/ipc-channels.js';
import { PomodoroTimer, DEFAULT_POMODORO_CONFIG } from '@pomodoro/core';
import type { PomodoroConfig } from '@pomodoro/core';

let timer: PomodoroTimer | null = null;
let taskManager: import('@pomodoro/core').TaskManager | null = null;
let statsRepo: import('@pomodoro/core').StatsRepository | null = null;
let settingsRepo: import('@pomodoro/core').SettingsRepository | null = null;

function getTimer(): PomodoroTimer {
  if (!timer) {
    timer = new PomodoroTimer();
  }
  return timer;
}

export function registerIpcHandlers(
  getWindow: () => BrowserWindow | null,
  // These are injected after DB init (Task 14)
  _taskManager?: import('@pomodoro/core').TaskManager,
  _statsRepo?: import('@pomodoro/core').StatsRepository,
  _settingsRepo?: import('@pomodoro/core').SettingsRepository,
) {
  taskManager = _taskManager ?? null;
  statsRepo = _statsRepo ?? null;
  settingsRepo = _settingsRepo ?? null;

  // Timer handlers
  ipcMain.handle(IPC.TIMER_START, (_event, payload?: { taskId?: string }) => {
    const t = getTimer();
    const win = getWindow();
    t.on('tick', (remainingTime: number) => win?.webContents.send(IPC.TIMER_TICK, remainingTime));
    t.on('statusChange', (status: string) => win?.webContents.send(IPC.TIMER_STATUS_CHANGE, status));
    t.on('complete', (type: 'work' | 'break') => win?.webContents.send(IPC.TIMER_COMPLETE, type));
    t.start(payload?.taskId);
  });

  ipcMain.handle(IPC.TIMER_PAUSE, () => getTimer().pause());
  ipcMain.handle(IPC.TIMER_RESUME, () => getTimer().resume());
  ipcMain.handle(IPC.TIMER_STOP, () => getTimer().stop());
  ipcMain.handle(IPC.TIMER_SKIP, () => getTimer().skip());

  ipcMain.handle(IPC.TIMER_STATE, () => getTimer().getState());

  // Task handlers
  if (taskManager) {
    ipcMain.handle(IPC.TASK_CREATE, async (_e, payload) => {
      const task = await taskManager!.createTask(payload.input, payload.referenceTaskId, payload.insertAfter);
      return task;
    });
    ipcMain.handle(IPC.TASK_GET, async (_e, payload) => taskManager!.getTask(payload.id));
    ipcMain.handle(IPC.TASK_GET_ALL, async () => taskManager!.getAllTasks());
    ipcMain.handle(IPC.TASK_GET_BY_STATUS, async (_e, payload) => taskManager!.getTasksByStatus(payload.status));
    ipcMain.handle(IPC.TASK_EDIT, async (_e, payload) => taskManager!.editTask(payload.id, payload.updates));
    ipcMain.handle(IPC.TASK_COMPLETE, async (_e, payload) => taskManager!.completeTask(payload.id));
    ipcMain.handle(IPC.TASK_DELETE, async (_e, payload) => taskManager!.deleteTask(payload.id));
    ipcMain.handle(IPC.TASK_MOVE_TO_GROUP, async (_e, payload) =>
      taskManager!.moveTaskToGroup(payload.taskId, payload.newGroupId),
    );
    ipcMain.handle(IPC.TASK_REORDER, async (_e, payload) =>
      taskManager!.reorderTask(payload.taskId, payload.newIndex),
    );
    ipcMain.handle(IPC.TASK_INCREMENT_POMODORO, async (_e, payload) =>
      taskManager!.incrementPomodoro(payload.id, payload.dateStr),
    );

    // Group handlers
    ipcMain.handle(IPC.GROUP_CREATE, async (_e, payload) => taskManager!.createGroup(payload.input));
    ipcMain.handle(IPC.GROUP_GET, async (_e, payload) => taskManager!.getGroup(payload.id));
    ipcMain.handle(IPC.GROUP_GET_ALL, async () => taskManager!.getAllGroups());
    ipcMain.handle(IPC.GROUP_RENAME, async (_e, payload) => taskManager!.renameGroup(payload.id, payload.name));
    ipcMain.handle(IPC.GROUP_DELETE, async (_e, payload) => taskManager!.deleteGroup(payload.id));
  }

  // Stats handlers
  if (statsRepo) {
    ipcMain.handle(IPC.STATS_GET_DAILY, async (_e, payload) => {
      const stat = await statsRepo!.findByDate(payload.date);
      return stat ?? { date: payload.date, totalPomodoros: 0, completedTasks: 0, tasks: [] };
    });
    ipcMain.handle(IPC.STATS_GET_WEEKLY, async (_e, payload) => {
      const { computeWeeklyTrend } = await import('@pomodoro/core');
      const end = new Date(payload.endDate);
      const startDate = new Date(end);
      startDate.setDate(startDate.getDate() - 6);
      const allStats = await statsRepo!.findByDateRange(
        startDate.toISOString().slice(0, 10),
        payload.endDate,
      );
      return computeWeeklyTrend(allStats, payload.endDate);
    });
    ipcMain.handle(IPC.STATS_GET_MONTHLY, async () => {
      const { computeMonthlyStats } = await import('@pomodoro/core');
      const allStats = await statsRepo!.findByDateRange('2000-01-01', '2099-12-31');
      return computeMonthlyStats(allStats);
    });
  }

  // Settings handlers
  if (settingsRepo) {
    ipcMain.handle(IPC.SETTINGS_GET, async (_e, payload) => settingsRepo!.get(payload.key, payload.defaultValue));
    ipcMain.handle(IPC.SETTINGS_SET, async (_e, payload) => settingsRepo!.set(payload.key, payload.value));
    ipcMain.handle(IPC.SETTINGS_GET_ALL, async () => settingsRepo!.getAll());
    ipcMain.handle(IPC.SETTINGS_DELETE, async (_e, payload) => settingsRepo!.delete(payload.key));
  }
}
```

- [ ] **Step 2: Update main index.ts to register IPC**

File: `tomato_app/src/main/index.ts`

Update to import and call registerIpcHandlers after window creation.

```typescript
import { app, BrowserWindow } from 'electron';
import { createWindow } from './window.js';
import { registerIpcHandlers } from './ipc-handlers.js';

let mainWindow: BrowserWindow | null = null;

app.whenReady().then(() => {
  mainWindow = createWindow();
  registerIpcHandlers(() => mainWindow);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    mainWindow = createWindow();
    registerIpcHandlers(() => mainWindow);
  }
});
```

- [ ] **Step 3: Verify main process compiles**

Run: `cd /Users/cbookshu/dev/temp/tomato_app/tomato_app && npx tsc -p tsconfig.main.json --noEmit`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add tomato_app/src/main/ipc-handlers.ts tomato_app/src/main/index.ts
git commit -m "feat: add IPC handlers for timer operations with PomodoroTimer from core"
```

---

### Task 11: Database Initialization in Main Process

**Files:**
- Create: `tomato_app/src/main/database.ts`
- Modify: `tomato_app/src/main/index.ts`
- Modify: `tomato_app/src/main/ipc-handlers.ts`

- [ ] **Step 1: Write database initialization module**

File: `tomato_app/src/main/database.ts`

```typescript
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { TaskManager, TaskRepository, TaskGroupRepository } from '@pomodoro/core';
import { StatsRepository } from '@pomodoro/core';
import { SettingsRepository } from '@pomodoro/core';
import { app } from 'electron';
import path from 'node:path';

let db: ReturnType<typeof drizzle> | null = null;
let taskManager: TaskManager | null = null;
let statsRepo: StatsRepository | null = null;
let settingsRepo: SettingsRepository | null = null;

export function initDatabase() {
  const dbPath = path.join(app.getPath('userData'), 'tomato.db');
  const sqlite = new Database(dbPath);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');

  // Create tables
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS task_groups (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      color TEXT,
      task_order TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      completed_pomodoros INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'todo',
      group_id TEXT REFERENCES task_groups(id),
      last_pomodoro_time TEXT,
      tags TEXT DEFAULT '[]',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      completed_at TEXT
    );
    CREATE TABLE IF NOT EXISTS daily_stats (
      date TEXT PRIMARY KEY,
      total_pomodoros INTEGER NOT NULL DEFAULT 0,
      completed_tasks INTEGER NOT NULL DEFAULT 0,
      tasks TEXT NOT NULL DEFAULT '[]'
    );
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  db = drizzle(sqlite);

  const taskRepo = new TaskRepository(db);
  const groupRepo = new TaskGroupRepository(db);
  taskManager = new TaskManager(taskRepo, groupRepo);
  statsRepo = new StatsRepository(db);
  settingsRepo = new SettingsRepository(db);

  return { taskManager, statsRepo, settingsRepo };
}

export function getTaskManager() {
  if (!taskManager) throw new Error('Database not initialized');
  return taskManager;
}

export function getStatsRepo() {
  if (!statsRepo) throw new Error('Database not initialized');
  return statsRepo;
}

export function getSettingsRepo() {
  if (!settingsRepo) throw new Error('Database not initialized');
  return settingsRepo;
}
```

- [ ] **Step 2: Wire database into main entry and IPC**

File: `tomato_app/src/main/index.ts`

```typescript
import { app, BrowserWindow } from 'electron';
import { createWindow } from './window.js';
import { registerIpcHandlers } from './ipc-handlers.js';
import { initDatabase } from './database.js';

let mainWindow: BrowserWindow | null = null;

app.whenReady().then(async () => {
  // Initialize database first
  const { taskManager, statsRepo, settingsRepo } = initDatabase();
  await taskManager.initialize();

  mainWindow = createWindow();
  registerIpcHandlers(() => mainWindow, taskManager, statsRepo, settingsRepo);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    mainWindow = createWindow();
  }
});
```

- [ ] **Step 3: Update ipc-handlers to accept injected deps**

In `ipc-handlers.ts`, update the function signature to use the actual injected types (already done in the Task 10 code above).

- [ ] **Step 4: Verify main process compiles**

Run: `cd /Users/cbookshu/dev/temp/tomato_app/tomato_app && npx tsc -p tsconfig.main.json --noEmit`
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add tomato_app/src/main/database.ts tomato_app/src/main/index.ts
git commit -m "feat: initialize SQLite database in Electron main process with all repositories"
```

---

### Task 12: System Tray

**Files:**
- Create: `tomato_app/src/main/tray.ts`
- Modify: `tomato_app/src/main/index.ts`

- [ ] **Step 1: Write tray module**

File: `tomato_app/src/main/tray.ts`

```typescript
import { Tray, Menu, nativeImage, BrowserWindow } from 'electron';
import path from 'node:path';
import { app } from 'electron';
import { IPC } from '../shared/ipc-channels.js';

let tray: Tray | null = null;

const isDev = !app.isPackaged;

function getIconPath(name: string): string {
  if (isDev) {
    return path.join(app.getAppPath(), 'resources', name);
  }
  return path.join(process.resourcesPath, name);
}

function createIcon(color: string): nativeImage {
  // Create a 16x16 colored circle as tray icon
  const size = 16;
  const canvas = Buffer.alloc(size * size * 4);
  const [r, g, b] = color === 'red' ? [239, 68, 68] : color === 'green' ? [16, 185, 129] : [156, 163, 175];

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const dx = x - size / 2 + 0.5;
      const dy = y - size / 2 + 0.5;
      if (dx * dx + dy * dy <= (size / 2 - 1) ** 2) {
        canvas[idx] = r;
        canvas[idx + 1] = g;
        canvas[idx + 2] = b;
        canvas[idx + 3] = 255;
      }
    }
  }

  return nativeImage.createFromBuffer(canvas, { width: size, height: size });
}

export function createTray(getWindow: () => BrowserWindow | null): Tray {
  const icon = createIcon('gray');
  tray = new Tray(icon);
  tray.setToolTip('Tomato');

  tray.on('click', () => {
    const win = getWindow();
    if (win) {
      win.isVisible() ? win.hide() : win.show();
    }
  });

  updateTrayMenu(getWindow);
  return tray;
}

function updateTrayMenu(getWindow: () => BrowserWindow | null) {
  if (!tray) return;

  const menu = Menu.buildFromTemplate([
    {
      label: '打开应用',
      click: () => {
        const win = getWindow();
        win?.show();
        win?.focus();
      },
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => app.quit(),
    },
  ]);

  tray.setContextMenu(menu);
}

export function updateTrayIcon(status: string) {
  if (!tray) return;
  const color = status === 'working' ? 'red' : status === 'breaking' || status === 'long-break' ? 'green' : 'gray';
  tray.setImage(createIcon(color));
}
```

- [ ] **Step 2: Wire tray into main index.ts**

In `main/index.ts`, import and call createTray after window creation:

```typescript
import { createTray } from './tray.js';

// After window creation:
createTray(() => mainWindow);
```

And add IPC listener for status changes to update tray icon:

```typescript
import { IPC } from '../shared/ipc-channels.js';

// Listen for status changes to update tray
ipcMain.on(IPC.TIMER_STATUS_CHANGE, (_event, status: string) => {
  updateTrayIcon(status);
});
```

- [ ] **Step 3: Verify main process compiles**

Run: `cd /Users/cbookshu/dev/temp/tomato_app/tomato_app && npx tsc -p tsconfig.main.json --noEmit`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add tomato_app/src/main/tray.ts tomato_app/src/main/index.ts
git commit -m "feat: add system tray with colored status icons and context menu"
```

---

### Task 13: Notifications + Keyboard Shortcuts

**Files:**
- Create: `tomato_app/src/main/notifications.ts`
- Create: `tomato_app/src/main/shortcuts.ts`
- Modify: `tomato_app/src/main/index.ts`

- [ ] **Step 1: Write notifications module**

File: `tomato_app/src/main/notifications.ts`

```typescript
import { Notification } from 'electron';

export function sendNotification(title: string, body: string) {
  if (!Notification.isSupported()) return;

  const notification = new Notification({
    title,
    body,
    silent: false,
  });

  notification.on('click', () => {
    notification.close();
  });

  notification.show();
}

export function notifyPomodoroComplete() {
  sendNotification('番茄时间结束', '该休息一下了！');
}

export function notifyBreakComplete() {
  sendNotification('休息时间结束', '可以继续专注了！');
}
```

- [ ] **Step 2: Write shortcuts module**

File: `tomato_app/src/main/shortcuts.ts`

```typescript
import { globalShortcut } from 'electron';

export function registerShortcuts(handlers: {
  onStartPause: () => void;
  onStop: () => void;
  onNewTask: () => void;
}) {
  globalShortcut.register('CommandOrControl+Shift+P', handlers.onStartPause);
  globalShortcut.register('CommandOrControl+Shift+S', handlers.onStop);
  globalShortcut.register('CommandOrControl+Shift+N', handlers.onNewTask);
}

export function unregisterShortcuts() {
  globalShortcut.unregisterAll();
}
```

- [ ] **Step 3: Wire notifications to timer complete events**

In `main/index.ts`, after IPC handler registration, add:

```typescript
import { ipcMain } from 'electron';
import { notifyPomodoroComplete, notifyBreakComplete } from './notifications.js';
import { registerShortcuts, unregisterShortcuts } from './shortcuts.js';

ipcMain.on(IPC.TIMER_COMPLETE, (_event, type: 'work' | 'break') => {
  if (type === 'work') notifyPomodoroComplete();
  else notifyBreakComplete();
});

registerShortcuts({
  onStartPause: () => { /* send to renderer */ },
  onStop: () => { /* send to renderer */ },
  onNewTask: () => { /* send to renderer */ },
});

app.on('will-quit', () => {
  unregisterShortcuts();
});
```

- [ ] **Step 4: Verify main process compiles**

Run: `cd /Users/cbookshu/dev/temp/tomato_app/tomato_app && npx tsc -p tsconfig.main.json --noEmit`
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add tomato_app/src/main/notifications.ts tomato_app/src/main/shortcuts.ts tomato_app/src/main/index.ts
git commit -m "feat: add desktop notifications and global keyboard shortcuts"
```

---

### Task 14: Wire Renderer Stores to IPC

**Files:**
- Modify: `tomato_app/src/renderer/App.tsx`
- Modify: `tomato_app/src/renderer/hooks/useTimer.ts`

- [ ] **Step 1: Add data loading on app mount**

File: `tomato_app/src/renderer/App.tsx`

Add useEffect to load initial data:

```typescript
import { useEffect } from 'react';
import { useIpc } from '@/hooks/useIpc.js';
import { IPC } from '@shared/ipc-channels.js';
import { useTaskStore } from '@/stores/task-store.js';
import { useStatsStore } from '@/stores/stats-store.js';
import { useSettingsStore } from '@/stores/settings-store.js';
import { getToday } from '@pomodoro/core';

// Inside App component:
const { invoke } = useIpc();
const taskStore = useTaskStore();
const statsStore = useStatsStore();
const settingsStore = useSettingsStore();

useEffect(() => {
  async function loadData() {
    taskStore.setLoading(true);
    try {
      const [tasks, groups] = await Promise.all([
        invoke(IPC.TASK_GET_ALL),
        invoke(IPC.GROUP_GET_ALL),
      ]);
      taskStore.setTasks(tasks);
      taskStore.setGroups(groups);
    } finally {
      taskStore.setLoading(false);
    }

    statsStore.setLoading(true);
    try {
      const [today, weekly] = await Promise.all([
        invoke(IPC.STATS_GET_DAILY, { date: getToday() }),
        invoke(IPC.STATS_GET_WEEKLY, { endDate: getToday() }),
      ]);
      statsStore.setToday(today);
      statsStore.setWeekly(weekly);
    } finally {
      statsStore.setLoading(false);
    }
  }
  loadData();
}, []);
```

- [ ] **Step 2: Verify build**

Run: `cd /Users/cbookshu/dev/temp/tomato_app/tomato_app && npx tsc --noEmit && npx vite build`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add tomato_app/src/renderer/App.tsx
git commit -m "feat: wire renderer stores to IPC for data loading on app mount"
```

---

### Task 15: E2E Tests with Playwright

**Files:**
- Create: `tomato_app/playwright.config.ts`
- Create: `tomato_app/tests/e2e/timer.spec.ts`
- Create: `tomato_app/tests/e2e/tasks.spec.ts`

- [ ] **Step 1: Create Playwright config**

File: `tomato_app/playwright.config.ts`

```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  retries: 1,
  use: {
    baseURL: 'http://localhost:5173',
    headless: true,
  },
  webServer: {
    command: 'npx vite',
    port: 5173,
    reuseExistingServer: true,
    cwd: '.',
  },
});
```

- [ ] **Step 2: Write timer E2E test**

File: `tomato_app/tests/e2e/timer.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Timer', () => {
  test('displays idle state on load', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=准备开始')).toBeVisible();
  });

  test('shows timer display with 00:00 initially', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=00:00')).toBeVisible();
  });

  test('has start button when idle', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('button:has-text("开始专注")')).toBeVisible();
  });

  test('bottom tab bar has all 4 tabs', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=计时')).toBeVisible();
    await expect(page.locator('text=任务')).toBeVisible();
    await expect(page.locator('text=统计')).toBeVisible();
    await expect(page.locator('text=设置')).toBeVisible();
  });

  test('clicking tasks tab shows task list', async ({ page }) => {
    await page.goto('/');
    await page.click('text=任务');
    await expect(page.locator('text=新建分组')).toBeVisible();
  });

  test('clicking stats tab shows stats cards', async ({ page }) => {
    await page.goto('/');
    await page.click('text=统计');
    await expect(page.locator('text=今日统计')).toBeVisible();
    await expect(page.locator('text=本周趋势')).toBeVisible();
  });

  test('clicking settings tab shows settings', async ({ page }) => {
    await page.goto('/');
    await page.click('text=设置');
    await expect(page.locator('text=计时设置')).toBeVisible();
    await expect(page.locator('text=通知设置')).toBeVisible();
  });
});
```

- [ ] **Step 3: Write tasks E2E test**

File: `tomato_app/tests/e2e/tasks.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Tasks', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.click('text=任务');
  });

  test('shows new group button', async ({ page }) => {
    await expect(page.locator('button:has-text("新建分组")')).toBeVisible();
  });
});
```

- [ ] **Step 4: Install Playwright browsers and run E2E tests**

Run: `cd /Users/cbookshu/dev/temp/tomato_app/tomato_app && npx playwright install chromium && npx playwright test`
Expected: all E2E tests PASS

- [ ] **Step 5: Commit**

```bash
git add tomato_app/playwright.config.ts tomato_app/tests/e2e/
git commit -m "test: add Playwright E2E tests for timer, tasks, stats, and settings tabs"
```

---

### Task 16: Packaging Configuration

**Files:**
- Create: `tomato_app/electron-builder.yml`
- Modify: `tomato_app/package.json`

- [ ] **Step 1: Write electron-builder.yml**

File: `tomato_app/electron-builder.yml`

```yaml
appId: com.pomodoro.tomato-app
productName: Tomato
copyright: Copyright 2026

directories:
  output: release
  buildResources: resources

files:
  - dist/**/*
  - resources/**/*
  - node_modules/**/*
  - package.json

mac:
  category: public.app-category.productivity
  icon: resources/icon.icns
  target:
    - dmg
    - zip
  hardenedRuntime: true
  entitlements: build/entitlements.mac.plist

dmg:
  contents:
    - x: 130
      y: 220
    - x: 410
      y: 220
      type: link
      path: /Applications

win:
  icon: resources/icon.ico
  target:
    - nsis

linux:
  icon: resources/icon.png
  target:
    - AppImage
    - deb

nsis:
  oneClick: false
  allowToChangeInstallationDirectory: true
```

- [ ] **Step 2: Update package.json build script section**

The package.json from Task 1 already has the build configuration inline. This step verifies consistency.

- [ ] **Step 3: Verify electron-builder config is valid**

Run: `cd /Users/cbookshu/dev/temp/tomato_app/tomato_app && npx electron-builder --help > /dev/null 2>&1 && echo "OK"`
Expected: OK

- [ ] **Step 4: Commit**

```bash
git add tomato_app/electron-builder.yml
git commit -m "chore: add electron-builder packaging config for macOS/Windows/Linux"
```

---

### Task 17: Full Integration Verification

Testing. No code changes — just running everything.

- [ ] **Step 1: Run store unit tests**

Run: `cd /Users/cbookshu/dev/temp/tomato_app/tomato_app && npx vitest run tests/stores/`
Expected: all tests PASS

- [ ] **Step 2: Verify renderer TypeScript**

Run: `cd /Users/cbookshu/dev/temp/tomato_app/tomato_app && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Verify main process TypeScript**

Run: `cd /Users/cbookshu/dev/temp/tomato_app/tomato_app && npx tsc -p tsconfig.main.json --noEmit`
Expected: no errors

- [ ] **Step 4: Verify renderer build**

Run: `cd /Users/cbookshu/dev/temp/tomato_app/tomato_app && npx vite build`
Expected: builds successfully

- [ ] **Step 5: Run E2E tests**

Run: `cd /Users/cbookshu/dev/temp/tomato_app/tomato_app && npx playwright test`
Expected: all E2E tests PASS

- [ ] **Step 6: Commit**

```bash
git commit -m "chore: verify full test suite, type checking, and build pass"
```
