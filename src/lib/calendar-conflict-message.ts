/** User-facing explanation; persisted reason codes remain stable for review. */
export function calendarConflictMessage(reason: string): string {
  const messages: Record<string, string> = {
    both_sides_changed: 'This task and its Google event both changed.',
    remote_changed_since_baseline:
      'The Google event changed since the last acknowledged sync.',
    remote_changed_during_write:
      'The Google event changed while this task was syncing.',
    remote_deleted_task_retained:
      'The Google event was deleted. Your task is still saved.',
    missing_acknowledged_baseline:
      'This link needs review before either version can replace the other.',
    recurring_occurrence_edit_requires_review:
      'An occurrence changed in Google Calendar. The task series has been kept intact.',
    timed_deadline_requires_task_edit:
      'This timed deadline needs to be edited in Tasks.',
    unsupported_intent_or_recurrence_edit:
      'The Google event’s recurrence or time intent changed.',
    series_timezone_changed: 'The Google series timezone changed.',
    unsupported_date_mode_change: 'The Google event’s date mode changed.',
    legacy_or_changed_time_intent:
      'This older task’s time intent needs review.',
  };
  return (
    messages[reason] ??
    'The task and its Google event need review before syncing.'
  );
}
