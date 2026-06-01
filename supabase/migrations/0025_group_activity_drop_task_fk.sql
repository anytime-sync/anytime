-- 0025_group_activity_drop_task_fk.sql
--
-- Fix: deleting a group-shared task failed because a trigger inserts into
-- group_activity with task_id referencing the task being deleted. The FK
-- constraint blocked the insert during the delete transaction.
-- 
-- Solution: drop the FK entirely. group_activity is an append-only activity
-- log — referential integrity on task_id is not critical. Activity rows
-- survive with a dangling task_id after task deletion.

ALTER TABLE group_activity
  DROP CONSTRAINT IF EXISTS group_activity_task_id_fkey;
