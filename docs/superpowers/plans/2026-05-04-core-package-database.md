# Core Package + Database Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `packages/core` package with timer state machine, task management, stats computation, and SQLite persistence via Drizzle ORM — a fully testable foundation independent of any UI.

**Architecture:** Monorepo root with npm workspaces. The `core` package contains pure business logic (state machine, sorting, stats) with abstract repository interfaces, plus concrete Drizzle/SQLite repository implementations. All state transitions are immutable pure functions. The PomodoroTimer class wraps the state machine with setInterval-based countdown and event emitters.

**Tech Stack:** TypeScript 5.x (strict mode), Jest + ts-jest, Drizzle ORM, better-sqlite3, npm workspaces

---

## File Map

```
/ (root)
├── package.json                         # npm workspaces root
├── tsconfig.base.json                   # shared TS compiler options
└── packages/
    └── core/
        ├── package.json
        ├── tsconfig.json
        ├── jest.config.ts
        ├── src/
        │   ├── types/
        │   │   ├── timer.ts             # TimerStatus, TimerEvent, TimerState, PomodoroConfig
        │   │   ├── task.ts              # TaskStatus, Task, TaskGroup, NewTask, NewTaskGroup
        │   │   └── stats.ts             # DailyStats, MonthlyStats
        │   ├── utils/
        │   │   ├── id-generator.ts      # generateId() → UUID v4
        │   │   └── date-utils.ts        # getToday(), getWeekRange(), getMonthKey()
        │   ├── pomodoro/
        │   │   ├── state-machine.ts     # transition() — pure function, all 8 transitions
        │   │   └── timer.ts             # PomodoroTimer class with setInterval + event emitters
        │   ├── tasks/
        │   │   ├── sorting.ts           # addTaskAtPosition(), reorderTasks(), removeTaskFromOrder()
        │   │   └── task-manager.ts      # TaskManager class — CRUD against ITaskRepository + ITaskGroupRepository
        │   ├── stats/
        │   │   └── calculator.ts        # computeDailyStats(), computeWeeklyTrend(), computeMonthlyStats()
        │   └── db/
        │       ├── connection.ts        # getDb() — singleton better-sqlite3 connection
        │       ├── schema.ts            # Drizzle ORM table definitions (4 tables)
        │       ├── task-group-repository.ts
        │       ├── task-repository.ts
        │       ├── stats-repository.ts
        │       └── settings-repository.ts
        └── tests/
            ├── utils/
            │   ├── id-generator.test.ts
            │   └── date-utils.test.ts
            ├── pomodoro/
            │   ├── state-machine.test.ts
            │   └── timer.test.ts
            ├── tasks/
            │   ├── sorting.test.ts
            │   └── task-manager.test.ts
            ├── stats/
            │   └── calculator.test.ts
            └── db/
                ├── helpers.ts            # setupTestDb() — create in-memory SQLite with schema
                ├── task-group-repository.test.ts
                ├── task-repository.test.ts
                ├── stats-repository.test.ts
                └── settings-repository.test.ts
```

---

### Task 1: Monorepo Scaffolding

**Files:**
- Create: `package.json` (root)
- Create: `tsconfig.base.json`
- Create: `packages/core/package.json`
- Create: `packages/core/tsconfig.json`
- Create: `packages/core/jest.config.ts`

- [ ] **Step 1: Create root package.json**

```json
{
  "name": "pomodoro-app",
  "private": true,
  "workspaces": [
    "packages/*"
  ],
  "scripts": {
    "test": "npm run test --workspaces --if-present",
    "build": "npm run build --workspaces --if-present"
  }
}
```

- [ ] **Step 2: Create root tsconfig.base.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

- [ ] **Step 3: Create packages/core/package.json**

```json
{
  "name": "@pomodoro/core",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "test": "jest --coverage",
    "test:watch": "jest --watch",
    "build": "tsc"
  },
  "dependencies": {
    "better-sqlite3": "^11.7.0",
    "drizzle-orm": "^0.39.0"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.12",
    "@types/jest": "^29.5.14",
    "drizzle-kit": "^0.30.0",
    "jest": "^29.7.0",
    "ts-jest": "^29.2.5",
    "typescript": "^5.7.0"
  }
}
```

- [ ] **Step 4: Create packages/core/tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src"]
}
```

- [ ] **Step 5: Create packages/core/jest.config.ts**

```typescript
import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/index.ts',
    '!src/db/connection.ts',
  ],
  extensionsToTreatAsEsm: ['.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { useESM: true }],
  },
};

export default config;
```

- [ ] **Step 6: Install dependencies and verify**

Run: `cd /Users/cbookshu/dev/temp/tomato_app && npm install`
Expected: dependencies install without errors

Run: `cd /Users/cbookshu/dev/temp/tomato_app/packages/core && npx jest --version`
Expected: prints Jest version

- [ ] **Step 7: Commit**

```bash
git add package.json tsconfig.base.json packages/core/package.json packages/core/tsconfig.json packages/core/jest.config.ts
git commit -m "chore: scaffold monorepo with core package"
```

---

### Task 2: Shared Types

**Files:**
- Create: `packages/core/src/types/timer.ts`
- Create: `packages/core/src/types/task.ts`
- Create: `packages/core/src/types/stats.ts`

- [ ] **Step 1: Write timer types**

File: `packages/core/src/types/timer.ts`

```typescript
export type TimerStatus = 'idle' | 'working' | 'paused' | 'breaking' | 'long-break';

export type TimerEvent = 'start' | 'pause' | 'resume' | 'stop' | 'tick-complete' | 'skip';

export interface TimerState {
  readonly status: TimerStatus;
  readonly remainingTime: number;
  readonly currentCycle: number;
  readonly currentTaskId?: string;
}

export interface PomodoroConfig {
  readonly pomodoroDuration: number;
  readonly shortBreakDuration: number;
  readonly longBreakDuration: number;
  readonly longBreakInterval: number;
}

export const DEFAULT_POMODORO_CONFIG: PomodoroConfig = {
  pomodoroDuration: 25 * 60,
  shortBreakDuration: 5 * 60,
  longBreakDuration: 15 * 60,
  longBreakInterval: 4,
};
```

- [ ] **Step 2: Write task types**

File: `packages/core/src/types/task.ts`

```typescript
export type TaskStatus = 'todo' | 'in-progress' | 'completed';

export interface Task {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly completedPomodoros: number;
  readonly status: TaskStatus;
  readonly groupId?: string;
  readonly lastPomodoroTime?: string;
  readonly tags?: readonly string[];
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly completedAt?: string;
}

export interface NewTask {
  readonly title: string;
  readonly description?: string;
  readonly groupId?: string;
  readonly tags?: readonly string[];
}

export interface TaskGroup {
  readonly id: string;
  readonly name: string;
  readonly color?: string;
  readonly taskOrder: readonly string[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface NewTaskGroup {
  readonly name: string;
  readonly color?: string;
}

export const DEFAULT_GROUP_ID = 'default';
```

- [ ] **Step 3: Write stats types**

File: `packages/core/src/types/stats.ts`

```typescript
export interface DailyStats {
  readonly date: string;
  readonly totalPomodoros: number;
  readonly completedTasks: number;
  readonly tasks: readonly string[];
}

export interface MonthlyStats {
  readonly month: string;
  readonly dailyStats: readonly DailyStats[];
}
```

- [ ] **Step 4: Verify types compile**

Run: `cd /Users/cbookshu/dev/temp/tomato_app/packages/core && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/types/
git commit -m "feat: add shared type definitions for timer, task, and stats"
```

---

### Task 3: ID Generator + Date Utilities

**Files:**
- Create: `packages/core/tests/utils/id-generator.test.ts`
- Create: `packages/core/tests/utils/date-utils.test.ts`
- Create: `packages/core/src/utils/id-generator.ts`
- Create: `packages/core/src/utils/date-utils.ts`

- [ ] **Step 1: Write failing id-generator test**

File: `packages/core/tests/utils/id-generator.test.ts`

```typescript
import { generateId } from '../../src/utils/id-generator.js';

describe('generateId', () => {
  test('returns a string', () => {
    const id = generateId();
    expect(typeof id).toBe('string');
  });

  test('returns a non-empty string', () => {
    const id = generateId();
    expect(id.length).toBeGreaterThan(0);
  });

  test('returns unique values on successive calls', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateId()));
    expect(ids.size).toBe(100);
  });

  test('returns a UUID v4 format string', () => {
    const id = generateId();
    const uuidV4Pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    expect(id).toMatch(uuidV4Pattern);
  });
});
```

- [ ] **Step 2: Write failing date-utils test**

File: `packages/core/tests/utils/date-utils.test.ts`

```typescript
import { getToday, getWeekRange, getMonthKey } from '../../src/utils/date-utils.js';

describe('getToday', () => {
  test('returns today date in YYYY-MM-DD format', () => {
    const today = getToday();
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test('returns the current date', () => {
    const today = getToday();
    const expected = new Date().toISOString().slice(0, 10);
    expect(today).toBe(expected);
  });
});

describe('getWeekRange', () => {
  test('returns 7 dates ending with today', () => {
    const range = getWeekRange();
    expect(range).toHaveLength(7);
    expect(range[range.length - 1]).toBe(getToday());
  });

  test('returns dates in ascending order', () => {
    const range = getWeekRange();
    for (let i = 1; i < range.length; i++) {
      expect(range[i] > range[i - 1]).toBe(true);
    }
  });
});

describe('getMonthKey', () => {
  test('returns YYYY-MM format for a given date string', () => {
    expect(getMonthKey('2026-05-04')).toBe('2026-05');
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd /Users/cbookshu/dev/temp/tomato_app/packages/core && npx jest tests/utils/`
Expected: FAIL — "Cannot find module '../../src/utils/id-generator.js'"

- [ ] **Step 4: Write id-generator implementation**

File: `packages/core/src/utils/id-generator.ts`

```typescript
import { randomUUID } from 'node:crypto';

export function generateId(): string {
  return randomUUID();
}
```

- [ ] **Step 5: Write date-utils implementation**

File: `packages/core/src/utils/date-utils.ts`

```typescript
export function getToday(): string {
  return new Date().toISOString().slice(0, 10);
}

export function getWeekRange(): string[] {
  const today = new Date();
  const range: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    range.push(d.toISOString().slice(0, 10));
  }
  return range;
}

export function getMonthKey(dateStr: string): string {
  return dateStr.slice(0, 7);
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd /Users/cbookshu/dev/temp/tomato_app/packages/core && npx jest tests/utils/`
Expected: all 7 tests PASS

- [ ] **Step 7: Commit**

```bash
git add packages/core/tests/utils/ packages/core/src/utils/
git commit -m "feat: add id-generator and date-utils with tests"
```

---

### Task 4: Timer State Machine

**Files:**
- Create: `packages/core/tests/pomodoro/state-machine.test.ts`
- Create: `packages/core/src/pomodoro/state-machine.ts`

- [ ] **Step 1: Write failing state machine tests**

File: `packages/core/tests/pomodoro/state-machine.test.ts`

```typescript
import { transition } from '../../src/pomodoro/state-machine.js';
import { DEFAULT_POMODORO_CONFIG, TimerState } from '../../src/types/timer.js';

const config = DEFAULT_POMODORO_CONFIG;
const idle: TimerState = { status: 'idle', remainingTime: 0, currentCycle: 0 };

describe('transition', () => {
  describe('from idle', () => {
    test('start transitions to working with full pomodoro time and increments cycle', () => {
      const result = transition(idle, 'start', config);
      expect(result.status).toBe('working');
      expect(result.remainingTime).toBe(config.pomodoroDuration);
      expect(result.currentCycle).toBe(1);
    });

    test('start with taskId stores the task id', () => {
      const result = transition(idle, 'start', config, 'task-1');
      expect(result.currentTaskId).toBe('task-1');
    });

    test('pause, resume, stop, tick-complete, skip are ignored from idle', () => {
      const ignoredEvents = ['pause', 'resume', 'stop', 'tick-complete', 'skip'] as const;
      for (const event of ignoredEvents) {
        const result = transition(idle, event, config);
        expect(result).toEqual(idle);
      }
    });
  });

  describe('from working', () => {
    const working: TimerState = { status: 'working', remainingTime: 1200, currentCycle: 2, currentTaskId: 't1' };

    test('pause transitions to paused, preserving remaining time and cycle', () => {
      const result = transition(working, 'pause', config);
      expect(result.status).toBe('paused');
      expect(result.remainingTime).toBe(1200);
      expect(result.currentCycle).toBe(2);
      expect(result.currentTaskId).toBe('t1');
    });

    test('stop transitions to idle, resetting state', () => {
      const result = transition(working, 'stop', config);
      expect(result.status).toBe('idle');
      expect(result.remainingTime).toBe(0);
      expect(result.currentTaskId).toBeUndefined();
    });

    test('tick-complete with cycle < longBreakInterval transitions to breaking', () => {
      const state: TimerState = { status: 'working', remainingTime: 0, currentCycle: 2 };
      const result = transition(state, 'tick-complete', config);
      expect(result.status).toBe('breaking');
      expect(result.remainingTime).toBe(config.shortBreakDuration);
      expect(result.currentCycle).toBe(2);
    });

    test('tick-complete with cycle >= longBreakInterval transitions to long-break', () => {
      const state: TimerState = { status: 'working', remainingTime: 0, currentCycle: 4 };
      const result = transition(state, 'tick-complete', config);
      expect(result.status).toBe('long-break');
      expect(result.remainingTime).toBe(config.longBreakDuration);
    });

    test('skip transitions to breaking when cycle < longBreakInterval', () => {
      const state: TimerState = { status: 'working', remainingTime: 500, currentCycle: 1 };
      const result = transition(state, 'skip', config);
      expect(result.status).toBe('breaking');
      expect(result.remainingTime).toBe(config.shortBreakDuration);
    });

    test('skip transitions to long-break when cycle >= longBreakInterval', () => {
      const state: TimerState = { status: 'working', remainingTime: 500, currentCycle: 4 };
      const result = transition(state, 'skip', config);
      expect(result.status).toBe('long-break');
      expect(result.remainingTime).toBe(config.longBreakDuration);
    });
  });

  describe('from paused', () => {
    const paused: TimerState = { status: 'paused', remainingTime: 800, currentCycle: 3, currentTaskId: 't2' };

    test('resume transitions back to working', () => {
      const result = transition(paused, 'resume', config);
      expect(result.status).toBe('working');
      expect(result.remainingTime).toBe(800);
      expect(result.currentCycle).toBe(3);
    });

    test('stop transitions to idle', () => {
      const result = transition(paused, 'stop', config);
      expect(result.status).toBe('idle');
      expect(result.remainingTime).toBe(0);
      expect(result.currentTaskId).toBeUndefined();
    });

    test('other events are ignored', () => {
      const result = transition(paused, 'start', config);
      expect(result).toEqual(paused);
    });
  });

  describe('from breaking', () => {
    const breaking: TimerState = { status: 'breaking', remainingTime: 120, currentCycle: 3 };

    test('tick-complete transitions to idle', () => {
      const result = transition(breaking, 'tick-complete', config);
      expect(result.status).toBe('idle');
      expect(result.remainingTime).toBe(0);
    });

    test('skip transitions to idle', () => {
      const result = transition(breaking, 'skip', config);
      expect(result.status).toBe('idle');
      expect(result.remainingTime).toBe(0);
    });
  });

  describe('from long-break', () => {
    const longBreak: TimerState = { status: 'long-break', remainingTime: 600, currentCycle: 4 };

    test('tick-complete transitions to idle and resets cycle to 0', () => {
      const result = transition(longBreak, 'tick-complete', config);
      expect(result.status).toBe('idle');
      expect(result.remainingTime).toBe(0);
      expect(result.currentCycle).toBe(0);
    });

    test('skip transitions to idle and resets cycle to 0', () => {
      const result = transition(longBreak, 'skip', config);
      expect(result.status).toBe('idle');
      expect(result.remainingTime).toBe(0);
      expect(result.currentCycle).toBe(0);
    });
  });

  describe('immutability', () => {
    test('does not mutate the original state', () => {
      const original: TimerState = { status: 'working', remainingTime: 500, currentCycle: 1 };
      const copy = { ...original };
      transition(original, 'pause', config);
      expect(original).toEqual(copy);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/cbookshu/dev/temp/tomato_app/packages/core && npx jest tests/pomodoro/state-machine.test.ts`
Expected: FAIL — "Cannot find module '../../src/pomodoro/state-machine.js'"

- [ ] **Step 3: Write state machine implementation**

File: `packages/core/src/pomodoro/state-machine.ts`

```typescript
import { TimerState, TimerEvent, PomodoroConfig } from '../types/timer.js';

const IGNORED_IN_IDLE: TimerEvent[] = ['pause', 'resume', 'stop', 'tick-complete', 'skip'];
const IGNORED_IN_PAUSED: TimerEvent[] = ['start', 'pause', 'tick-complete', 'skip'];

export function transition(
  state: TimerState,
  event: TimerEvent,
  config: PomodoroConfig,
  taskId?: string,
): TimerState {
  const { status, currentCycle } = state;

  switch (status) {
    case 'idle': {
      if (event === 'start') {
        return {
          status: 'working',
          remainingTime: config.pomodoroDuration,
          currentCycle: currentCycle + 1,
          currentTaskId: taskId,
        };
      }
      if (IGNORED_IN_IDLE.includes(event)) return state;
      return state;
    }

    case 'working': {
      if (event === 'pause') {
        return { ...state, status: 'paused' };
      }
      if (event === 'stop') {
        return { status: 'idle', remainingTime: 0, currentCycle };
      }
      if (event === 'tick-complete' || event === 'skip') {
        const isLongBreak = currentCycle >= config.longBreakInterval;
        return {
          status: isLongBreak ? 'long-break' : 'breaking',
          remainingTime: isLongBreak ? config.longBreakDuration : config.shortBreakDuration,
          currentCycle,
          currentTaskId: state.currentTaskId,
        };
      }
      return state;
    }

    case 'paused': {
      if (event === 'resume') {
        return { ...state, status: 'working' };
      }
      if (event === 'stop') {
        return { status: 'idle', remainingTime: 0, currentCycle };
      }
      if (IGNORED_IN_PAUSED.includes(event)) return state;
      return state;
    }

    case 'breaking': {
      if (event === 'tick-complete' || event === 'skip') {
        return {
          status: 'idle',
          remainingTime: 0,
          currentCycle,
          currentTaskId: state.currentTaskId,
        };
      }
      return state;
    }

    case 'long-break': {
      if (event === 'tick-complete' || event === 'skip') {
        return {
          status: 'idle',
          remainingTime: 0,
          currentCycle: 0,
          currentTaskId: state.currentTaskId,
        };
      }
      return state;
    }

    default:
      return state;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/cbookshu/dev/temp/tomato_app/packages/core && npx jest tests/pomodoro/state-machine.test.ts`
Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/tests/pomodoro/state-machine.test.ts packages/core/src/pomodoro/state-machine.ts
git commit -m "feat: implement timer state machine with all 8 transitions"
```

---

### Task 5: PomodoroTimer Class

**Files:**
- Create: `packages/core/tests/pomodoro/timer.test.ts`
- Create: `packages/core/src/pomodoro/timer.ts`

- [ ] **Step 1: Write failing timer tests**

File: `packages/core/tests/pomodoro/timer.test.ts`

```typescript
import { PomodoroTimer } from '../../src/pomodoro/timer.js';
import { TimerState } from '../../src/types/timer.js';

describe('PomodoroTimer', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('initial state is idle', () => {
    const timer = new PomodoroTimer();
    const state = timer.getState();
    expect(state.status).toBe('idle');
    expect(state.remainingTime).toBe(0);
    expect(state.currentCycle).toBe(0);
  });

  test('start transitions to working and emits statusChange', () => {
    const timer = new PomodoroTimer();
    const onStatusChange = jest.fn();
    timer.on('statusChange', onStatusChange);

    timer.start();

    const state = timer.getState();
    expect(state.status).toBe('working');
    expect(state.remainingTime).toBe(25 * 60);
    expect(onStatusChange).toHaveBeenCalledWith('working');
  });

  test('tick emits every second with decrementing time', () => {
    const timer = new PomodoroTimer();
    const onTick = jest.fn();
    timer.on('tick', onTick);

    timer.start();

    jest.advanceTimersByTime(3000);
    expect(onTick).toHaveBeenCalledTimes(3);
    expect(onTick).toHaveBeenNthCalledWith(1, 25 * 60 - 1);
    expect(onTick).toHaveBeenNthCalledWith(2, 25 * 60 - 2);
    expect(onTick).toHaveBeenNthCalledWith(3, 25 * 60 - 3);
  });

  test('pause stops ticking and preserves time', () => {
    const timer = new PomodoroTimer();
    timer.start();
    jest.advanceTimersByTime(2000);

    timer.pause();

    const state = timer.getState();
    expect(state.status).toBe('paused');
    expect(state.remainingTime).toBe(25 * 60 - 2);
  });

  test('resume continues ticking from paused state', () => {
    const timer = new PomodoroTimer();
    timer.start();
    jest.advanceTimersByTime(1000);
    timer.pause();
    timer.resume();

    const onTick = jest.fn();
    timer.on('tick', onTick);

    jest.advanceTimersByTime(1000);
    expect(onTick).toHaveBeenCalled();
    expect(timer.getState().status).toBe('working');
  });

  test('stop resets to idle', () => {
    const timer = new PomodoroTimer();
    timer.start();
    jest.advanceTimersByTime(5000);

    timer.stop();

    const state = timer.getState();
    expect(state.status).toBe('idle');
    expect(state.remainingTime).toBe(0);
  });

  test('complete event fires when timer reaches 0 in working state', () => {
    const timer = new PomodoroTimer();
    const onComplete = jest.fn();
    timer.on('complete', onComplete);

    timer.start();
    jest.advanceTimersByTime(25 * 60 * 1000 + 100);

    expect(onComplete).toHaveBeenCalledWith('work');
    expect(timer.getState().status).toBe('breaking');
  });

  test('complete event fires for break end and transitions to idle', () => {
    const timer = new PomodoroTimer();
    // Fast-forward through work + break
    timer.start();
    jest.advanceTimersByTime(25 * 60 * 1000); // work complete
    expect(timer.getState().status).toBe('breaking');

    const onComplete = jest.fn();
    timer.on('complete', onComplete);

    jest.advanceTimersByTime(5 * 60 * 1000 + 100); // break complete
    expect(onComplete).toHaveBeenCalledWith('break');
    expect(timer.getState().status).toBe('idle');
  });

  test('cycle increments each work session and resets after long break', () => {
    const timer = new PomodoroTimer({ longBreakInterval: 2 });

    // Cycle 1
    timer.start();
    jest.advanceTimersByTime(25 * 60 * 1000 + 100);
    expect(timer.getState().currentCycle).toBe(1);
    jest.advanceTimersByTime(5 * 60 * 1000 + 100);

    // Cycle 2 → should go to long-break
    timer.start();
    jest.advanceTimersByTime(25 * 60 * 1000 + 100);
    expect(timer.getState().currentCycle).toBe(2);
    expect(timer.getState().status).toBe('long-break');

    // Long break complete → cycle resets
    jest.advanceTimersByTime(15 * 60 * 1000 + 100);
    expect(timer.getState().currentCycle).toBe(0);
  });

  test('skip ends current work phase immediately', () => {
    const timer = new PomodoroTimer();
    timer.start();
    jest.advanceTimersByTime(5000);

    timer.skip();

    expect(timer.getState().status).toBe('breaking');
    expect(timer.getState().remainingTime).toBe(5 * 60);
  });

  test('destroy cleans up the interval', () => {
    const timer = new PomodoroTimer();
    timer.start();
    const onTick = jest.fn();
    timer.on('tick', onTick);

    timer.destroy();
    jest.advanceTimersByTime(5000);

    expect(onTick).not.toHaveBeenCalled();
  });

  test('off removes an event listener', () => {
    const timer = new PomodoroTimer();
    const callback = jest.fn();
    timer.on('tick', callback);
    timer.off('tick', callback);

    timer.start();
    jest.advanceTimersByTime(2000);

    expect(callback).not.toHaveBeenCalled();
  });

  test('custom config overrides defaults', () => {
    const timer = new PomodoroTimer({ pomodoroDuration: 10 * 60 });
    timer.start();
    expect(timer.getState().remainingTime).toBe(10 * 60);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/cbookshu/dev/temp/tomato_app/packages/core && npx jest tests/pomodoro/timer.test.ts`
Expected: FAIL — "Cannot find module '../../src/pomodoro/timer.js'"

- [ ] **Step 3: Write PomodoroTimer implementation**

File: `packages/core/src/pomodoro/timer.ts`

```typescript
import { TimerState, TimerStatus, PomodoroConfig, DEFAULT_POMODORO_CONFIG } from '../types/timer.js';
import { transition } from './state-machine.js';

type EventName = 'tick' | 'statusChange' | 'complete';

export class PomodoroTimer {
  private state: TimerState;
  private config: PomodoroConfig;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private listeners = new Map<EventName, Set<(...args: any[]) => void>>();

  constructor(config?: Partial<PomodoroConfig>) {
    this.config = { ...DEFAULT_POMODORO_CONFIG, ...config };
    this.state = { status: 'idle', remainingTime: 0, currentCycle: 0 };
  }

  start(taskId?: string): void {
    this.setState(transition(this.state, 'start', this.config, taskId));
    this.startTimer();
  }

  pause(): void {
    this.clearTimer();
    this.setState(transition(this.state, 'pause', this.config));
  }

  resume(): void {
    this.setState(transition(this.state, 'resume', this.config));
    this.startTimer();
  }

  stop(): void {
    this.clearTimer();
    this.setState(transition(this.state, 'stop', this.config));
  }

  skip(): void {
    this.clearTimer();
    const newState = transition(this.state, 'skip', this.config);
    this.setState(newState);
    if (newState.status === 'breaking' || newState.status === 'long-break') {
      this.emit('complete', 'work');
      this.startTimer();
    }
  }

  getState(): Readonly<TimerState> {
    return this.state;
  }

  on(event: EventName, callback: (...args: any[]) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  off(event: EventName, callback: (...args: any[]) => void): void {
    this.listeners.get(event)?.delete(callback);
  }

  destroy(): void {
    this.clearTimer();
    this.listeners.clear();
  }

  private tick(): void {
    const newTime = this.state.remainingTime - 1;
    if (newTime <= 0) {
      this.clearTimer();
      const completionType: 'work' | 'break' =
        this.state.status === 'working' ? 'work' : 'break';
      const newState = transition(
        { ...this.state, remainingTime: 0 },
        'tick-complete',
        this.config,
      );
      this.setState(newState);
      this.emit('complete', completionType);
      if (newState.status === 'breaking' || newState.status === 'long-break') {
        this.startTimer();
      }
    } else {
      this.setState({ ...this.state, remainingTime: newTime });
      this.emit('tick', newTime);
    }
  }

  private startTimer(): void {
    this.clearTimer();
    this.intervalId = setInterval(() => this.tick(), 1000);
  }

  private clearTimer(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private setState(newState: TimerState): void {
    const oldStatus = this.state.status;
    this.state = newState;
    if (newState.status !== oldStatus) {
      this.emit('statusChange', newState.status);
    }
  }

  private emit(event: EventName, ...args: any[]): void {
    this.listeners.get(event)?.forEach((cb) => cb(...args));
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/cbookshu/dev/temp/tomato_app/packages/core && npx jest tests/pomodoro/timer.test.ts`
Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/tests/pomodoro/timer.test.ts packages/core/src/pomodoro/timer.ts
git commit -m "feat: implement PomodoroTimer class with event emitters"
```

---

### Task 6: Task Sorting Algorithms

**Files:**
- Create: `packages/core/tests/tasks/sorting.test.ts`
- Create: `packages/core/src/tasks/sorting.ts`

- [ ] **Step 1: Write failing sorting tests**

File: `packages/core/tests/tasks/sorting.test.ts`

```typescript
import { addTaskAtPosition, reorderTasks, removeTaskFromOrder } from '../../src/tasks/sorting.js';
import { TaskGroup } from '../../src/types/task.js';

function makeGroup(taskOrder: string[]): TaskGroup {
  return {
    id: 'g1',
    name: 'Test Group',
    taskOrder,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  };
}

describe('addTaskAtPosition', () => {
  test('adds to end when no reference task', () => {
    const group = makeGroup(['t1', 't2']);
    const result = addTaskAtPosition(group, 't3');
    expect(result.taskOrder).toEqual(['t1', 't2', 't3']);
  });

  test('inserts after a specific reference task', () => {
    const group = makeGroup(['t1', 't2', 't4']);
    const result = addTaskAtPosition(group, 't3', 't2', true);
    expect(result.taskOrder).toEqual(['t1', 't2', 't3', 't4']);
  });

  test('inserts before a specific reference task', () => {
    const group = makeGroup(['t1', 't3', 't4']);
    const result = addTaskAtPosition(group, 't2', 't3', false);
    expect(result.taskOrder).toEqual(['t1', 't2', 't3', 't4']);
  });

  test('adds to end when reference task not found', () => {
    const group = makeGroup(['t1', 't2']);
    const result = addTaskAtPosition(group, 't3', 't99', true);
    expect(result.taskOrder).toEqual(['t1', 't2', 't3']);
  });

  test('does not mutate original group', () => {
    const group = makeGroup(['t1', 't2']);
    addTaskAtPosition(group, 't3');
    expect(group.taskOrder).toEqual(['t1', 't2']);
  });
});

describe('reorderTasks', () => {
  test('moves task to new index', () => {
    const group = makeGroup(['t1', 't2', 't3', 't4']);
    const result = reorderTasks(group, 't4', 0);
    expect(result.taskOrder).toEqual(['t4', 't1', 't2', 't3']);
  });

  test('moves task from start to end', () => {
    const group = makeGroup(['t1', 't2', 't3']);
    const result = reorderTasks(group, 't1', 2);
    expect(result.taskOrder).toEqual(['t2', 't3', 't1']);
  });

  test('returns unchanged order if task not found', () => {
    const group = makeGroup(['t1', 't2']);
    const result = reorderTasks(group, 't99', 0);
    expect(result.taskOrder).toEqual(['t1', 't2']);
  });

  test('does not mutate original', () => {
    const group = makeGroup(['t1', 't2', 't3']);
    reorderTasks(group, 't1', 2);
    expect(group.taskOrder).toEqual(['t1', 't2', 't3']);
  });
});

describe('removeTaskFromOrder', () => {
  test('removes task id from the order array', () => {
    const group = makeGroup(['t1', 't2', 't3']);
    const result = removeTaskFromOrder(group, 't2');
    expect(result.taskOrder).toEqual(['t1', 't3']);
  });

  test('returns unchanged order if task not found', () => {
    const group = makeGroup(['t1', 't2']);
    const result = removeTaskFromOrder(group, 't99');
    expect(result.taskOrder).toEqual(['t1', 't2']);
  });

  test('does not mutate original', () => {
    const group = makeGroup(['t1', 't2']);
    removeTaskFromOrder(group, 't1');
    expect(group.taskOrder).toEqual(['t1', 't2']);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/cbookshu/dev/temp/tomato_app/packages/core && npx jest tests/tasks/sorting.test.ts`
Expected: FAIL — "Cannot find module '../../src/tasks/sorting.js'"

- [ ] **Step 3: Write sorting implementation**

File: `packages/core/src/tasks/sorting.ts`

```typescript
import { TaskGroup } from '../types/task.js';

export function addTaskAtPosition(
  group: TaskGroup,
  taskId: string,
  referenceTaskId?: string,
  insertAfter: boolean = true,
): TaskGroup {
  const newOrder = [...group.taskOrder];

  if (!referenceTaskId) {
    newOrder.push(taskId);
  } else {
    const refIndex = newOrder.indexOf(referenceTaskId);
    if (refIndex === -1) {
      newOrder.push(taskId);
    } else {
      const insertIndex = insertAfter ? refIndex + 1 : refIndex;
      newOrder.splice(insertIndex, 0, taskId);
    }
  }

  return { ...group, taskOrder: newOrder, updatedAt: new Date().toISOString() };
}

export function reorderTasks(
  group: TaskGroup,
  taskId: string,
  newIndex: number,
): TaskGroup {
  const newOrder = [...group.taskOrder];
  const oldIndex = newOrder.indexOf(taskId);

  if (oldIndex !== -1) {
    newOrder.splice(oldIndex, 1);
    newOrder.splice(newIndex, 0, taskId);
  }

  return { ...group, taskOrder: newOrder, updatedAt: new Date().toISOString() };
}

export function removeTaskFromOrder(group: TaskGroup, taskId: string): TaskGroup {
  const newOrder = group.taskOrder.filter((id) => id !== taskId);
  if (newOrder.length === group.taskOrder.length) return group;
  return { ...group, taskOrder: newOrder, updatedAt: new Date().toISOString() };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/cbookshu/dev/temp/tomato_app/packages/core && npx jest tests/tasks/sorting.test.ts`
Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/tests/tasks/sorting.test.ts packages/core/src/tasks/sorting.ts
git commit -m "feat: implement task sorting algorithms (add, reorder, remove)"
```

---

### Task 7: Task Manager

**Files:**
- Create: `packages/core/tests/tasks/task-manager.test.ts`
- Create: `packages/core/src/tasks/task-manager.ts`

- [ ] **Step 1: Write failing task manager tests**

File: `packages/core/tests/tasks/task-manager.test.ts`

```typescript
import { TaskManager } from '../../src/tasks/task-manager.js';
import { Task, TaskGroup, ITaskRepository, ITaskGroupRepository } from '../../src/tasks/task-manager.js';
import { NewTask, NewTaskGroup, TaskStatus } from '../../src/types/task.js';
import { generateId } from '../../src/utils/id-generator.js';

class InMemoryTaskRepo implements ITaskRepository {
  private tasks = new Map<string, Task>();

  async findAll(): Promise<Task[]> { return [...this.tasks.values()]; }
  async findById(id: string): Promise<Task | null> { return this.tasks.get(id) ?? null; }
  async findByGroup(groupId: string): Promise<Task[]> {
    return [...this.tasks.values()].filter((t) => t.groupId === groupId);
  }
  async create(task: Task): Promise<Task> { this.tasks.set(task.id, task); return task; }
  async update(id: string, updates: Partial<Task>): Promise<Task> {
    const existing = this.tasks.get(id);
    if (!existing) throw new Error(`Task ${id} not found`);
    const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };
    this.tasks.set(id, updated);
    return updated;
  }
  async delete(id: string): Promise<void> { this.tasks.delete(id); }
}

class InMemoryGroupRepo implements ITaskGroupRepository {
  private groups = new Map<string, TaskGroup>();

  async findAll(): Promise<TaskGroup[]> { return [...this.groups.values()]; }
  async findById(id: string): Promise<TaskGroup | null> { return this.groups.get(id) ?? null; }
  async create(group: TaskGroup): Promise<TaskGroup> { this.groups.set(group.id, group); return group; }
  async update(id: string, updates: Partial<TaskGroup>): Promise<TaskGroup> {
    const existing = this.groups.get(id);
    if (!existing) throw new Error(`Group ${id} not found`);
    const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };
    this.groups.set(id, updated);
    return updated;
  }
  async delete(id: string): Promise<void> { this.groups.delete(id); }
}

describe('TaskManager', () => {
  let taskRepo: InMemoryTaskRepo;
  let groupRepo: InMemoryGroupRepo;
  let manager: TaskManager;

  beforeEach(async () => {
    taskRepo = new InMemoryTaskRepo();
    groupRepo = new InMemoryGroupRepo();
    manager = new TaskManager(taskRepo, groupRepo);
    await manager.initialize();
  });

  test('initialize creates a default group', async () => {
    const groups = await manager.getAllGroups();
    expect(groups).toHaveLength(1);
    expect(groups[0].id).toBe('default');
    expect(groups[0].name).toBe('未分组');
  });

  test('createTask adds task to default group when no groupId specified', async () => {
    const task = await manager.createTask({ title: 'Test task' });
    expect(task.title).toBe('Test task');
    expect(task.status).toBe('todo');
    expect(task.completedPomodoros).toBe(0);
    expect(task.groupId).toBe('default');

    const group = await manager.getGroup('default');
    expect(group!.taskOrder).toContain(task.id);
  });

  test('createTask adds task to end of specified group', async () => {
    const group = await manager.createGroup({ name: 'Work' });
    const task1 = await manager.createTask({ title: 'Task 1', groupId: group.id });
    const task2 = await manager.createTask({ title: 'Task 2', groupId: group.id });

    const updated = await manager.getGroup(group.id);
    expect(updated!.taskOrder).toEqual([task1.id, task2.id]);
  });

  test('createTask at specific position', async () => {
    const group = await manager.createGroup({ name: 'Work' });
    const t1 = await manager.createTask({ title: 'First', groupId: group.id });
    const t2 = await manager.createTask({
      title: 'Second (inserted before first)',
      groupId: group.id,
    }, t1.id, false);

    const updated = await manager.getGroup(group.id);
    expect(updated!.taskOrder[0]).toBe(t2.id);
    expect(updated!.taskOrder[1]).toBe(t1.id);
  });

  test('editTask updates title and description', async () => {
    const task = await manager.createTask({ title: 'Original' });
    const updated = await manager.editTask(task.id, { title: 'Updated', description: 'Desc' });

    expect(updated.title).toBe('Updated');
    expect(updated.description).toBe('Desc');
    expect(updated.id).toBe(task.id);
  });

  test('completeTask marks task as completed', async () => {
    const task = await manager.createTask({ title: 'Finish me' });
    const completed = await manager.completeTask(task.id);

    expect(completed.status).toBe('completed');
    expect(completed.completedAt).toBeDefined();
  });

  test('deleteTask removes from group taskOrder', async () => {
    const group = await manager.createGroup({ name: 'Work' });
    const task = await manager.createTask({ title: 'Delete me', groupId: group.id });

    await manager.deleteTask(task.id);

    const updated = await manager.getGroup(group.id);
    expect(updated!.taskOrder).not.toContain(task.id);
    expect(await manager.getTask(task.id)).toBeNull();
  });

  test('moveTaskToGroup updates both groups taskOrder', async () => {
    const g1 = await manager.createGroup({ name: 'Group 1' });
    const g2 = await manager.createGroup({ name: 'Group 2' });
    const task = await manager.createTask({ title: 'Movable', groupId: g1.id });

    await manager.moveTaskToGroup(task.id, g2.id);

    const oldGroup = await manager.getGroup(g1.id);
    const newGroup = await manager.getGroup(g2.id);
    expect(oldGroup!.taskOrder).not.toContain(task.id);
    expect(newGroup!.taskOrder).toContain(task.id);

    const moved = await manager.getTask(task.id);
    expect(moved!.groupId).toBe(g2.id);
  });

  test('reorderTask moves task within the same group', async () => {
    const group = await manager.createGroup({ name: 'Work' });
    const t1 = await manager.createTask({ title: 'A', groupId: group.id });
    const t2 = await manager.createTask({ title: 'B', groupId: group.id });
    const t3 = await manager.createTask({ title: 'C', groupId: group.id });

    await manager.reorderTask(t3.id, 0);

    const updated = await manager.getGroup(group.id);
    expect(updated!.taskOrder).toEqual([t3.id, t1.id, t2.id]);
  });

  test('deleteGroup removes group and all its tasks', async () => {
    const group = await manager.createGroup({ name: 'Temp' });
    await manager.createTask({ title: 'T1', groupId: group.id });
    await manager.createTask({ title: 'T2', groupId: group.id });

    await manager.deleteGroup(group.id);

    expect(await manager.getGroup(group.id)).toBeNull();
    const allTasks = await manager.getAllTasks();
    expect(allTasks.filter((t) => t.groupId === group.id)).toHaveLength(0);
  });

  test('incrementPomodoro adds 1 to task completedPomodoros', async () => {
    const task = await manager.createTask({ title: 'Code review' });
    const updated = await manager.incrementPomodoro(task.id, '2026-05-04');

    expect(updated.completedPomodoros).toBe(1);
    expect(updated.lastPomodoroTime).toBe('2026-05-04');
  });

  test('getTasksByStatus filters correctly', async () => {
    const t1 = await manager.createTask({ title: 'Todo' });
    const t2 = await manager.createTask({ title: 'Done' });
    await manager.completeTask(t2.id);

    const todos = await manager.getTasksByStatus('todo');
    expect(todos).toHaveLength(1);
    expect(todos[0].id).toBe(t1.id);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/cbookshu/dev/temp/tomato_app/packages/core && npx jest tests/tasks/task-manager.test.ts`
Expected: FAIL — "Cannot find module '../../src/tasks/task-manager.js'"

- [ ] **Step 3: Write task manager implementation**

File: `packages/core/src/tasks/task-manager.ts`

```typescript
import { Task, TaskGroup, NewTask, NewTaskGroup, TaskStatus, DEFAULT_GROUP_ID } from '../types/task.js';
import { generateId } from '../utils/id-generator.js';
import { addTaskAtPosition, reorderTasks, removeTaskFromOrder } from './sorting.js';

export interface ITaskRepository {
  findAll(): Promise<Task[]>;
  findById(id: string): Promise<Task | null>;
  findByGroup(groupId: string): Promise<Task[]>;
  create(task: Task): Promise<Task>;
  update(id: string, updates: Partial<Task>): Promise<Task>;
  delete(id: string): Promise<void>;
}

export interface ITaskGroupRepository {
  findAll(): Promise<TaskGroup[]>;
  findById(id: string): Promise<TaskGroup | null>;
  create(group: TaskGroup): Promise<TaskGroup>;
  update(id: string, updates: Partial<TaskGroup>): Promise<TaskGroup>;
  delete(id: string): Promise<void>;
}

function makeTask(input: NewTask, groupId: string): Task {
  const now = new Date().toISOString();
  return {
    id: generateId(),
    title: input.title,
    description: input.description,
    completedPomodoros: 0,
    status: 'todo',
    groupId: input.groupId ?? groupId,
    tags: input.tags,
    createdAt: now,
    updatedAt: now,
  };
}

function makeGroup(input: NewTaskGroup): TaskGroup {
  const now = new Date().toISOString();
  return {
    id: generateId(),
    name: input.name,
    color: input.color,
    taskOrder: [],
    createdAt: now,
    updatedAt: now,
  };
}

export class TaskManager {
  constructor(
    private taskRepo: ITaskRepository,
    private groupRepo: ITaskGroupRepository,
  ) {}

  async initialize(): Promise<void> {
    const existing = await this.groupRepo.findById(DEFAULT_GROUP_ID);
    if (!existing) {
      await this.groupRepo.create(makeGroup({ name: '未分组' }));
    }
  }

  async createTask(
    input: NewTask,
    referenceTaskId?: string,
    insertAfter?: boolean,
  ): Promise<Task> {
    const groupId = input.groupId ?? DEFAULT_GROUP_ID;
    const task = await this.taskRepo.create(makeTask(input, groupId));

    const group = await this.groupRepo.findById(groupId);
    if (group) {
      const updated = addTaskAtPosition(group, task.id, referenceTaskId, insertAfter ?? true);
      await this.groupRepo.update(groupId, { taskOrder: updated.taskOrder, updatedAt: updated.updatedAt });
    }

    return task;
  }

  async getTask(id: string): Promise<Task | null> {
    return this.taskRepo.findById(id);
  }

  async getAllTasks(): Promise<Task[]> {
    return this.taskRepo.findAll();
  }

  async getTasksByGroup(groupId: string): Promise<Task[]> {
    return this.taskRepo.findByGroup(groupId);
  }

  async getTasksByStatus(status: TaskStatus): Promise<Task[]> {
    const all = await this.taskRepo.findAll();
    return all.filter((t) => t.status === status);
  }

  async editTask(id: string, updates: Partial<Pick<Task, 'title' | 'description' | 'tags'>>): Promise<Task> {
    return this.taskRepo.update(id, updates);
  }

  async completeTask(id: string): Promise<Task> {
    return this.taskRepo.update(id, {
      status: 'completed',
      completedAt: new Date().toISOString(),
    });
  }

  async incrementPomodoro(id: string, dateStr?: string): Promise<Task> {
    const task = await this.taskRepo.findById(id);
    if (!task) throw new Error(`Task ${id} not found`);
    return this.taskRepo.update(id, {
      completedPomodoros: task.completedPomodoros + 1,
      lastPomodoroTime: dateStr ?? new Date().toISOString().slice(0, 10),
      status: task.status === 'todo' ? 'in-progress' : task.status,
    });
  }

  async deleteTask(id: string): Promise<void> {
    const task = await this.taskRepo.findById(id);
    if (!task) return;

    if (task.groupId) {
      const group = await this.groupRepo.findById(task.groupId);
      if (group) {
        const updated = removeTaskFromOrder(group, id);
        await this.groupRepo.update(task.groupId, { taskOrder: updated.taskOrder, updatedAt: updated.updatedAt });
      }
    }

    await this.taskRepo.delete(id);
  }

  async moveTaskToGroup(taskId: string, newGroupId: string): Promise<Task> {
    const task = await this.taskRepo.findById(taskId);
    if (!task) throw new Error(`Task ${taskId} not found`);

    if (task.groupId) {
      const oldGroup = await this.groupRepo.findById(task.groupId);
      if (oldGroup) {
        const updated = removeTaskFromOrder(oldGroup, taskId);
        await this.groupRepo.update(task.groupId, { taskOrder: updated.taskOrder, updatedAt: updated.updatedAt });
      }
    }

    const newGroup = await this.groupRepo.findById(newGroupId);
    if (newGroup) {
      const updated = addTaskAtPosition(newGroup, taskId);
      await this.groupRepo.update(newGroupId, { taskOrder: updated.taskOrder, updatedAt: updated.updatedAt });
    }

    return this.taskRepo.update(taskId, { groupId: newGroupId });
  }

  async reorderTask(taskId: string, newIndex: number): Promise<void> {
    const task = await this.taskRepo.findById(taskId);
    if (!task?.groupId) return;

    const group = await this.groupRepo.findById(task.groupId);
    if (!group) return;

    const updated = reorderTasks(group, taskId, newIndex);
    await this.groupRepo.update(group.id, { taskOrder: updated.taskOrder, updatedAt: updated.updatedAt });
  }

  async createGroup(input: NewTaskGroup): Promise<TaskGroup> {
    return this.groupRepo.create(makeGroup(input));
  }

  async getGroup(id: string): Promise<TaskGroup | null> {
    return this.groupRepo.findById(id);
  }

  async getAllGroups(): Promise<TaskGroup[]> {
    return this.groupRepo.findAll();
  }

  async renameGroup(id: string, name: string): Promise<TaskGroup> {
    return this.groupRepo.update(id, { name });
  }

  async deleteGroup(id: string): Promise<void> {
    const tasks = await this.taskRepo.findByGroup(id);
    for (const task of tasks) {
      await this.taskRepo.delete(task.id);
    }
    await this.groupRepo.delete(id);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/cbookshu/dev/temp/tomato_app/packages/core && npx jest tests/tasks/task-manager.test.ts`
Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/tests/tasks/task-manager.test.ts packages/core/src/tasks/task-manager.ts
git commit -m "feat: implement TaskManager with CRUD, groups, sorting, and pomodoro tracking"
```

---

### Task 8: Stats Calculator

**Files:**
- Create: `packages/core/tests/stats/calculator.test.ts`
- Create: `packages/core/src/stats/calculator.ts`

- [ ] **Step 1: Write failing stats calculator tests**

File: `packages/core/tests/stats/calculator.test.ts`

```typescript
import { computeDailyStats, computeWeeklyTrend, computeMonthlyStats } from '../../src/stats/calculator.js';
import { DailyStats } from '../../src/types/stats.js';

const sampleData: DailyStats[] = [
  { date: '2026-04-28', totalPomodoros: 4, completedTasks: 2, tasks: ['t1', 't2'] },
  { date: '2026-04-29', totalPomodoros: 6, completedTasks: 3, tasks: ['t3', 't4'] },
  { date: '2026-04-30', totalPomodoros: 0, completedTasks: 0, tasks: [] },
  { date: '2026-05-01', totalPomodoros: 8, completedTasks: 4, tasks: ['t5'] },
  { date: '2026-05-02', totalPomodoros: 3, completedTasks: 1, tasks: ['t6'] },
  { date: '2026-05-03', totalPomodoros: 5, completedTasks: 2, tasks: ['t7', 't8'] },
  { date: '2026-05-04', totalPomodoros: 7, completedTasks: 3, tasks: ['t9'] },
];

describe('computeDailyStats', () => {
  test('returns stats for a specific date', () => {
    const result = computeDailyStats(sampleData, '2026-05-01');
    expect(result).toEqual({ date: '2026-05-01', totalPomodoros: 8, completedTasks: 4, tasks: ['t5'] });
  });

  test('returns empty stats for a missing date', () => {
    const result = computeDailyStats(sampleData, '2026-05-10');
    expect(result).toEqual({ date: '2026-05-10', totalPomodoros: 0, completedTasks: 0, tasks: [] });
  });

  test('returns focus time in minutes', () => {
    const result = computeDailyStats(sampleData, '2026-05-01');
    expect(result.totalPomodoros).toBe(8);
  });
});

describe('computeWeeklyTrend', () => {
  test('returns last 7 days of stats in order', () => {
    const result = computeWeeklyTrend(sampleData, '2026-05-04');
    expect(result).toHaveLength(7);
    expect(result[0].date).toBe('2026-04-28');
    expect(result[6].date).toBe('2026-05-04');
  });

  test('fills missing dates with zero stats', () => {
    const sparse: DailyStats[] = [
      { date: '2026-05-01', totalPomodoros: 5, completedTasks: 2, tasks: ['t1'] },
      { date: '2026-05-04', totalPomodoros: 3, completedTasks: 1, tasks: ['t2'] },
    ];
    const result = computeWeeklyTrend(sparse, '2026-05-04');
    expect(result).toHaveLength(7);
    expect(result[2].date).toBe('2026-04-30');
    expect(result[2].totalPomodoros).toBe(0);
  });

  test('computes total pomodoros for the week', () => {
    const result = computeWeeklyTrend(sampleData, '2026-05-04');
    const total = result.reduce((sum, d) => sum + d.totalPomodoros, 0);
    expect(total).toBe(33);
  });

  test('returns zero-filled stats for dates with no data', () => {
    const sparse: DailyStats[] = [
      { date: '2026-05-01', totalPomodoros: 5, completedTasks: 2, tasks: ['t1'] },
    ];
    const result = computeWeeklyTrend(sparse, '2026-05-04');
    const missingDay = result.find((d) => d.date === '2026-05-03');
    expect(missingDay).toEqual({ date: '2026-05-03', totalPomodoros: 0, completedTasks: 0, tasks: [] });
  });
});

describe('computeMonthlyStats', () => {
  test('groups stats by month', () => {
    const result = computeMonthlyStats(sampleData);
    expect(result).toHaveLength(1); // all in 2026-04 or 2026-05
    // Should have both months
    const months = result.map((m) => m.month);
    expect(months).toContain('2026-04');
    expect(months).toContain('2026-05');
  });

  test('each month has correct daily stats', () => {
    const result = computeMonthlyStats(sampleData);
    const april = result.find((m) => m.month === '2026-04')!;
    const may = result.find((m) => m.month === '2026-05')!;

    expect(april.dailyStats).toHaveLength(3);
    expect(may.dailyStats).toHaveLength(4);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/cbookshu/dev/temp/tomato_app/packages/core && npx jest tests/stats/calculator.test.ts`
Expected: FAIL — "Cannot find module '../../src/stats/calculator.js'"

- [ ] **Step 3: Write stats calculator implementation**

File: `packages/core/src/stats/calculator.ts`

```typescript
import { DailyStats, MonthlyStats } from '../types/stats.js';
import { getWeekRange, getMonthKey } from '../utils/date-utils.js';

export function computeDailyStats(allStats: readonly DailyStats[], date: string): DailyStats {
  const found = allStats.find((s) => s.date === date);
  return found ?? { date, totalPomodoros: 0, completedTasks: 0, tasks: [] };
}

export function computeWeeklyTrend(
  allStats: readonly DailyStats[],
  endDate: string,
): DailyStats[] {
  const end = new Date(endDate);
  const range: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(end);
    d.setDate(d.getDate() - i);
    range.push(d.toISOString().slice(0, 10));
  }

  return range.map((date) => computeDailyStats(allStats, date));
}

export function computeMonthlyStats(allStats: readonly DailyStats[]): MonthlyStats[] {
  const grouped = new Map<string, DailyStats[]>();

  for (const stat of allStats) {
    const monthKey = getMonthKey(stat.date);
    if (!grouped.has(monthKey)) {
      grouped.set(monthKey, []);
    }
    grouped.get(monthKey)!.push(stat);
  }

  return [...grouped.entries()]
    .map(([month, dailyStats]) => ({
      month,
      dailyStats: dailyStats.sort((a, b) => a.date.localeCompare(b.date)),
    }))
    .sort((a, b) => a.month.localeCompare(b.month));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/cbookshu/dev/temp/tomato_app/packages/core && npx jest tests/stats/calculator.test.ts`
Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/tests/stats/calculator.test.ts packages/core/src/stats/calculator.ts
git commit -m "feat: implement stats calculator (daily, weekly, monthly)"
```

---

### Task 9: Database Schema + Connection

**Files:**
- Create: `packages/core/src/db/connection.ts`
- Create: `packages/core/src/db/schema.ts`

- [ ] **Step 1: Write database connection module**

File: `packages/core/src/db/connection.ts`

```typescript
import Database from 'better-sqlite3';
import { drizzle, BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';

let db: BetterSQLite3Database | null = null;

export function getDb(dbPath?: string): BetterSQLite3Database {
  if (!db) {
    const sqlite = new Database(dbPath ?? ':memory:');
    sqlite.pragma('journal_mode = WAL');
    sqlite.pragma('foreign_keys = ON');
    db = drizzle(sqlite);
  }
  return db;
}

export function closeDb(): void {
  db = null;
}

export function createTestDb(): BetterSQLite3Database {
  const sqlite = new Database(':memory:');
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  return drizzle(sqlite);
}
```

- [ ] **Step 2: Write Drizzle schema definitions**

File: `packages/core/src/db/schema.ts`

```typescript
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const taskGroups = sqliteTable('task_groups', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  color: text('color'),
  taskOrder: text('task_order').notNull().default('[]'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const tasks = sqliteTable('tasks', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description'),
  completedPomodoros: integer('completed_pomodoros').notNull().default(0),
  status: text('status').notNull().default('todo'),
  groupId: text('group_id').references(() => taskGroups.id),
  lastPomodoroTime: text('last_pomodoro_time'),
  tags: text('tags').default('[]'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  completedAt: text('completed_at'),
});

export const dailyStats = sqliteTable('daily_stats', {
  date: text('date').primaryKey(),
  totalPomodoros: integer('total_pomodoros').notNull().default(0),
  completedTasks: integer('completed_tasks').notNull().default(0),
  tasks: text('tasks').notNull().default('[]'),
});

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});
```

- [ ] **Step 3: Write test database helper**

File: `packages/core/tests/db/helpers.ts`

```typescript
import Database from 'better-sqlite3';
import { drizzle, BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';

export function setupTestDb(): BetterSQLite3Database {
  const sqlite = new Database(':memory:');
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');

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

  return drizzle(sqlite);
}
```

- [ ] **Step 4: Verify schema compiles**

Run: `cd /Users/cbookshu/dev/temp/tomato_app/packages/core && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/db/connection.ts packages/core/src/db/schema.ts packages/core/tests/db/helpers.ts
git commit -m "feat: define Drizzle ORM schema and SQLite connection helpers"
```

---

### Task 10: Task Group Repository

**Files:**
- Create: `packages/core/tests/db/task-group-repository.test.ts`
- Create: `packages/core/src/db/task-group-repository.ts`

- [ ] **Step 1: Write failing task group repository tests**

File: `packages/core/tests/db/task-group-repository.test.ts`

```typescript
import { TaskGroupRepository } from '../../src/db/task-group-repository.js';
import { setupTestDb } from './helpers.js';
import { generateId } from '../../src/utils/id-generator.js';
import { TaskGroup } from '../../src/types/task.js';

function makeGroup(overrides?: Partial<TaskGroup>): TaskGroup {
  const now = new Date().toISOString();
  return {
    id: generateId(),
    name: 'Test Group',
    taskOrder: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('TaskGroupRepository', () => {
  let db: ReturnType<typeof setupTestDb>;
  let repo: TaskGroupRepository;

  beforeEach(() => {
    db = setupTestDb();
    repo = new TaskGroupRepository(db);
  });

  test('create inserts a new group', async () => {
    const group = makeGroup();
    const created = await repo.create(group);
    expect(created.id).toBe(group.id);
    expect(created.name).toBe(group.name);
  });

  test('findById returns a group by id', async () => {
    const group = makeGroup();
    await repo.create(group);
    const found = await repo.findById(group.id);
    expect(found).not.toBeNull();
    expect(found!.name).toBe(group.name);
  });

  test('findById returns null for missing group', async () => {
    const found = await repo.findById('nonexistent');
    expect(found).toBeNull();
  });

  test('findAll returns all groups', async () => {
    await repo.create(makeGroup({ name: 'Group 1' }));
    await repo.create(makeGroup({ name: 'Group 2' }));
    const all = await repo.findAll();
    expect(all).toHaveLength(2);
  });

  test('update modifies group fields', async () => {
    const group = makeGroup();
    await repo.create(group);
    const updated = await repo.update(group.id, { name: 'Renamed', color: '#FF0000' });
    expect(updated.name).toBe('Renamed');
    expect(updated.color).toBe('#FF0000');
  });

  test('update throws for missing group', async () => {
    await expect(repo.update('nonexistent', { name: 'X' })).rejects.toThrow();
  });

  test('delete removes a group', async () => {
    const group = makeGroup();
    await repo.create(group);
    await repo.delete(group.id);
    const found = await repo.findById(group.id);
    expect(found).toBeNull();
  });

  test('taskOrder is persisted as JSON array', async () => {
    const group = makeGroup({ taskOrder: ['t1', 't2', 't3'] });
    await repo.create(group);
    const found = await repo.findById(group.id);
    expect(found!.taskOrder).toEqual(['t1', 't2', 't3']);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/cbookshu/dev/temp/tomato_app/packages/core && npx jest tests/db/task-group-repository.test.ts`
Expected: FAIL — "Cannot find module '../../src/db/task-group-repository.js'"

- [ ] **Step 3: Write task group repository implementation**

File: `packages/core/src/db/task-group-repository.ts`

```typescript
import { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { eq } from 'drizzle-orm';
import { taskGroups } from './schema.js';
import { TaskGroup } from '../types/task.js';

function rowToGroup(row: typeof taskGroups.$inferSelect): TaskGroup {
  return {
    id: row.id,
    name: row.name,
    color: row.color ?? undefined,
    taskOrder: JSON.parse(row.taskOrder),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class TaskGroupRepository {
  constructor(private db: BetterSQLite3Database) {}

  async findAll(): Promise<TaskGroup[]> {
    const rows = await this.db.select().from(taskGroups).all();
    return rows.map(rowToGroup);
  }

  async findById(id: string): Promise<TaskGroup | null> {
    const rows = await this.db
      .select()
      .from(taskGroups)
      .where(eq(taskGroups.id, id))
      .all();
    return rows.length > 0 ? rowToGroup(rows[0]) : null;
  }

  async create(group: TaskGroup): Promise<TaskGroup> {
    await this.db.insert(taskGroups).values({
      id: group.id,
      name: group.name,
      color: group.color ?? null,
      taskOrder: JSON.stringify(group.taskOrder),
      createdAt: group.createdAt,
      updatedAt: group.updatedAt,
    });
    return group;
  }

  async update(id: string, updates: Partial<TaskGroup>): Promise<TaskGroup> {
    const existing = await this.findById(id);
    if (!existing) throw new Error(`TaskGroup ${id} not found`);

    const values: Record<string, unknown> = {};
    if (updates.name !== undefined) values.name = updates.name;
    if (updates.color !== undefined) values.color = updates.color;
    if (updates.taskOrder !== undefined) values.taskOrder = JSON.stringify(updates.taskOrder);
    values.updatedAt = new Date().toISOString();

    await this.db.update(taskGroups).set(values).where(eq(taskGroups.id, id));

    return (await this.findById(id))!;
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(taskGroups).where(eq(taskGroups.id, id));
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/cbookshu/dev/temp/tomato_app/packages/core && npx jest tests/db/task-group-repository.test.ts`
Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/tests/db/task-group-repository.test.ts packages/core/src/db/task-group-repository.ts
git commit -m "feat: implement TaskGroupRepository with Drizzle/SQLite"
```

---

### Task 11: Task Repository

**Files:**
- Create: `packages/core/tests/db/task-repository.test.ts`
- Create: `packages/core/src/db/task-repository.ts`

- [ ] **Step 1: Write failing task repository tests**

File: `packages/core/tests/db/task-repository.test.ts`

```typescript
import { TaskRepository } from '../../src/db/task-repository.js';
import { setupTestDb } from './helpers.js';
import { generateId } from '../../src/utils/id-generator.js';
import { Task, TaskStatus } from '../../src/types/task.js';

function makeTask(overrides?: Partial<Task>): Task {
  const now = new Date().toISOString();
  return {
    id: generateId(),
    title: 'Test Task',
    completedPomodoros: 0,
    status: 'todo',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('TaskRepository', () => {
  let db: ReturnType<typeof setupTestDb>;
  let repo: TaskRepository;

  beforeEach(() => {
    db = setupTestDb();
    repo = new TaskRepository(db);
  });

  test('create inserts a new task', async () => {
    const task = makeTask();
    const created = await repo.create(task);
    expect(created.id).toBe(task.id);
    expect(created.title).toBe(task.title);
  });

  test('findById returns a task', async () => {
    const task = makeTask();
    await repo.create(task);
    const found = await repo.findById(task.id);
    expect(found).not.toBeNull();
    expect(found!.title).toBe(task.title);
  });

  test('findById returns null for missing task', async () => {
    const found = await repo.findById('nonexistent');
    expect(found).toBeNull();
  });

  test('findAll returns all tasks', async () => {
    await repo.create(makeTask({ title: 'Task 1' }));
    await repo.create(makeTask({ title: 'Task 2' }));
    const all = await repo.findAll();
    expect(all).toHaveLength(2);
  });

  test('findByGroup filters by groupId', async () => {
    await repo.create(makeTask({ title: 'In Group A', groupId: 'group-a' }));
    await repo.create(makeTask({ title: 'In Group B', groupId: 'group-b' }));
    await repo.create(makeTask({ title: 'No Group' }));

    const inA = await repo.findByGroup('group-a');
    expect(inA).toHaveLength(1);
    expect(inA[0].title).toBe('In Group A');
  });

  test('update modifies task fields', async () => {
    const task = makeTask();
    await repo.create(task);
    const updated = await repo.update(task.id, {
      title: 'Updated Title',
      status: 'in-progress' as TaskStatus,
      completedPomodoros: 3,
    });
    expect(updated.title).toBe('Updated Title');
    expect(updated.status).toBe('in-progress');
    expect(updated.completedPomodoros).toBe(3);
  });

  test('update throws for missing task', async () => {
    await expect(repo.update('nonexistent', { title: 'X' })).rejects.toThrow();
  });

  test('delete removes a task', async () => {
    const task = makeTask();
    await repo.create(task);
    await repo.delete(task.id);
    const found = await repo.findById(task.id);
    expect(found).toBeNull();
  });

  test('tags are serialized as JSON array', async () => {
    const task = makeTask({ tags: ['urgent', 'frontend'] });
    await repo.create(task);
    const found = await repo.findById(task.id);
    expect(found!.tags).toEqual(['urgent', 'frontend']);
  });

  test('completedAt is stored correctly', async () => {
    const task = makeTask({ completedAt: '2026-05-04T10:00:00.000Z' });
    await repo.create(task);
    const found = await repo.findById(task.id);
    expect(found!.completedAt).toBe('2026-05-04T10:00:00.000Z');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/cbookshu/dev/temp/tomato_app/packages/core && npx jest tests/db/task-repository.test.ts`
Expected: FAIL — "Cannot find module '../../src/db/task-repository.js'"

- [ ] **Step 3: Write task repository implementation**

File: `packages/core/src/db/task-repository.ts`

```typescript
import { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { eq } from 'drizzle-orm';
import { tasks } from './schema.js';
import { Task } from '../types/task.js';

function rowToTask(row: typeof tasks.$inferSelect): Task {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? undefined,
    completedPomodoros: row.completedPomodoros,
    status: row.status as Task['status'],
    groupId: row.groupId ?? undefined,
    lastPomodoroTime: row.lastPomodoroTime ?? undefined,
    tags: row.tags ? JSON.parse(row.tags) : undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    completedAt: row.completedAt ?? undefined,
  };
}

export class TaskRepository {
  constructor(private db: BetterSQLite3Database) {}

  async findAll(): Promise<Task[]> {
    const rows = await this.db.select().from(tasks).all();
    return rows.map(rowToTask);
  }

  async findById(id: string): Promise<Task | null> {
    const rows = await this.db
      .select()
      .from(tasks)
      .where(eq(tasks.id, id))
      .all();
    return rows.length > 0 ? rowToTask(rows[0]) : null;
  }

  async findByGroup(groupId: string): Promise<Task[]> {
    const rows = await this.db
      .select()
      .from(tasks)
      .where(eq(tasks.groupId, groupId))
      .all();
    return rows.map(rowToTask);
  }

  async create(task: Task): Promise<Task> {
    await this.db.insert(tasks).values({
      id: task.id,
      title: task.title,
      description: task.description ?? null,
      completedPomodoros: task.completedPomodoros,
      status: task.status,
      groupId: task.groupId ?? null,
      lastPomodoroTime: task.lastPomodoroTime ?? null,
      tags: task.tags ? JSON.stringify(task.tags) : null,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      completedAt: task.completedAt ?? null,
    });
    return task;
  }

  async update(id: string, updates: Partial<Task>): Promise<Task> {
    const existing = await this.findById(id);
    if (!existing) throw new Error(`Task ${id} not found`);

    const values: Record<string, unknown> = {};
    if (updates.title !== undefined) values.title = updates.title;
    if (updates.description !== undefined) values.description = updates.description;
    if (updates.completedPomodoros !== undefined) values.completedPomodoros = updates.completedPomodoros;
    if (updates.status !== undefined) values.status = updates.status;
    if (updates.groupId !== undefined) values.groupId = updates.groupId;
    if (updates.lastPomodoroTime !== undefined) values.lastPomodoroTime = updates.lastPomodoroTime;
    if (updates.tags !== undefined) values.tags = JSON.stringify(updates.tags);
    if (updates.completedAt !== undefined) values.completedAt = updates.completedAt;
    values.updatedAt = new Date().toISOString();

    await this.db.update(tasks).set(values).where(eq(tasks.id, id));

    return (await this.findById(id))!;
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(tasks).where(eq(tasks.id, id));
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/cbookshu/dev/temp/tomato_app/packages/core && npx jest tests/db/task-repository.test.ts`
Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/tests/db/task-repository.test.ts packages/core/src/db/task-repository.ts
git commit -m "feat: implement TaskRepository with Drizzle/SQLite"
```

---

### Task 12: Stats Repository

**Files:**
- Create: `packages/core/tests/db/stats-repository.test.ts`
- Create: `packages/core/src/db/stats-repository.ts`

- [ ] **Step 1: Write failing stats repository tests**

File: `packages/core/tests/db/stats-repository.test.ts`

```typescript
import { StatsRepository } from '../../src/db/stats-repository.js';
import { setupTestDb } from './helpers.js';
import { DailyStats } from '../../src/types/stats.js';

describe('StatsRepository', () => {
  let db: ReturnType<typeof setupTestDb>;
  let repo: StatsRepository;

  beforeEach(() => {
    db = setupTestDb();
    repo = new StatsRepository(db);
  });

  test('upsert creates a new stats row', async () => {
    const row = await repo.upsert('2026-05-04', { totalPomodoros: 4, completedTasks: 2, tasks: ['t1', 't2'] });
    expect(row.date).toBe('2026-05-04');
    expect(row.totalPomodoros).toBe(4);
    expect(row.completedTasks).toBe(2);
    expect(row.tasks).toEqual(['t1', 't2']);
  });

  test('upsert merges with existing row', async () => {
    await repo.upsert('2026-05-04', { totalPomodoros: 3, completedTasks: 1, tasks: ['t1'] });
    const row = await repo.upsert('2026-05-04', { totalPomodoros: 1, completedTasks: 1, tasks: ['t2'] });

    expect(row.totalPomodoros).toBe(4);
    expect(row.completedTasks).toBe(2);
    expect(row.tasks).toEqual(['t1', 't2']);
  });

  test('findByDate returns stats for a date', async () => {
    await repo.upsert('2026-05-04', { totalPomodoros: 5, completedTasks: 3, tasks: ['t1'] });
    const found = await repo.findByDate('2026-05-04');
    expect(found).not.toBeNull();
    expect(found!.totalPomodoros).toBe(5);
  });

  test('findByDate returns null for missing date', async () => {
    const found = await repo.findByDate('2026-12-25');
    expect(found).toBeNull();
  });

  test('findByDateRange returns stats within date range', async () => {
    await repo.upsert('2026-05-01', { totalPomodoros: 4, completedTasks: 2, tasks: ['t1'] });
    await repo.upsert('2026-05-03', { totalPomodoros: 6, completedTasks: 3, tasks: ['t2'] });
    await repo.upsert('2026-05-05', { totalPomodoros: 2, completedTasks: 1, tasks: ['t3'] });

    const range = await repo.findByDateRange('2026-05-01', '2026-05-04');
    expect(range).toHaveLength(2);
    expect(range[0].date).toBe('2026-05-01');
    expect(range[1].date).toBe('2026-05-03');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/cbookshu/dev/temp/tomato_app/packages/core && npx jest tests/db/stats-repository.test.ts`
Expected: FAIL — "Cannot find module '../../src/db/stats-repository.js'"

- [ ] **Step 3: Write stats repository implementation**

File: `packages/core/src/db/stats-repository.ts`

```typescript
import { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { eq, gte, lte, and } from 'drizzle-orm';
import { dailyStats } from './schema.js';
import { DailyStats } from '../types/stats.js';

function rowToStats(row: typeof dailyStats.$inferSelect): DailyStats {
  return {
    date: row.date,
    totalPomodoros: row.totalPomodoros,
    completedTasks: row.completedTasks,
    tasks: JSON.parse(row.tasks),
  };
}

export class StatsRepository {
  constructor(private db: BetterSQLite3Database) {}

  async upsert(
    date: string,
    increment: { totalPomodoros?: number; completedTasks?: number; tasks?: string[] },
  ): Promise<DailyStats> {
    const existing = await this.findByDate(date);

    if (!existing) {
      const newRow = {
        date,
        totalPomodoros: increment.totalPomodoros ?? 0,
        completedTasks: increment.completedTasks ?? 0,
        tasks: JSON.stringify(increment.tasks ?? []),
      };
      await this.db.insert(dailyStats).values(newRow);
      return {
        date,
        totalPomodoros: newRow.totalPomodoros,
        completedTasks: newRow.completedTasks,
        tasks: increment.tasks ?? [],
      };
    }

    const newPomodoros = existing.totalPomodoros + (increment.totalPomodoros ?? 0);
    const newCompleted = existing.completedTasks + (increment.completedTasks ?? 0);
    const mergedTasks = [...new Set([...existing.tasks, ...(increment.tasks ?? [])])];

    await this.db
      .update(dailyStats)
      .set({
        totalPomodoros: newPomodoros,
        completedTasks: newCompleted,
        tasks: JSON.stringify(mergedTasks),
      })
      .where(eq(dailyStats.date, date));

    return { date, totalPomodoros: newPomodoros, completedTasks: newCompleted, tasks: mergedTasks };
  }

  async findByDate(date: string): Promise<DailyStats | null> {
    const rows = await this.db
      .select()
      .from(dailyStats)
      .where(eq(dailyStats.date, date))
      .all();
    return rows.length > 0 ? rowToStats(rows[0]) : null;
  }

  async findByDateRange(startDate: string, endDate: string): Promise<DailyStats[]> {
    const rows = await this.db
      .select()
      .from(dailyStats)
      .where(and(gte(dailyStats.date, startDate), lte(dailyStats.date, endDate)))
      .all();
    return rows.map(rowToStats);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/cbookshu/dev/temp/tomato_app/packages/core && npx jest tests/db/stats-repository.test.ts`
Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/tests/db/stats-repository.test.ts packages/core/src/db/stats-repository.ts
git commit -m "feat: implement StatsRepository with upsert and date range query"
```

---

### Task 13: Settings Repository

**Files:**
- Create: `packages/core/tests/db/settings-repository.test.ts`
- Create: `packages/core/src/db/settings-repository.ts`

- [ ] **Step 1: Write failing settings repository tests**

File: `packages/core/tests/db/settings-repository.test.ts`

```typescript
import { SettingsRepository } from '../../src/db/settings-repository.js';
import { setupTestDb } from './helpers.js';

describe('SettingsRepository', () => {
  let db: ReturnType<typeof setupTestDb>;
  let repo: SettingsRepository;

  beforeEach(() => {
    db = setupTestDb();
    repo = new SettingsRepository(db);
  });

  test('set creates a new setting', async () => {
    await repo.set('pomodoro_duration', '25');
    const value = await repo.get('pomodoro_duration');
    expect(value).toBe('25');
  });

  test('set overwrites an existing setting', async () => {
    await repo.set('theme', 'light');
    await repo.set('theme', 'dark');
    const value = await repo.get('theme');
    expect(value).toBe('dark');
  });

  test('get returns null for missing key', async () => {
    const value = await repo.get('nonexistent');
    expect(value).toBeNull();
  });

  test('get returns default value when key is missing', async () => {
    const value = await repo.get('not_set', 'default_val');
    expect(value).toBe('default_val');
  });

  test('getAll returns all settings', async () => {
    await repo.set('key1', 'value1');
    await repo.set('key2', 'value2');
    const all = await repo.getAll();
    expect(all).toEqual({ key1: 'value1', key2: 'value2' });
  });

  test('delete removes a setting', async () => {
    await repo.set('temp_key', 'temp_value');
    await repo.delete('temp_key');
    const value = await repo.get('temp_key');
    expect(value).toBeNull();
  });

  test('set with numeric value stored as string', async () => {
    await repo.set('pomodoro_duration', '25');
    const value = await repo.get('pomodoro_duration');
    expect(value).toBe('25');
  });

  test('set with boolean value stored as string', async () => {
    await repo.set('sound_enabled', 'true');
    const value = await repo.get('sound_enabled');
    expect(value).toBe('true');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/cbookshu/dev/temp/tomato_app/packages/core && npx jest tests/db/settings-repository.test.ts`
Expected: FAIL — "Cannot find module '../../src/db/settings-repository.js'"

- [ ] **Step 3: Write settings repository implementation**

File: `packages/core/src/db/settings-repository.ts`

```typescript
import { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { eq } from 'drizzle-orm';
import { settings } from './schema.js';

export class SettingsRepository {
  constructor(private db: BetterSQLite3Database) {}

  async get(key: string, defaultValue?: string): Promise<string | null> {
    const rows = await this.db
      .select()
      .from(settings)
      .where(eq(settings.key, key))
      .all();
    if (rows.length > 0) return rows[0].value;
    return defaultValue ?? null;
  }

  async set(key: string, value: string): Promise<void> {
    const existing = await this.get(key);
    if (existing !== null) {
      await this.db
        .update(settings)
        .set({ value })
        .where(eq(settings.key, key));
    } else {
      await this.db.insert(settings).values({ key, value });
    }
  }

  async getAll(): Promise<Record<string, string>> {
    const rows = await this.db.select().from(settings).all();
    const result: Record<string, string> = {};
    for (const row of rows) {
      result[row.key] = row.value;
    }
    return result;
  }

  async delete(key: string): Promise<void> {
    await this.db.delete(settings).where(eq(settings.key, key));
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/cbookshu/dev/temp/tomato_app/packages/core && npx jest tests/db/settings-repository.test.ts`
Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/tests/db/settings-repository.test.ts packages/core/src/db/settings-repository.ts
git commit -m "feat: implement SettingsRepository KV store with Drizzle/SQLite"
```

---

### Task 14: Package Index + Full Test Suite

**Files:**
- Create: `packages/core/src/index.ts`

- [ ] **Step 1: Write barrel export**

File: `packages/core/src/index.ts`

```typescript
// Types
export type { TimerStatus, TimerEvent, TimerState, PomodoroConfig } from './types/timer.js';
export { DEFAULT_POMODORO_CONFIG } from './types/timer.js';
export type { TaskStatus, Task, TaskGroup, NewTask, NewTaskGroup } from './types/task.js';
export { DEFAULT_GROUP_ID } from './types/task.js';
export type { DailyStats, MonthlyStats } from './types/stats.js';

// Pomodoro
export { transition } from './pomodoro/state-machine.js';
export { PomodoroTimer } from './pomodoro/timer.js';

// Tasks
export { addTaskAtPosition, reorderTasks, removeTaskFromOrder } from './tasks/sorting.js';
export { TaskManager } from './tasks/task-manager.js';
export type { ITaskRepository, ITaskGroupRepository } from './tasks/task-manager.js';

// Stats
export { computeDailyStats, computeWeeklyTrend, computeMonthlyStats } from './stats/calculator.js';

// Utils
export { generateId } from './utils/id-generator.js';
export { getToday, getWeekRange, getMonthKey } from './utils/date-utils.js';

// Database
export { getDb, closeDb } from './db/connection.js';
export { TaskRepository } from './db/task-repository.js';
export { TaskGroupRepository } from './db/task-group-repository.js';
export { StatsRepository } from './db/stats-repository.js';
export { SettingsRepository } from './db/settings-repository.js';
```

- [ ] **Step 2: Run the full test suite**

Run: `cd /Users/cbookshu/dev/temp/tomato_app/packages/core && npx jest --coverage`
Expected: all tests PASS, coverage >= 80%

- [ ] **Step 3: Verify TypeScript compilation**

Run: `cd /Users/cbookshu/dev/temp/tomato_app/packages/core && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/index.ts
git commit -m "feat: add barrel exports and verify full test suite"
```
