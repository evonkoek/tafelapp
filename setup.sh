#!/usr/bin/env bash
# Gebruik:  bash setup.sh [repo-naam]
# Vereist: git, uv en gh (GitHub CLI), en eenmalig `gh auth login`.
set -euo pipefail
REPO="${1:-tafelapp}"

gh auth status
uv sync
uv run pytest -q

git init -b main
git add .
git commit -m "Eerste versie TafelApp"

gh repo create "$REPO" --public --source=. --remote=origin
OWNER="$(gh api user --jq .login)"

# GitHub Pages aanzetten met GitHub Actions als bron
gh api -X POST "repos/$OWNER/$REPO/pages" -f build_type=workflow \
  || gh api -X PUT "repos/$OWNER/$REPO/pages" -f build_type=workflow

git push -u origin main

echo
echo "Klaar. Na 1-2 minuten live op: https://$OWNER.github.io/$REPO/"
echo "Voortgang:  gh run watch"
