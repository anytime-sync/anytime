-- 0025_group_activity_fk_cascade.sql
--
-- Fix: deleting a group-shared task failed because the trigger that logs
-- to group_activity tried to insert a row referencing the task being deleted.
-- The FK constraint blocked it. Change to ON DELETE SET NULL so activity
-- log rows survive but lose the task_id reference.

ALTER TABLE group_activity
  DROP CONSTRAINT group_activity_task_id_fkey,
  ADD CONSTRAINT group_activity_task_id_fkey
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL;
