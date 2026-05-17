# Tomato Feature Roadmap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 以一份总索引统一管理 5 个已确认的功能方向，保持它们各自可单独实现、单独测试、单独回滚，同时给出清晰的执行顺序和冲突边界。

**Architecture:** 这不是把所有需求揉成一个执行块，而是一份总控目录，负责定义优先级、依赖关系和文件冲突边界。每个 workstream 都保留自己的 spec 和专属 plan，执行时仍按独立任务推进；总索引只负责把它们串起来，避免同一个文件被多条路径同时改写。

**Tech Stack:** TypeScript, Electron, React, Playwright, Vitest, Markdown docs.

---

## File Map

### Existing spec docs

- `docs/superpowers/specs/2026-05-17-task-group-persistence-design.md`
- `docs/superpowers/specs/2026-05-17-timer-settings-number-input-design.md`
- `docs/superpowers/specs/2026-05-17-task-notes-flicker-design.md`
- `docs/superpowers/specs/2026-05-17-sync-binding-persistence-design.md`
- `docs/superpowers/specs/2026-05-17-task-detail-reading-area-design.md`

### Execution docs

- `docs/superpowers/plans/2026-05-17-task-detail-reading-area.md`
- the other workstreams are tracked directly by their spec docs until their dedicated plan docs are created

---

## Task 1: Lock the execution order

**Files:**
- This is a planning task only; no source code changes.

- [ ] **Step 1: Confirm the recommended sequence**

Recommended order:

1. `任务组持久化与删除迁移`
2. `计时设置数字输入交互`
3. `任务笔记闪烁修复`
4. `同步绑定持久化`
5. `任务详情阅读区优化`

Why this order:

- Task group persistence is the most direct data-consistency fix and is independent of the UI layout work.
- Timer settings is isolated to settings form behavior.
- Notes flicker and task-detail reading area both touch `TaskDetail.tsx`, so they should not be executed in parallel.
- Sync binding persistence is main-process + renderer state work, best kept away from the `TaskDetail` UI surface.

- [ ] **Step 2: Note the shared-file boundary**

Shared file to protect:

- `tomato_app/src/renderer/components/TaskList/TaskDetail.tsx`

This file is affected by both:

- `2026-05-17-task-notes-flicker-design.md`
- `2026-05-17-task-detail-reading-area-design.md`

Do not run those two workstreams in parallel against the same checkout unless one is explicitly rebased on the other.

- [ ] **Step 3: Record the non-overlapping files**

Non-overlapping areas:

- Task group persistence lives in task manager, IPC handlers, and task-tree / group UI.
- Timer settings lives in settings renderer and settings tests.
- Sync binding persistence lives in sync main-process files and sync state/store tests.
- Task detail reading area lives in `TaskDetail.tsx`, `index.css`, and one focused E2E spec.

---

## Task 2: Execute the data-layer and persistence workstreams one at a time

**Files:**
- Use the task-group and sync-binding specs/plans as the execution source for this block.

- [ ] **Step 1: Run task-group persistence first**

Source docs:

- `docs/superpowers/specs/2026-05-17-task-group-persistence-design.md`

Target behavior:

- Create / delete / rename task groups persist correctly.
- Deleting a normal group moves its tasks to `未分组`.

- [ ] **Step 2: Run sync binding persistence next**

Source docs:

- `docs/superpowers/specs/2026-05-17-sync-binding-persistence-design.md`

Target behavior:

- Sync binding metadata moves under `tomato-data/.meta/`.
- Reinstalling the app binary keeps binding state as long as `tomato-data` remains.

- [ ] **Step 3: Validate persistence work with the relevant acceptance tests**

Run the existing targeted test suites for those areas before moving to renderer UI work.

---

## Task 3: Execute the renderer interaction workstreams one at a time

**Files:**
- Use the timer-settings, task-notes, and task-detail specs/plans as the execution source for this block.

- [ ] **Step 1: Run timer settings input behavior**

Source docs:

- `docs/superpowers/specs/2026-05-17-timer-settings-number-input-design.md`

Target behavior:

- Keep spinner arrows.
- Allow direct keyboard input on all four timer fields.

- [ ] **Step 2: Run task notes flicker fix**

Source docs:

- `docs/superpowers/specs/2026-05-17-task-notes-flicker-design.md`

Target behavior:

- Notes stop clearing / reloading while typing.
- Autosave remains.
- Automated verification remains part of the workstream.

- [ ] **Step 3: Run task detail reading-area layout last**

Source docs:

- `docs/superpowers/specs/2026-05-17-task-detail-reading-area-design.md`

Target behavior:

- Right-side task detail area expands in wide windows.
- Ordered-list numbering in the notes preview remains visible.

- [ ] **Step 4: Avoid parallel edits on `TaskDetail.tsx`**

If task-notes and task-detail-layout changes are both in flight, merge them sequentially into the same branch, not in parallel worktrees that both rewrite the same renderer component.

---

## Task 4: Verify the merged roadmap end to end

**Files:**
- No new source files; this is verification only.

- [ ] **Step 1: Verify the relevant targeted suites for each workstream**

For each workstream, run its own targeted tests before declaring the roadmap complete.

- [ ] **Step 2: Run the full Electron acceptance suite**

Use the full Playwright suite to catch integration regressions across the combined set of changes.

- [ ] **Step 3: Review the plan list after implementation**

When the five workstreams are finished, update this roadmap if any task ordering or shared-file constraints changed.

---

## Self-Review Checklist

- [ ] The roadmap covers all 5 confirmed spec docs.
- [ ] The roadmap makes clear that it is an index, not a merged code task.
- [ ] Shared-file conflict risk is called out explicitly.
- [ ] The recommended execution order is present and justified.
- [ ] No placeholder text such as TODO or TBD remains.
