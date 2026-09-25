"""Fixo — local chatbot backed by Ollama."""

from __future__ import annotations

import os
from pathlib import Path
from typing import AsyncIterator, Literal

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

OLLAMA_BASE = os.getenv("OLLAMA_BASE", "http://127.0.0.1:11434")
DEFAULT_MODEL = os.getenv("FIXO_MODEL", "qwen2.5:3b")
STATIC_DIR = Path(__file__).resolve().parent.parent / "static"

SYSTEM_PROMPT = (
    "تو Fixo هستی؛ یک دستیار هوشمند محلی و مفید. "
    "به زبان کاربر جواب بده. اگر فارسی پرسید، فارسی روان و کوتاه جواب بده. "
    "اگر چیزی را نمی‌دانی، صادقانه بگو."
)

app = FastAPI(title="Fixo", version="1.0.0")
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


class ChatMessage(BaseModel):
    role: Literal["user", "assistant", "system"]
    content: str = Field(min_length=1, max_length=8000)


class ChatRequest(BaseModel):
    messages: list[ChatMessage] = Field(min_length=1, max_length=40)
    model: str | None = None


@app.get("/", response_class=HTMLResponse)
async def index() -> HTMLResponse:
    index_path = STATIC_DIR / "index.html"
    return HTMLResponse(index_path.read_text(encoding="utf-8"))


@app.get("/api/health")
async def health() -> dict:
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            r = await client.get(f"{OLLAMA_BASE}/api/tags")
            r.raise_for_status()
            models = [m.get("name", "") for m in r.json().get("models", [])]
            ready = any(
                DEFAULT_MODEL == name or name.startswith(f"{DEFAULT_MODEL}:")
                or name.startswith(DEFAULT_MODEL.split(":")[0])
                for name in models
            )
            return {
                "ok": True,
                "ollama": True,
                "model": DEFAULT_MODEL,
                "model_ready": ready,
                "models": models,
            }
    except Exception as exc:  # noqa: BLE001
        return {
            "ok": False,
            "ollama": False,
            "model": DEFAULT_MODEL,
            "model_ready": False,
            "error": str(exc),
        }


async def stream_ollama(payload: dict) -> AsyncIterator[str]:
    async with httpx.AsyncClient(timeout=None) as client:
        async with client.stream(
            "POST", f"{OLLAMA_BASE}/api/chat", json=payload
        ) as response:
            if response.status_code >= 400:
                body = await response.aread()
                raise HTTPException(
                    status_code=502,
                    detail=f"Ollama error ({response.status_code}): {body.decode()}",
                )
            async for line in response.aiter_lines():
                if line:
                    yield f"{line}\n"


@app.post("/api/chat")
async def chat(req: ChatRequest) -> StreamingResponse:
    model = req.model or DEFAULT_MODEL
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    messages.extend(m.model_dump() for m in req.messages)

    payload = {
        "model": model,
        "messages": messages,
        "stream": True,
        "options": {
            "temperature": 0.7,
            "num_ctx": 2048,
        },
    }

    # Fail fast if Ollama is down
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            ping = await client.get(f"{OLLAMA_BASE}/api/tags")
            ping.raise_for_status()
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=503,
            detail=(
                "Ollama در دسترس نیست. اول سرویس را روشن کن: "
                "`ollama serve` سپس `ollama pull qwen2.5:3b`. "
                f"جزئیات: {exc}"
            ),
        ) from exc

    return StreamingResponse(
        stream_ollama(payload),
        media_type="application/x-ndjson",
    )
