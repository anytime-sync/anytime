# Dev setup — keep your local repo OUT of OneDrive

This repo previously lived under `~/OneDrive/Desktop/TDL/anytime`, which
caused two recurring problems during development:

1. **Stale checkouts.** OneDrive's background sync occasionally rolls
   the working tree back to a previous version. We've already had
   accidental reverts of `task-list-view.tsx` (lost the `groupByDate`
   prop) and the i18n base file (whole pages reverted back to English).
2. **Truncated writes.** Files written mid-sync sometimes ended up
   truncated in the working copy, which deployed as broken builds (you
   can see this in the commit history: "fix truncated quick-add.tsx",
   "reconstruct truncated matrix file", etc.).

## Recommended setup

Move the working repo somewhere OneDrive does not touch:

```bash
# 1) Clone outside OneDrive
mkdir -p ~/code
cd ~/code
git clone https://github.com/anytime-sync/anytime.git
cd anytime

# 2) (Optional) symlink so existing tools that point at the OneDrive
#    path still work, but the source of truth is ~/code/anytime:
mv "$HOME/OneDrive/Desktop/TDL/anytime" "$HOME/OneDrive/Desktop/TDL/anytime.bak"
ln -s "$HOME/code/anytime" "$HOME/OneDrive/Desktop/TDL/anytime"
```

If you must keep editing inside OneDrive, run this **before every session**:

```bash
cd ~/OneDrive/Desktop/TDL/anytime
git fetch origin main
git reset --hard origin/main
```

That guarantees you start from main and not from whatever OneDrive has
silently restored.

## Pre-deploy checks

Before pushing, run these locally — they catch the regressions we've
hit most often:

```bash
npm run lint            # next lint
npm run lint:i18n       # custom: blocks shipping hardcoded English JSX text
npm run typecheck       # tsc --noEmit
npm run build           # full Next build
```

The two new ones — `lint:i18n` and `typecheck` — would have caught:

- The `groupByDate` regression that broke Vercel build (`typecheck`)
- The hardcoded "Groups" sidebar label and other untranslated strings (`lint:i18n`)
