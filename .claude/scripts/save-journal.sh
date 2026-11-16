#!/usr/bin/env bash
# Appends the current Claude Code session to docs/journal/YYYY-MM-DD.md

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
JOURNAL_DIR="$REPO_ROOT/docs/journal"
PROJECTS_DIR="$HOME/.claude/projects/-Users-mohit-Ideas-Prism"

# Read session_id from stdin JSON
SESSION_ID=$(jq -r '.session_id // empty' 2>/dev/null)
if [ -z "$SESSION_ID" ]; then
  exit 0
fi

JSONL="$PROJECTS_DIR/${SESSION_ID}.jsonl"
if [ ! -f "$JSONL" ]; then
  exit 0
fi

DATE=$(date +%Y-%m-%d)
TIME=$(date +%H:%M)
OUT="$JOURNAL_DIR/${DATE}.md"

mkdir -p "$JOURNAL_DIR"

# Append session header
{
  echo ""
  echo "---"
  echo ""
  echo "## Session — ${DATE} ${TIME}"
  echo ""

  # Extract user and assistant text turns
  python3 - "$JSONL" <<'PYEOF'
import sys, json

path = sys.argv[1]
with open(path) as f:
    for line in f:
        line = line.strip()
        if not line:
            continue
        try:
            obj = json.loads(line)
        except Exception:
            continue

        msg = obj.get("message", {})
        role = msg.get("role", "")
        if role not in ("user", "assistant"):
            continue

        content = msg.get("content", "")
        text = ""
        if isinstance(content, str):
            text = content.strip()
        elif isinstance(content, list):
            parts = []
            for c in content:
                if isinstance(c, dict) and c.get("type") == "text":
                    t = c.get("text", "").strip()
                    if t:
                        parts.append(t)
            text = "\n\n".join(parts)

        if not text:
            continue

        label = "**You**" if role == "user" else "**Claude**"
        print(f"{label}\n")
        print(text)
        print()
PYEOF
} >> "$OUT"
