from __future__ import annotations

import os
from dataclasses import dataclass
from dotenv import load_dotenv


load_dotenv()


def _as_float(name: str, default: float) -> float:
    raw = os.getenv(name)
    if raw is None:
        return default
    try:
        return float(raw)
    except ValueError:
        return default


def _as_int(name: str, default: int) -> int:
    raw = os.getenv(name)
    if raw is None:
        return default
    try:
        return int(raw)
    except ValueError:
        return default


@dataclass(frozen=True)
class Settings:
    ollama_base_url: str = os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434")
    model: str = os.getenv("SLM_MODEL", "qwen2.5:3b-instruct")
    temperature: float = _as_float("SLM_TEMPERATURE", 0.8)
    top_p: float = _as_float("SLM_TOP_P", 0.95)
    max_context_chars: int = _as_int("SLM_MAX_CONTEXT_CHARS", 12000)
    docs_dir: str = os.getenv("RAG_DOCS_DIR", "./docs")
    rag_top_k: int = _as_int("RAG_TOP_K", 4)


settings = Settings()
