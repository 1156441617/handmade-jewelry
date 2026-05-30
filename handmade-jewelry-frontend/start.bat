@echo off
chcp 65001 >nul
echo ========================================
echo   手作珠宝电商平台 - 前端启动脚本
echo ========================================
echo.

REM 检查Python是否安装
where python >nul 2>&1
if %errorlevel% equ 0 (
    echo [方法1] 使用Python启动本地服务器...
    echo.
    cd /d "%~dp0"
    start http://localhost:8080
    python -m http.server 8080
    goto :end
)

REM 检查Node.js是否安装
where node >nul 2>&1
if %errorlevel% equ 0 (
    echo [方法2] 使用Node.js启动本地服务器...
    echo.
    cd /d "%~dp0"
    start http://localhost:8080
    npx http-server -p 8080
    goto :end
)

echo 未检测到Python或Node.js环境
echo.
echo 请安装以下任一环境:
echo 1. Python: https://www.python.org/downloads/
echo 2. Node.js: https://nodejs.org/
echo.
echo 或者直接双击 index.html 文件在浏览器中打开
echo.

:end
pause
