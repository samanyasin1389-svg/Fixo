#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

MODEL="${FIXO_MODEL:-qwen2.5:3b}"
PORT="${PORT:-7860}"

if ! command -v ollama >/dev/null 2>&1; then
  echo "Ollama پیدا نشد. نصب: curl -fsSL https://ollama.com/install.sh | sh"
  exit 1
fi

if ! curl -sf "http://127.0.0.1:11434/api/tags" >/dev/null 2>&1; then
  echo "در حال روشن کردن Ollama…"
  ollama serve >/tmp/ollama-serve.log 2>&1 &
  for _ in $(seq 1 30); do
    if curl -sf "http://127.0.0.1:11434/api/tags" >/dev/null 2>&1; then
      break
    fi
    sleep 0.5
  done
fi

if ! curl -sf "http://127.0.0.1:11434/api/tags" >/dev/null 2>&1; then
  echo "Ollama بالا نیامد. لاگ: /tmp/ollama-serve.log"
  exit 1
fi

if ! ollama list 2>/dev/null | awk 'NR>1 {print $1}' | grep -qx "$MODEL" \
  && ! ollama list 2>/dev/null | awk 'NR>1 {print $1}' | grep -q "^${MODEL%%:*}"; then
  echo "دانلود مدل $MODEL (اولین بار ممکن است چند دقیقه طول بکشد)…"
  ollama pull "$MODEL"
fi

if [[ ! -d .venv ]]; then
  python3 -m venv .venv
fi
# shellcheck disable=SC1091
source .venv/bin/activate
pip install -q -r requirements.txt

export FIXO_MODEL="$MODEL"
echo "Fixo روی http://127.0.0.1:${PORT}"
exec uvicorn app.main:app --host 0.0.0.0 --port "$PORT"
