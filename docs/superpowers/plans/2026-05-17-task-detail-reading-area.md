# 任务详情阅读区优化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让任务页右侧详情区在宽屏下真正展开，并让任务笔记 Markdown 预览稳定显示有序列表编号，同时保持当前 app 的真实界面结构不变。

**Architecture:** 右侧详情区的尺寸问题只在 `TaskDetail` 内部处理，保持左侧任务树和中间分割线不变。Markdown 列表样式只在任务详情页的局部容器里恢复，不做全局 reset。验证分两层：Playwright 负责真实页面宽度和列表编号，renderer 代码只负责布局和 scoped 样式。

**Tech Stack:** React, TypeScript, Tailwind CSS, `@uiw/react-md-editor`, Electron, Playwright.

---

## File Map

### Modify

- `tomato_app/src/renderer/components/TaskList/TaskDetail.tsx` - remove the width cap, add a stable hook for layout tests, and scope the notes preview container.
- `tomato_app/src/renderer/index.css` - add narrowly scoped Markdown list styles for the task notes preview only.

### Create

- `tomato_app/tests/e2e/basic-acceptance-task-detail-reading-area.spec.ts` - regression coverage for wide detail-pane layout and ordered-list numbering in the preview.

---

## Task 1: Write the regression spec first

**Files:**
- Create: `tomato_app/tests/e2e/basic-acceptance-task-detail-reading-area.spec.ts`

- [ ] **Step 1: Write the failing Playwright test**

```ts
import { test, expect } from './fixtures';
import { clearDataAndReload, createDefaultTask } from './helpers/acceptance-helpers';

test.describe('基础验收：任务详情阅读区', () => {
  test.beforeEach(async ({ page, electronApp }) => {
    await clearDataAndReload(page, electronApp);
    await page.setViewportSize({ width: 1600, height: 960 });
  });

  test('宽屏下详情区应展开且有序列表编号可见', async ({ page }) => {
    const taskItem = await createDefaultTask(page, '验收任务：阅读区');
    await taskItem.click();
    await expect(page.getByRole('heading', { name: '验收任务：阅读区' })).toBeVisible();

    const detail = page.getByTestId('task-detail');
    const box = await detail.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(760);

    const notesEditor = page.locator('textarea[placeholder="添加笔记..."]');
    await notesEditor.fill('1. 第一项\n2. 第二项\n3. 第三项');

    const markdownOl = page.locator('[data-testid="task-detail"] .wmde-markdown ol').first();
    await expect(markdownOl).toBeVisible();
    await expect(markdownOl).toHaveCSS('list-style-type', 'decimal');
  });
});
```

- [ ] **Step 2: Run the new spec and confirm the current layout fails it**

Run:

```bash
cd tomato_app && npm run test:e2e -- basic-acceptance-task-detail-reading-area.spec.ts
```

Expected: fail against the current code because the detail pane is still capped by `max-w-2xl`, and the preview list styling is not explicitly scoped.

- [ ] **Step 3: Keep the test as the acceptance target**

Do not weaken the assertions to make the test pass early. The point is to lock the real width behavior and the visible ordered-list rendering in one place.

---

## Task 2: Remove the width cap and scope the notes preview styles

**Files:**
- Modify: `tomato_app/src/renderer/components/TaskList/TaskDetail.tsx`
- Modify: `tomato_app/src/renderer/index.css`

- [ ] **Step 1: Make the renderer change minimally and locally**

```tsx
// TaskDetail.tsx
return (
  <div
    data-testid="task-detail"
    className="flex-1 flex flex-col min-h-0 p-6 overflow-y-auto"
  >
    <div className="flex-1 flex flex-col min-h-0 w-full">
      <div className="flex items-start justify-between mb-4">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          {task.title}
        </h1>
        <div className="flex gap-2">
          <Button size="sm" onClick={handleStart} disabled={status === 'working'}>
            <Play className="h-4 w-4 mr-1" />
            开始专注
          </Button>
          <Button size="sm" variant="outline" onClick={handleComplete}>
            <CheckCircle className="h-4 w-4 mr-1" />
            {task.status === 'completed' ? '恢复' : '完成'}
          </Button>
        </div>
      </div>

      <div className="flex gap-4 text-sm text-gray-500 dark:text-gray-400 mb-6">
        <span>🍅 已完成 {task.completedPomodoros} 个番茄</span>
        <span>📅 创建于 {new Date(task.createdAt).toLocaleDateString()}</span>
      </div>

      {isSaving && (
        <p data-testid="task-notes-saving" className="text-sm text-gray-500 dark:text-gray-400 mb-2">
          保存中...
        </p>
      )}
      {saveError && (
        <p data-testid="task-notes-save-error" className="text-sm text-red-500 mb-2">
          {saveError}
        </p>
      )}

      <div className="flex-1 flex flex-col min-h-0 border-t border-gray-200 dark:border-gray-700 pt-4">
        <div className="task-notes-preview flex-1 min-h-0" data-color-mode="auto">
          <MDEditor
            value={notes}
            onChange={(val) => setNotes(val || '')}
            preview="live"
            height="100%"
            textareaProps={{
              placeholder: '添加笔记...',
            }}
          />
        </div>
      </div>
    </div>
  </div>
);
```

```css
/* index.css */
@layer components {
  .task-notes-preview .wmde-markdown ol,
  .task-notes-preview .wmde-markdown ul {
    margin: 0.75rem 0;
    padding-left: 1.5rem;
  }

  .task-notes-preview .wmde-markdown ol {
    list-style-type: decimal;
  }

  .task-notes-preview .wmde-markdown ul {
    list-style-type: disc;
  }

  .task-notes-preview .wmde-markdown li + li {
    margin-top: 0.25rem;
  }
}
```

The important behavior change is the container width:

```tsx
<div className="flex-1 flex flex-col min-h-0 w-full">
```

instead of the current capped inner wrapper. Keep the rest of the task-detail header and action buttons untouched so the page still feels like the same app.

- [ ] **Step 2: Run the new regression spec until it passes**

Run:

```bash
cd tomato_app && npm run test:e2e -- basic-acceptance-task-detail-reading-area.spec.ts
```

Expected: PASS after the detail pane fills the available width and the ordered-list numbering is visible in the preview.

- [ ] **Step 3: Keep the change scoped**

Do not move the list styling into a global markdown reset. Do not add a second layout mode. Do not split the notes area into left/right panes.

- [ ] **Step 4: Commit the renderer and test work together**

```bash
git add tomato_app/src/renderer/components/TaskList/TaskDetail.tsx tomato_app/src/renderer/index.css tomato_app/tests/e2e/basic-acceptance-task-detail-reading-area.spec.ts
git commit -m "feat(ui): widen task detail reading area"
```

---

## Task 3: Verify the regression stays green in the full suite

**Files:**
- No new code; this task is validation only.

- [ ] **Step 1: Run the targeted task-notes acceptance test**

Run:

```bash
cd tomato_app && npm run test:e2e -- basic-acceptance-task-notes.spec.ts
```

Expected: PASS. This confirms the new layout/styling changes did not break the existing notes persistence flow.

- [ ] **Step 2: Run the full Electron Playwright suite**

Run:

```bash
cd tomato_app && npm run test:e2e -- --workers=1
```

Expected: PASS for the whole acceptance suite, including task notes, settings, timer, task tree, and window chrome coverage.

- [ ] **Step 3: Check for layout regressions by inspecting the new test once more**

If the new task-detail reading-area spec is flaky, fix the selector or wait condition in the test first rather than relaxing the layout assertion.

---

## Self-Review Checklist

- [ ] Every spec requirement has a task that covers it: widened detail area, ordered-list numbering, and protection against global markdown styling changes.
- [ ] The plan uses only one new Playwright spec file and does not invent extra UI modes.
- [ ] The code snippets use real file paths and selectors that match the current app structure.
- [ ] There are no placeholders such as TODO, TBD, or "handle edge cases later".
- [ ] The plan keeps the fix local to `TaskDetail.tsx` and `index.css` instead of broadening the change surface.
