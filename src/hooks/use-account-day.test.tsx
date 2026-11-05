import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
vi.mock('./use-ai', () => ({
  useUserPrefs: () => ({
    data: { timezone: 'America/New_York' },
    isPending: false,
  }),
}));
import { useAccountDay } from './use-account-day';
let tree: ReactTestRenderer;
let dates: string[];
let events: EventTarget;
function Probe({ index }: { index: number }) {
  dates[index] = useAccountDay().date;
  return null;
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-01T03:59:59Z'));
  dates = [];
  events = new EventTarget();
  vi.stubGlobal('window', events);
});
afterEach(() => {
  act(() => tree?.unmount());
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
it('midnight refreshes every subscriber with one timer, including the following 25-hour day', async () => {
  act(() => {
    tree = create(
      <>
        <Probe index={0} />
        <Probe index={1} />
      </>,
    );
  });
  expect(dates).toEqual(['2026-10-31', '2026-10-31']);
  expect(vi.getTimerCount()).toBe(1);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1000);
  });
  expect(dates).toEqual(['2026-11-01', '2026-11-01']);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(24 * 3600000);
  });
  expect(dates[0]).toBe('2026-11-01');
  await act(async () => {
    await vi.advanceTimersByTimeAsync(3600000);
  });
  expect(dates[0]).toBe('2026-11-02');
  act(() => tree.unmount());
  expect(vi.getTimerCount()).toBe(0);
});
it('focus catches up after sleep without waiting for a stale midnight timer', () => {
  act(() => {
    tree = create(<Probe index={0} />);
  });
  vi.setSystemTime(new Date('2026-11-03T15:00Z'));
  act(() => {
    events.dispatchEvent(new Event('focus'));
  });
  expect(dates[0]).toBe('2026-11-03');
  expect(vi.getTimerCount()).toBe(1);
});
