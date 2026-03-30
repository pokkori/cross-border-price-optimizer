@echo off
chcp 65001 >nul
cd /d "%~dp0"

if not exist ".venv" (
  py -m venv .venv
)

call ".venv\Scripts\activate"
python -m pip install --upgrade pip
pip install -r requirements.txt

echo.
echo ========================================
echo  Personal SLM API を起動します
echo  http://127.0.0.1:8008/docs
echo ========================================
echo.
echo 事前に Ollama を起動し、モデルをpullしてください:
echo   ollama pull qwen2.5:3b-instruct
echo.

uvicorn app.main:app --host 127.0.0.1 --port 8008 --reload
