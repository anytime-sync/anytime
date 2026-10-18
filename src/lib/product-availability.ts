/** Retired product capabilities. Deliberately independent of credentials and admin flags. */
export const HOSTED_AI_ENABLED = false;

export function isRetiredFeature(id: string): boolean {
  return id.startsWith('ai_') || ['review_reflect', 'review_weekly_retro', 'data_semantic_search'].includes(id);
}

export function isRetiredApiPath(path: string): boolean {
  return path.startsWith('/api/ai/') || path.startsWith('/api/v1/ai/') ||
    ['/api/search', '/api/v1/notes/search', '/api/v1/daily-edition',
      '/api/cron/daily-editions', '/api/cron/embeddings-sync'].includes(path.replace(/\/$/, ''));
}
