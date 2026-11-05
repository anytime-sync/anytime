import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const prefs = vi.hoisted(() => ({ timezone: 'UTC' }));
vi.mock('@/hooks/use-ai', () => ({ useUserPrefs: () => ({ data: { language: 'en', timezone: prefs.timezone } }) }));
vi.mock('@/lib/use-language', () => ({ useLanguage: () => 'en' }));
import { DateTimePicker } from './date-time-picker';
let tree: ReactTestRenderer;
const change = vi.fn();
beforeEach(() => { prefs.timezone = 'UTC'; vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-11-05T12:00:00Z')); vi.clearAllMocks(); vi.stubGlobal('document', { addEventListener: vi.fn(), removeEventListener: vi.fn() }); });
afterEach(() => { if (tree) act(() => tree.unmount()); vi.unstubAllGlobals(); vi.useRealTimers(); });
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
it('applies one deliberate civil date without device midnight conversion', () => {
  mount(null, true); open(); click('Tomorrow'); expect(change).not.toHaveBeenCalled(); click('Apply');
  expect(change).toHaveBeenCalledTimes(1); expect(change).toHaveBeenCalledWith('2026-11-06');
});
it('clears explicitly without making a replacement date', () => {
  mount('2026-10-08T01:00:00Z'); open(); click('Clear'); expect(change).toHaveBeenCalledTimes(1); expect(change).toHaveBeenCalledWith(null);
});

it('a new ambiguous local time stays in the picker instead of choosing a host-dependent offset', () => {
  prefs.timezone='America/New_York'; mount('2026-11-01T07:30:00Z'); open();
  const hour=tree.root.findAllByType('button').filter(b=>b.props.children === 1).at(-1)!;
  act(()=>hour.props.onClick());click('Apply');
  expect(change).not.toHaveBeenCalled();
  expect(JSON.stringify(tree.toJSON())).toContain('Ambiguous local time');
});
