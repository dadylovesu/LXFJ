@echo off
echo ========================================
echo   连续分镜创作AI - VPN代理部署启动器
echo ========================================
echo.

echo [1/4] 检查Node.js环境...
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js未安装，请先安装Node.js
    pause
    exit /b 1
)
echo ✅ Node.js已安装
echo.

echo [2/4] 安装前端依赖...
if not exist "node_modules" (
    echo 正在安装前端依赖...
    npm install
    if errorlevel 1 (
        echo ❌ 前端依赖安装失败
        pause
        exit /b 1
    )
) else (
    echo 前端依赖已存在，跳过安装
)
echo ✅ 前端依赖就绪
echo.

echo [3/4] 安装后端依赖...
cd server
if not exist "node_modules" (
    echo 正在安装后端依赖...
    npm install
    if errorlevel 1 (
        echo ❌ 后端依赖安装失败
        cd ..
        pause
        exit /b 1
    )
) else (
    echo 后端依赖已存在，跳过安装
)
cd ..
echo ✅ 后端依赖就绪
echo.

echo [4/4] 启动服务...
echo ========================================
echo 🚀 正在启动连续分镜创作AI系统
echo.
echo 📡 后端服务器: http://192.168.10.123:3001
echo 🌐 前端界面: http://192.168.10.123:3000
echo.
echo ⚠️  请确保已开启VPN/代理软件
echo ⚠️  其他用户可通过 http://192.168.10.123:3000 访问
echo.
echo ========================================

start "前端服务器" cmd /k "npm run dev"
timeout /t 2 /nobreak >nul
start "后端服务器" cmd /k "cd server && npm start"

echo ✅ 服务启动完成！
echo 按任意键关闭所有服务...
pause >nul

echo 正在关闭服务...
taskkill /f /im node.exe >nul 2>&1
echo ✅ 服务已关闭