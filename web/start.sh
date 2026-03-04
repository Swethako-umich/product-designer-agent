#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# Start the Product Designer Agent web interface
# Usage: bash start.sh
# ─────────────────────────────────────────────────────────────────────────────

cd "$(dirname "$0")"

echo ""
echo "🎨  Product Designer Agent — Web Interface"
echo "────────────────────────────────────────────"

# Check Python
if ! command -v python3 &>/dev/null; then
  echo "❌  Python 3 not found. Please install Python 3.11+."
  exit 1
fi

# Install dependencies if needed
if ! python3 -c "import fastapi" &>/dev/null; then
  echo "📦  Installing dependencies…"
  pip install -r requirements.txt
fi

echo "✅  Starting server at http://localhost:8000"
echo "   Open this URL in your browser."
echo "   Press Ctrl+C to stop."
echo ""

python3 server.py
