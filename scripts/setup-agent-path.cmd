@echo off
chcp 65001 >nul
setlocal
:: Cursor のターミナルラッパーが日本語パスで失敗するため、
:: ASCII のみのパス C:\dev\ec-agent をプロジェクトへリンクする。
:: また C:\dev\start-ec.cmd で実パスから npm run dev を起動できるようにする。
cd /d "%~dp0.."
set "PROJECT_PATH=%CD%"
if not exist "C:\dev" mkdir "C:\dev"

if not exist "C:\dev\ec-agent" (
  mklink /J "C:\dev\ec-agent" "%PROJECT_PATH%"
  if %ERRORLEVEL% neq 0 echo Junction failed. Try "Run as Administrator".
) else (
  echo C:\dev\ec-agent already exists.
)

:: 起動用ランチャー（実パスで実行するため Next.js のパス不具合を避ける）
echo @echo off > "C:\dev\start-ec.cmd"
echo cd /d "%PROJECT_PATH%" >> "C:\dev\start-ec.cmd"
echo npm run dev >> "C:\dev\start-ec.cmd"
echo Created: C:\dev\start-ec.cmd - agent can start app with this.
endlocal
