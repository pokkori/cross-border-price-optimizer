# Personal SLM (High-Freedom Local Setup)

このディレクトリは、個人利用向けのローカル SLM サーバーです。  
`Ollama` の小型モデルを使い、必要に応じて `docs/` の資料を検索して回答します。

## 特徴

- ローカル完結（クラウド必須なし）
- モデル/温度/system prompt をAPIごとに可変
- 任意でRAG（ローカル資料検索）をON/OFF
- 最小構成で編集しやすい

## 事前準備

1. [Ollama](https://ollama.com/download) をインストール
2. モデルを取得

```bash
ollama pull qwen2.5:3b-instruct
```

## 起動方法（Windows）

```bash
start.cmd
```

初回は仮想環境作成と依存インストールを自動で行います。  
起動後のAPIドキュメント: `http://127.0.0.1:8008/docs`

## API

### `POST /chat`

例:

```json
{
  "message": "越境ECの利益計算ロジックを短く説明して",
  "use_rag": true,
  "temperature": 0.7
}
```

### `POST /admin/reload-index`

`docs/` 配下の `.md` / `.txt` を再読み込みします。  
資料を追加・更新したら呼び出してください。

## カスタマイズ

- デフォルト値は `.env.example` を `.env` にコピーして変更
- `SLM_MODEL` を他のローカルモデルに変更可能
- `app/main.py` の `DEFAULT_SYSTEM_PROMPT` をあなた向けに調整

## 注意

- これは個人向けツールです。利用責任は利用者にあります。
- 大きな文書や高精度検索が必要なら、埋め込みモデル型RAGへ拡張可能です。
