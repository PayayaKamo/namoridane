@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

echo ==========================================
echo   Namori 绘日记 · 本地启动
echo ==========================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [错误] 未找到 Node.js，请先安装 Node.js 18 或更高版本。
  echo        下载地址：https://nodejs.org/
  pause
  exit /b 1
)

if not exist node_modules (
  echo [1/3] 首次运行，正在安装依赖...
  call npm install
  if errorlevel 1 (
    echo [错误] 依赖安装失败，请检查网络或 npm 源。
    pause
    exit /b 1
  )
) else (
  echo [1/3] 依赖已安装，跳过。
)

echo [2/3] 检查并生成图片索引与衍生图（增量执行）...
call npm run data
if errorlevel 1 (
  echo [错误] 数据生成失败，请确认 images\original 或 ..\namoridane 目录存在。
  pause
  exit /b 1
)

echo [3/3] 启动本地开发服务器...
echo.
echo   浏览器将打开 http://localhost:5173/
echo   关闭此窗口即可停止服务。
echo.
start "" http://localhost:5173/
call npm run dev -- --open
pause
