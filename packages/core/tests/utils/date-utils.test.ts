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
