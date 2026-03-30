from __future__ import annotations

import requests


class OllamaClient:
    def __init__(self, base_url: str) -> None:
        self.base_url = base_url.rstrip("/")

    def generate(
        self,
        model: str,
        prompt: str,
        system_prompt: str,
        temperature: float = 0.8,
        top_p: float = 0.95,
    ) -> str:
        url = f"{self.base_url}/api/generate"
        payload = {
            "model": model,
            "prompt": prompt,
            "system": system_prompt,
            "stream": False,
            "options": {
                "temperature": temperature,
                "top_p": top_p,
            },
        }
        res = requests.post(url, json=payload, timeout=120)
        res.raise_for_status()
        data = res.json()
        return data.get("response", "").strip()
