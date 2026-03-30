from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import List
import math
import re


TOKEN_RE = re.compile(r"[A-Za-z0-9_\u3040-\u30ff\u4e00-\u9fff]+")


@dataclass
class Chunk:
    source: str
    text: str
    tf: dict[str, float]


def _tokenize(text: str) -> list[str]:
    return [t.lower() for t in TOKEN_RE.findall(text)]


def _term_freq(tokens: list[str]) -> dict[str, float]:
    freq: dict[str, float] = {}
    if not tokens:
        return freq
    for t in tokens:
        freq[t] = freq.get(t, 0.0) + 1.0
    n = float(len(tokens))
    return {k: v / n for k, v in freq.items()}


class LocalRagIndex:
    def __init__(self, docs_dir: str) -> None:
        self.docs_dir = Path(docs_dir)
        self.chunks: list[Chunk] = []
        self.idf: dict[str, float] = {}

    def build(self) -> None:
        self.chunks = []
        files = sorted(self.docs_dir.rglob("*"))
        docs = [p for p in files if p.suffix.lower() in {".md", ".txt"} and p.is_file()]
        for file_path in docs:
            content = file_path.read_text(encoding="utf-8", errors="ignore")
            for part in self._split_text(content):
                tokens = _tokenize(part)
                if not tokens:
                    continue
                self.chunks.append(
                    Chunk(
                        source=str(file_path),
                        text=part.strip(),
                        tf=_term_freq(tokens),
                    )
                )
        self._build_idf()

    def _split_text(self, text: str, chunk_size: int = 800, overlap: int = 160) -> list[str]:
        text = text.replace("\r\n", "\n").strip()
        if not text:
            return []
        chunks: list[str] = []
        start = 0
        while start < len(text):
            end = min(len(text), start + chunk_size)
            chunks.append(text[start:end])
            if end >= len(text):
                break
            start = max(0, end - overlap)
        return chunks

    def _build_idf(self) -> None:
        df: dict[str, int] = {}
        n_docs = max(len(self.chunks), 1)
        for chunk in self.chunks:
            for term in chunk.tf.keys():
                df[term] = df.get(term, 0) + 1
        self.idf = {term: math.log((1 + n_docs) / (1 + cnt)) + 1.0 for term, cnt in df.items()}

    def search(self, query: str, top_k: int = 4) -> List[Chunk]:
        q_tokens = _tokenize(query)
        q_tf = _term_freq(q_tokens)
        if not q_tf or not self.chunks:
            return []

        def score(chunk: Chunk) -> float:
            s = 0.0
            for term, qv in q_tf.items():
                cv = chunk.tf.get(term, 0.0)
                if cv <= 0:
                    continue
                idf = self.idf.get(term, 1.0)
                s += qv * cv * (idf * idf)
            return s

        ranked = sorted(self.chunks, key=score, reverse=True)
        return [c for c in ranked[:top_k] if score(c) > 0]
