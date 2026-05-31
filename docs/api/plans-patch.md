# Patch for `src/lib/plans.ts`

Add this feature row to your existing feature matrix. The exact key/shape
should mirror your other entries (`reflectAI`, `voiceToTask`, etc.). The
intent: `apiAccess` is enabled only for `pro` and `vip`.

```ts
// Inside your features const / object:
apiAccess: {
  label: "Public API & MCP server",
  description:
    "Issue personal access tokens, hit /api/v1/*, and let Claude (or any MCP-aware assistant) read and edit your First Light.",
  free: false,
  plus: false,
  pro: true,
  vip: true,
  category: "automation", // or whichever category fits your matrix
} satisfies PlanFeature,
```

If your matrix is a flat array of rows (rather than an object), append a row
in the same shape you already use.

## Wire-up checklist

After adding the row above:

1. **Gate the API middleware.** `src/app/api/v1/_lib/auth.ts` already calls
   `assertPlanAllowsApi(userId)`; that helper reads `apiAccess` from this
   matrix, so the row above is the only change needed for the API itself.

2. **Surface in the Settings → API tokens page.** The page imports
   `useCanUseFeature("apiAccess")` and shows the upgrade card to free/plus
   users instead of the mint UI.

3. **Optional: row on `/pricing`.** Add a comparison row "Public API + MCP
   for Claude" with ✓/✓ for Pro/VIP and the lock glyph for Free/Plus. The
   row text and gating live in your existing `/admin/design` CMS if you
   prefer to manage copy there.

4. **Optional: surface on `/app/features`.** Add a card with the
   `apiAccess` key so locked users see what they unlock.

