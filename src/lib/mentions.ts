import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * @-mention parser + notifier for task comments.
 *
 * Strategy:
 *   - Pull every `@token` out of the comment body. Tokens are
 *     letter/number/dot/plus/hyphen/underscore — broad enough to catch
 *     usernames AND email local-parts ("@alice", "@alice.smith",
 *     "@alice+work"). Email forms ("@alice@example.com") are matched
 *     too: the regex allows an optional `@domain` tail.
 *   - For each unique token, try a few profile lookups in priority
 *     order: exact email match, email local-part match, full_name
 *     case-insensitive match. First hit wins.
 *   - Verify the matched user actually has read access to the task
 *     before notifying. We approximate the task RLS policy with a
 *     few cheap checks (owner / assignee / share-group member). If
 *     the check is wrong, RLS on app_notifications.insert() will
 *     either succeed (the notification row only requires user_id =
 *     the recipient, which is fine) or fail silently — either way
 *     we never throw out of this helper.
 *
 * Tiebreak when multiple profiles match a token (e.g. several Alices):
 * prefer exact local-part equality (case-insensitive), then the
 * earliest-created profile. Deterministic without FTS.
 */

const MENTION_RE = /@([\w.+-]+(?:@[\w.+-]+)?)/g;

type MentionableProfile = {
  id: string;
  email: string;
  full_name: string | null;
};

type CommentRow = {
  id: string;
  task_id: string;
  author_id: string;
  body: string;
};

type TaskRow = {
  id: string;
  user_id: string;
  title: string;
  share_group_id?: string | null;
  assignee_id?: string | null;
};

export function extractMentionTokens(body: string): string[] {
  const out = new Set<string>();
  let m: RegExpExecArray | null;
  MENTION_RE.lastIndex = 0;
  while ((m = MENTION_RE.exec(body))) {
    const raw = m[1];
    if (!raw) continue;
    // Strip trailing punctuation / dots that shouldn't be part of an
    // identifier (e.g. "@alice." at end of sentence).
    const cleaned = raw.replace(/[.+\-_]+$/g, "");
    if (cleaned.length >= 2) out.add(cleaned);
  }
  return Array.from(out);
}

async function lookupProfile(
  supabase: SupabaseClient,
  token: string
): Promise<MentionableProfile | null> {
  // 1) exact email match (token already contains @domain)
  if (token.includes("@")) {
    const { data } = await supabase
      .from("profiles")
      .select("id, email, full_name")
      .ilike("email", token)
      .limit(1)
      .maybeSingle();
    if (data) return data as MentionableProfile;
  }

  // 2) email local-part match: token@%
  const { data: localMatches } = await supabase
    .from("profiles")
    .select("id, email, full_name, created_at")
    .ilike("email", `${token}@%`)
    .order("created_at", { ascending: true })
    .limit(5);
  if (localMatches && localMatches.length > 0) {
    const exact = localMatches.find(
      (p: { email: string }) =>
        p.email.toLowerCase().split("@")[0] === token.toLowerCase()
    );
    return (exact ?? localMatches[0]) as MentionableProfile;
  }

  // 3) full_name match (case-insensitive)
  const { data: nameMatches } = await supabase
    .from("profiles")
    .select("id, email, full_name, created_at")
    .ilike("full_name", token)
    .order("created_at", { ascending: true })
    .limit(5);
  if (nameMatches && nameMatches.length > 0) {
    return nameMatches[0] as MentionableProfile;
  }

  return null;
}

async function userCanReadTask(
  supabase: SupabaseClient,
  userId: string,
  task: TaskRow
): Promise<boolean> {
  // Owner / assignee / share-group member. Project-member visibility
  // isn't strictly required for v1; if RLS rejects the notification
  // insert we silently skip it (notifyMentions catches errors).
  if (task.user_id === userId) return true;
  if (task.assignee_id && task.assignee_id === userId) return true;
  if (task.share_group_id) {
    const { data } = await supabase
      .from("share_group_members")
      .select("user_id")
      .eq("group_id", task.share_group_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (data) return true;
  }
  return false;
}

export async function notifyMentions({
  supabase,
  comment,
  task,
}: {
  supabase: SupabaseClient;
  comment: CommentRow;
  task: TaskRow;
}): Promise<{ notified: number }> {
  try {
    const tokens = extractMentionTokens(comment.body);
    if (tokens.length === 0) return { notified: 0 };

    const seen = new Set<string>();
    seen.add(comment.author_id); // never self-notify
    let notified = 0;

    for (const tok of tokens) {
      const profile = await lookupProfile(supabase, tok);
      if (!profile) continue;
      if (seen.has(profile.id)) continue;
      seen.add(profile.id);

      const canRead = await userCanReadTask(supabase, profile.id, task);
      if (!canRead) continue;

      const preview =
        comment.body.length > 140
          ? comment.body.slice(0, 137) + "…"
          : comment.body;

      const { error } = await supabase.from("app_notifications").insert({
        user_id: profile.id,
        kind: "mention",
        title: `You were mentioned on "${task.title}"`,
        body: preview,
        payload: {
          task_id: task.id,
          comment_id: comment.id,
          group_id: task.share_group_id ?? null,
        },
        action_url: `/app/today?task=${task.id}`,
      });
      if (!error) notified += 1;
    }
    return { notified };
  } catch {
    // Best-effort. Never fail the parent POST.
    return { notified: 0 };
  }
}
