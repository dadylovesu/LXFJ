# 连续分镜创作AI - VPN代理部署启动器
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  连续分镜创作AI - VPN代理部署启动器" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 检查Node.js
Write-Host "[1/4] 检查Node.js环境..." -ForegroundColor Green
try {
    $nodeVersion = node --version
    Write-Host "✅ Node.js已安装: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Node.js未安装，请先安装Node.js" -ForegroundColor Red
    Read-Host "按Enter键退出"
    exit 1
}
Write-Host ""

# 安装前端依赖
Write-Host "[2/4] 安装前端依赖..." -ForegroundColor Green
if (-not (Test-Path "node_modules")) {
    Write-Host "正在安装前端依赖..."
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ 前端依赖安装失败" -ForegroundColor Red
        Read-Host "按Enter键退出"
        exit 1
    }
} else {
    Write-Host "前端依赖已存在，跳过安装"
}
Write-Host "✅ 前端依赖就绪" -ForegroundColor Green
Write-Host ""

# 安装后端依赖
Write-Host "[3/4] 安装后端依赖..." -ForegroundColor Green
Set-Location server
if (-not (Test-Path "node_modules")) {
    Write-Host "正在安装后端依赖..."
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ 后端依赖安装失败" -ForegroundColor Red
        Set-Location ..
        Read-Host "按Enter键退出"
        exit 1
    }
} else {
    Write-Host "后端依赖已存在，跳过安装"
}
Set-Location ..
Write-Host "✅ 后端依赖就绪" -ForegroundColor Green
Write-Host ""

# 启动服务
Write-Host "[4/4] 启动服务..." -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "🚀 正在启动连续分镜创作AI系统" -ForegroundColor Yellow
Write-Host ""
Write-Host "📡 后端服务器: http://192.168.10.123:3001" -ForegroundColor Magenta
Write-Host "🌐 前端界面: http://192.168.10.123:3000" -ForegroundColor Magenta
Write-Host ""
Write-Host "⚠️  请确保已开启VPN/代理软件" -ForegroundColor Yellow
Write-Host "⚠️  其他用户可通过 http://192.168.10.123:3000 访问" -ForegroundColor Yellow
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan

# 启动前端服务器
$frontendJob = Start-Job -ScriptBlock {
    Set-Location $using:PWD
    npm run dev
} -Name "FrontendServer"

Start-Sleep -Seconds 2

# 启动后端服务器
$backendJob = Start-Job -ScriptBlock {
    Set-Location "$using:PWD\server"
    npm start
} -Name "BackendServer"

Write-Host "✅ 服务启动完成！" -ForegroundColor Green
Write-Host "按Ctrl+C关闭所有服务..." -ForegroundColor Yellow

try {
    # 等待用户中断
    while ($true) {
        Start-Sleep -Seconds 1
    }
} finally {
    Write-Host "正在关闭服务..." -ForegroundColor Yellow

    # 停止作业
    if ($frontendJob) { Stop-Job $frontendJob -ErrorAction SilentlyContinue }
    if ($backendJob) { Stop-Job $backendJob -ErrorAction SilentlyContinue }

    # 强制结束node进程
    Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

    Write-Host "✅ 服务已关闭" -ForegroundColor Green
}