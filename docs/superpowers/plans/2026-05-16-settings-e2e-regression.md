# Settings E2E Regression Coverage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add regression coverage for the compact settings layout and verify the current settings, notes, and sync flows with a full Playwright run.

**Architecture:** The new regression coverage will stay entirely at the browser/Electron acceptance layer. One spec will assert the settings page still renders as a compact desktop grid with non-wrapping action buttons, and the existing acceptance suite will continue to cover persistence and sync behavior end to end.

**Tech Stack:** Playwright, Electron, TypeScript, existing acceptance-test helpers.

---

## File Map

- New E2E regression coverage:
  - `tomato_app/tests/e2e/basic-acceptance-settings-layout.spec.ts`
- Existing acceptance coverage to keep running:
  - `tomato_app/tests/e2e/basic-acceptance-settings.spec.ts`
  - `tomato_app/tests/e2e/basic-acceptance-task-notes.spec.ts`
  - `tomato_app/tests/e2e/basic-acceptance-sync.spec.ts`
  - `tomato_app/tests/e2e/basic-acceptance-timer-stats.spec.ts`
  - `tomato_app/tests/e2e/pomodoro-cycle.spec.ts`
  - `tomato_app/tests/e2e/task-timer-link.spec.ts`
  - `tomato_app/tests/e2e/tasks.spec.ts`
  - `tomato_app/tests/e2e/timer.spec.ts`

## Task 1: Add a desktop-layout regression spec for the settings page

**Files:**
- Create: `tomato_app/tests/e2e/basic-acceptance-settings-layout.spec.ts`

- [ ] **Step 1: Write the new regression test**

```ts
import { test, expect } from './fixtures';
import { clearDataAndReload } from './helpers/acceptance-helpers';

test.describe('基础验收：设置布局', () => {
  test.beforeEach(async ({ page, electronApp }) => {
    await clearDataAndReload(page, electronApp);
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  test('桌面宽度下设置页应保持双栏紧凑布局且按钮不换行', async ({ page }) => {
    await page.getByRole('tab', { name: '设置' }).click();

    const timerHeader = page.getByRole('heading', { name: '计时设置' });
    const syncHeader = page.getByRole('heading', { name: '数据同步' });
    await expect(timerHeader).toBeVisible();
    await expect(syncHeader).toBeVisible();

    const [timerBox, syncBox] = await Promise.all([
      timerHeader.boundingBox(),
      syncHeader.boundingBox(),
    ]);
    expect(timerBox).not.toBeNull();
    expect(syncBox).not.toBeNull();
    expect(syncBox!.x).toBeGreaterThan(timerBox!.x);

    await expect(page.getByRole('button', { name: '导出数据' })).toHaveCSS('white-space', 'nowrap');
    await expect(page.getByRole('button', { name: '导入数据' })).toHaveCSS('white-space', 'nowrap');
  });
});
```

- [ ] **Step 2: Run the new spec by itself**

Run:

```bash
cd tomato_app && npm run test:e2e -- basic-acceptance-settings-layout.spec.ts
```

Expected: PASS against the current compact settings layout.

- [ ] **Step 3: Run the full Playwright suite**

Run:

```bash
cd tomato_app && npm run test:e2e -- --workers=1
```

Expected: PASS for all 19 acceptance tests.

- [ ] **Step 4: Record the verification result**

Confirm the regression spec stays green and the full suite still passes after the new test is added.

## Self-Review Checklist

- [ ] The new regression spec only checks observable layout and button wrapping behavior.
- [ ] The settings persistence, notes, sync, and timer tests remain intact.
- [ ] The plan does not introduce unrelated feature work.
- [ ] The Playwright command path matches the repo scripts.
- [ ] There are no placeholders such as TODO or TBD.
