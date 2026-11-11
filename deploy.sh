#!/bin/bash
# Optional: push this folder to the git remote so GitHub Pages (or similar) updates.
# Does nothing until a repo with `origin` is configured. Never fails the PnL pipeline.
set -u
cd "$(dirname "$0")"
if [ ! -d .git ]; then
  echo "app deploy skipped: no git repo in app/ — see README.md to connect GitHub Pages"
  exit 0
fi
if ! git remote get-url origin >/dev/null 2>&1; then
  echo "app deploy skipped: no origin remote"
  exit 0
fi
git add -A
if git diff --staged --quiet; then
  echo "app deploy: no file changes"
  exit 0
fi
git -c user.email="pnl-calendar@local" -c user.name="PNL Calendar" commit -m "update $(date -Iseconds)" >/dev/null
if git push origin HEAD; then
  echo "app deploy: pushed to origin"
else
  echo "app deploy skipped: git push failed (connect a free GitHub account / gh auth login)"
fi
exit 0
