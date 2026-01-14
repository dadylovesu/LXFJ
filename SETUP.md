# VPN代理部署指南

## 一、配置后端代理服务器

### 1. 在 server 文件夹创建 `.env` 文件

```env
# Google Gemini API Key
GEMINI_API_KEY=AIzaSyD_FHm_-glkscHRNgzXzoo5awsftsJTkwa

# RunningHub API Key
RUNNINGHUB_API_KEY=85ee0d163d9f48848d2ee54abf9438da

# 服务器端口
PORT=3001

# ⚠️ 重要：配置代理以访问 Google API
# 如果你使用本地代理软件（如 Clash、V2Ray、SSR 等），请添加以下配置：
HTTP_PROXY=http://127.0.0.1:7890
HTTPS_PROXY=http://127.0.0.1:7890

# 常见代理端口参考：
# - Clash: 7890
# - V2Ray: 10809  
# - SSR: 1080
# 请根据你的代理软件实际端口进行配置
```

**注意事项：**
- 如果服务器机器已开启**全局 VPN**，可以不配置 `HTTP_PROXY` 和 `HTTPS_PROXY`
- 如果使用**本地代理软件**（Clash、V2Ray 等），**必须**配置代理环境变量
- 确保代理软件已启动且端口正确

### 2. 安装后端依赖并启动

打开终端，执行：

```powershell
cd server
npm install
npm start
```

服务器将在 `http://192.168.10.123:3001` 启动。

---

## 二、配置前端环境

### 在项目根目录的 `.env.local` 文件中添加：

```env
# 原有配置
GEMINI_API_KEY=AIzaSyD_FHm_-glkscHRNgzXzoo5awsftsJTkwa
VITE_RUNNINGHUB_API_KEY=85ee0d163d9f48848d2ee54abf9438da

# 新增：后端代理服务器地址
VITE_PROXY_SERVER=http://192.168.10.123:3001
```

### 启动前端项目

打开新终端，执行：

```powershell
npm install
npm run dev
```

前端将在 `http://192.168.10.123:3002` 启动。

---

## 三、验证部署

1. **检查后端服务**：访问 `http://192.168.10.123:3001/health`，应看到状态信息

2. **局域网访问**：其他电脑通过 `http://192.168.10.123:3002` 访问项目即可使用

---

## 工作原理

- 所有 Google Gemini API 调用通过后端 `/api/gemini/generate` 代理
- 所有 RunningHub API 调用通过后端 `/api/runninghub/*` 代理
- 只需部署机器开启VPN，其他电脑无需VPN即可访问

