@echo off
chcp 65001 >nul
title 虚妄编年史 - 启动
cd /d "%~dp0"

echo.
echo ========================================
echo   虚妄编年史 - 正在启动...
echo ========================================
echo.

where node >nul 2>&1
if errorlevel 1 (
    echo [还没装好 Node.js]
    echo.
    echo 请让家人帮你：
    echo   1. 打开 https://nodejs.org
    echo   2. 下载并安装 LTS 版本（绿色按钮）
    echo   3. 安装完成后，重新双击「启动网站.bat」
    echo.
    pause
    exit /b 1
)

echo [1/2] Node.js 已就绪
echo [2/2] 正在打开网站...
echo.
echo   浏览器地址：http://localhost:3000
echo   关闭本窗口即可停止网站
echo.
echo   第一次使用请在网站左下角「API 设置」填入 DeepSeek 密钥
echo.

start "" "http://localhost:3000"
node dev-server.cjs

pause
