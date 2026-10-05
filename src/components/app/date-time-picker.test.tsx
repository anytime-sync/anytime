import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
vi.mock('@/hooks/use-ai', () => ({ useUserPrefs: () => ({ data: { language: 'en' } }) }));
vi.mock('@/lib/use-language', () => ({ useLanguage: () => 'en' }));
import { DateTimePicker } from './date-time-picker';
let tree: ReactTestRenderer;
const change = vi.fn();
beforeEach(() => { vi.clearAllMocks(); vi.stubGlobal('document', { addEventListener: vi.fn(), removeEventListener: vi.fn() }); });
afterEach(() => { if (tree) act(() => tree.unmount()); vi.unstubAllGlobals(); });
function mount(value: string | null, allDay = false) { act(() => { tree = create(<DateTimePicker value={value} onChange={change} allDay={allDay} />); }); }
function click(text: string) { const button = tree.root.findAllByType('button').find(node => node.children.includes(text))!; act(() => button.props.onClick()); }
function open() { act(() => tree.root.findAllByType('button')[0].props.onClick()); }
it('opening and applying without edits leaves an exact short-slot boundary untouched', () => {
  mount('2026-10-08T01:03:06.456Z'); open(); click('Apply'); expect(change).not.toHaveBeenCalled();
});
it('cancels draft day/time selections without persisting them', () => {
  mount('2026-10-08T01:00:00Z'); open(); click('Tomorrow'); click('Cancel'); expect(change).not.toHaveBeenCalled();
  open(); click('Apply'); expect(change).not.toHaveBeenCalled();
});
it('applies deliberate date selection once and preserves all-day midnight', () => {
  mount(null, true); open(); click('Tomorrow'); expect(change).not.toHaveBeenCalled(); click('Apply');
  expect(change).toHaveBeenCalledTimes(1); expect(new Date(change.mock.calls[0][0]).getHours()).toBe(0);
});
it('clears explicitly without making a replacement date', () => {
  mount('2026-10-08T01:00:00Z'); open(); click('Clear'); expect(change).toHaveBeenCalledTimes(1); expect(change).toHaveBeenCalledWith(null);
});
