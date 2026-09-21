#!/usr/bin/env bash
set -euo pipefail
: "${GITHUB_SHA:?CI source revision required}"
: "${GITHUB_RUN_ID:?CI run required}"
: "${REVIEW_KIND:?Review category required}"
SOURCE_DIR="$PWD/${1:?Evidence directory required}"
test -d "$SOURCE_DIR" || exit 0
REVIEW_SERIES="${REVIEW_SERIES:-campaign30}"
REVIEW_REF="evidence/${REVIEW_SERIES}-${REVIEW_KIND}-${GITHUB_SHA:0:12}-${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}"
REVIEW_WORK="$(mktemp -d /tmp/campaign-evidence.XXXXXX)"
git worktree add --detach "$REVIEW_WORK" HEAD
git -C "$REVIEW_WORK" switch --orphan "$REVIEW_REF"
# Keep complete MP4 routes, reports and native stills; intermediate JPEG
# sequences are reproducible encoders' inputs and need not be duplicated.
while IFS= read -r -d '' file; do
  relative="${file#"$SOURCE_DIR/"}"
  mkdir -p "$REVIEW_WORK/$(dirname "$relative")"
  cp "$file" "$REVIEW_WORK/$relative"
  git -C "$REVIEW_WORK" add -- "$relative"
done < <(find "$SOURCE_DIR" -type d -name '*-frames' -prune -o -type f \( -name '*.json' -o -name '*.png' -o -name '*.jpg' -o -name '*.mp4' \) -print0)
if git -C "$REVIEW_WORK" diff --cached --quiet; then exit 0; fi
git -C "$REVIEW_WORK" -c user.name='github-actions[bot]' -c user.email='41898282+github-actions[bot]@users.noreply.github.com' commit -m "${REVIEW_SERIES} ${REVIEW_KIND} evidence for $GITHUB_SHA"
git -C "$REVIEW_WORK" push origin "HEAD:refs/heads/$REVIEW_REF"
echo "Review artifacts: $REVIEW_REF" >> "$GITHUB_STEP_SUMMARY"
