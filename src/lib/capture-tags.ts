import type { SupabaseClient } from '@supabase/supabase-js';
import type { Tag } from './db.types';

/** Metadata-only recovery for a confirmed task. Existing unique keys make both
 * writes repeatable, including when a committed link's response was lost. */
export async function attachCapturedTags(client: SupabaseClient, userId: string, taskId: string, names: string[]): Promise<Tag[]> {
  const rows = [...new Set(names)].map(name => ({ user_id: userId, name }));
  if (!rows.length) return [];
  const { data: tags, error: tagError } = await client.from('tags').upsert(rows, { onConflict: 'user_id,name' }).select();
  if (tagError) throw tagError;
  if (!tags || tags.length !== rows.length) throw new Error('Tags were not returned');
  const { error: linkError } = await client.from('task_tags').upsert(
    tags.map(tag => ({ task_id: taskId, tag_id: tag.id })),
    { onConflict: 'task_id,tag_id', ignoreDuplicates: true },
  );
  if (linkError) throw linkError;
  return tags as Tag[];
}
