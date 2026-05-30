@echo off
chcp 65001 >nul
echo ========================================
echo   手作珠宝电商 - 完整版环境安装向导
echo ========================================
echo.

REM 检查PostgreSQL
echo [1/4] 检查 PostgreSQL...
where psql >nul 2>&1
if %errorlevel% equ 0 (
    echo ✓ PostgreSQL 已安装
    psql --version
) else (
    echo ✗ PostgreSQL 未安装
    echo.
    echo 请下载安装:
    echo https://www.postgresql.org/download/windows/
    echo.
    set /p install_pg="是否继续配置其他组件? (y/n): "
    if /i not "%install_pg%"=="y" exit /b
)
echo.

REM 检查Redis
echo [2/4] 检查 Redis...
where redis-cli >nul 2>&1
if %errorlevel% equ 0 (
    echo ✓ Redis 已安装
    redis-cli ping
) else (
    echo ✗ Redis 未安装
    echo.
    echo 推荐使用 Docker 安装:
    echo docker run -d -p 6379:6379 --name redis redis:latest
    echo.
)
echo.

REM 检查后端依赖
echo [3/4] 检查后端依赖...
cd /d "%~dp0handmade-jewelry-backend"
if exist "node_modules" (
    echo ✓ 后端依赖已安装
) else (
    echo ⚙ 正在安装后端依赖...
    call npm install
)
echo.

REM 创建数据库(如果PostgreSQL已安装)
echo [4/4] 配置数据库...
where psql >nul 2>&1
if %errorlevel% equ 0 (
    echo 请输入PostgreSQL密码(默认: postgres):
    set /p pg_password="密码: "
    
    echo 创建数据库...
    psql -U postgres -c "CREATE DATABASE handmade_jewelry;" 2>nul
    if %errorlevel% equ 0 (
        echo ✓ 数据库创建成功
    ) else (
        echo ⚠ 数据库可能已存在
    )
    
    echo 导入Schema...
    psql -U postgres -d handmade_jewelry -f database/schema.sql
    if %errorlevel% equ 0 (
        echo ✓ Schema导入成功
    ) else (
        echo ✗ Schema导入失败
    )
) else (
    echo ⚠ 跳过数据库配置(PostgreSQL未安装)
)
echo.

echo ========================================
echo   安装完成!
echo ========================================
echo.
echo 下一步:
echo 1. 编辑 handmade-jewelry-backend\.env
echo 2. 设置 NO_DB_MODE=false
echo 3. 配置数据库密码
echo 4. 运行: npm run dev
echo.
pause
