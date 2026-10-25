# Frozen main projection oracle

`ical-feed.ts` and `task-schedule.ts` are unmodified source snapshots from
`eae82d43076597a5257330e731c8e8363e4ecba0`. The Google eligibility predicate body is
copied unchanged from that commit; its type annotation is self-contained.

These pure, offline fixtures compare the staged candidate to actual prior source.
They are imported only by compatibility tests, never by application code. Do not
update them to match the new implementation or use their date policy to classify
stored tasks. No credentials, customer rows or provider operations are included.
