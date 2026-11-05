import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  rows: [] as any[],
  refetch: vi.fn(),
  notify: vi.fn(),
}));
vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: state.rows, refetch: state.refetch }),
}));
vi.mock("@/lib/use-language", () => ({ useLanguage: () => "en" }));
vi.mock("@/store/ui", () => ({ useUIStore: () => vi.fn() }));
import { Reminders } from "./reminders";
let tree: ReactTestRenderer;
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-05T00:00Z"));
  state.notify.mockReset();
  state.refetch.mockReset();
  vi.stubGlobal("window", new EventTarget());
  vi.stubGlobal(
    "document",
    Object.assign(new EventTarget(), { visibilityState: "visible" }),
  );
  vi.stubGlobal(
    "Notification",
    Object.assign(
      function (...args: any[]) {
        state.notify(...args);
      },
      { permission: "granted" },
    ),
  );
  state.rows = [
    {
      id: "task",
      title: "Before",
      reminder_at: "2026-11-05T00:01Z",
      updated_at: "v1",
    },
  ];
});
afterEach(() => {
  act(() => tree?.unmount());
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
it("replaces the timer and captured title when the same task is rescheduled", async () => {
  act(() => {
    tree = create(<Reminders />);
  });
  state.rows = [
    {
      ...state.rows[0],
      title: "After",
      reminder_at: "2026-11-05T00:02Z",
      updated_at: "v2",
    },
  ];
  act(() => tree.update(<Reminders />));
  await act(async () => {
    await vi.advanceTimersByTimeAsync(60000);
  });
  expect(state.notify).not.toHaveBeenCalled();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(60000);
  });
  expect(state.notify).toHaveBeenCalledWith(
    expect.any(String),
    expect.objectContaining({ body: "After" }),
  );
});
it("clears timers on completion/removal and unmount", async () => {
  act(() => {
    tree = create(<Reminders />);
  });
  state.rows = [];
  act(() => tree.update(<Reminders />));
  await act(async () => {
    await vi.advanceTimersByTimeAsync(120000);
  });
  expect(state.notify).not.toHaveBeenCalled();
  act(() => tree.unmount());
  expect(vi.getTimerCount()).toBe(0);
});

it("clears a timer on explicit reminder removal and refetches on focus/resume", async () => {
  act(() => {
    tree = create(<Reminders />);
  });
  state.rows = [{ ...state.rows[0], reminder_at: null }];
  act(() => tree.update(<Reminders />));
  expect(vi.getTimerCount()).toBe(0);
  await act(async () => {
    window.dispatchEvent(new Event("focus"));
  });
  expect(state.refetch).toHaveBeenCalledOnce();
  act(() => tree.unmount());
  expect(vi.getTimerCount()).toBe(0);
});
