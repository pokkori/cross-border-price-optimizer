from __future__ import annotations

from pathlib import Path
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from .config import settings
from .ollama_client import OllamaClient
from .rag import LocalRagIndex


app = FastAPI(title="Personal SLM API", version="0.1.0")
ollama = OllamaClient(settings.ollama_base_url)
rag = LocalRagIndex(settings.docs_dir)


class ChatRequest(BaseModel):
    message: str = Field(min_length=1)
    system_prompt: str | None = None
    use_rag: bool = True
    model: str | None = None
    temperature: float | None = None
    top_p: float | None = None


class ChatResponse(BaseModel):
    answer: str
    used_model: str
    context_sources: list[str]


DEFAULT_SYSTEM_PROMPT = (
    "あなたはローカル実行の個人用SLMです。"
    "ユーザーの指示に忠実に、簡潔かつ実用的に回答してください。"
    "不明点は断定せず確認質問を短く返してください。"
)


def _build_context(question: str) -> tuple[str, list[str]]:
    matches = rag.search(question, top_k=settings.rag_top_k)
    if not matches:
        return "", []
    sources = sorted(list({m.source for m in matches}))
    joined = "\n\n".join(f"[source: {m.source}]\n{m.text}" for m in matches)
    if len(joined) > settings.max_context_chars:
        joined = joined[: settings.max_context_chars]
    return joined, sources


@app.on_event("startup")
def startup() -> None:
    Path(settings.docs_dir).mkdir(parents=True, exist_ok=True)
    rag.build()


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/admin/reload-index")
def reload_index() -> dict[str, int]:
    rag.build()
    return {"chunks": len(rag.chunks)}


@app.post("/chat", response_model=ChatResponse)
def chat(body: ChatRequest) -> ChatResponse:
    try:
        model = body.model or settings.model
        temperature = body.temperature if body.temperature is not None else settings.temperature
        top_p = body.top_p if body.top_p is not None else settings.top_p
        system_prompt = body.system_prompt or DEFAULT_SYSTEM_PROMPT

        context_sources: list[str] = []
        context_block = ""
        if body.use_rag:
            context_block, context_sources = _build_context(body.message)

        prompt = body.message
        if context_block:
            prompt = (
                "以下のローカル資料を参考に回答してください。\n"
                "資料にない内容は推測を避けて回答してください。\n\n"
                f"{context_block}\n\n"
                f"質問: {body.message}\n回答:"
            )

        answer = ollama.generate(
            model=model,
            prompt=prompt,
            system_prompt=system_prompt,
            temperature=temperature,
            top_p=top_p,
        )
        return ChatResponse(answer=answer, used_model=model, context_sources=context_sources)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
