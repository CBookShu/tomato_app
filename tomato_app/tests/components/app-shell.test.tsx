import { describe, expect, test } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AppShell } from '../../src/renderer/components/Layout/AppShell.js';

describe('AppShell', () => {
  test('renders a scrollable content region', () => {
    const markup = renderToStaticMarkup(
      <AppShell activeTab="tasks" onTabChange={() => {}}>
        <div>content</div>
      </AppShell>,
    );

    expect(markup).toContain('overflow-y-auto');
    expect(markup).toContain('overflow-hidden');
    expect(markup).toContain('content');
  });
});
