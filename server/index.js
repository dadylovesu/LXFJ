import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';
import { GoogleGenAI } from '@google/genai';
import { ProxyAgent } from 'undici';

dotenv.config({ path: './env.config' });

// 配置代理（如果环境变量中有设置）
const proxyUrl = process.env.HTTP_PROXY || process.env.HTTPS_PROXY;
if (proxyUrl) {
  console.log(`📡 检测到代理配置: ${proxyUrl}`);
  // 为 fetch 设置全局代理
  global[Symbol.for('undici.globalDispatcher.1')] = new ProxyAgent(proxyUrl);
}

const app = express();
const PORT = process.env.PORT || 3001;

// 中间件
// 中间件
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  optionsSuccessStatus: 204
}));
// 显式处理预检与响应头，避免代理/内网穿透丢失 CORS 头
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,PATCH,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// 创建 Google GenAI 客户端
let genAIClient = null;

const getGenAIClient = () => {
  if (!genAIClient) {
    genAIClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return genAIClient;
};

// ============ Google Gemini API 代理路由 ============

// 代理 Gemini generateContent 请求
app.post('/api/gemini/generate', async (req, res) => {
  try {
    const { model, contents, config } = req.body;
    
    const ai = getGenAIClient();
    
    // 构建请求参数
    const requestParams = { model };
    
    // 处理 contents：如果是对象（如 { parts: [...] }），直接使用；如果是字符串，包装成对象
    if (typeof contents === 'string') {
      requestParams.contents = [{ role: 'user', parts: [{ text: contents }] }];
    } else if (contents && contents.parts) {
      // requestParams.contents = [{ role: 'user', parts: contents.parts }];
      // 前端直连时使用 { parts: [...] }，这里不要强行包一层 role
      requestParams.contents = contents;
    } else if (Array.isArray(contents)) {
      requestParams.contents = contents;
    } else {
      requestParams.contents = [{ role: 'user', parts: [{ text: String(contents) }] }];
    }
    
    // 添加配置（如果有）
    if (config) {
      requestParams.config = config;
    }
    
    console.log('调用 Gemini API，模型:', model);
    const response = await ai.models.generateContent(requestParams);
    
    // 提取文本内容并添加到响应对象中，以保持与客户端代码的兼容性
    let extractedText = '';
    if (response.candidates && response.candidates.length > 0) {
      const parts = response.candidates[0]?.content?.parts || [];
      for (const part of parts) {
        if (part.text) {
          extractedText += part.text;
        }
      }
    }
    
    // 返回原始响应，但添加便捷的 text 属性
    const responseWithText = {
      ...response,
      text: extractedText
    };
    
    res.json(responseWithText);
  } catch (error) {
    console.error('Gemini API 错误:', error);
    console.error('错误详情:', error.stack);
    res.status(error.status || 500).json({
      error: error.message || '生成内容失败',
      details: error.toString()
    });
  }
});

// ============ RunningHub API 代理路由 ============

// 创建 RunningHub axios 实例
const runningHubClient = axios.create({
  baseURL: 'https://www.i-oranges.com/cyinside',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  }
});

// RunningHub 请求拦截器
runningHubClient.interceptors.request.use(
  (config) => {
    // 如果请求头中有 Authorization，保持它
    // 否则从服务器环境变量获取（如果需要的话）
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// RunningHub 响应拦截器
runningHubClient.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('RunningHub API 错误:', error);
    return Promise.reject(error);
  }
);

// 代理所有 RunningHub API 请求
app.all('/api/runninghub/*', async (req, res) => {
  try {
    const path = req.path.replace('/api/runninghub', '');
    const config = {
      method: req.method,
      url: path,
      data: req.body,
      params: req.query,
      headers: {
        ...req.headers,
        host: undefined,
        'content-length': undefined,
      }
    };

    const response = await runningHubClient.request(config);
    res.status(response.status).json(response.data);
  } catch (error) {
    console.error('RunningHub 代理错误:', error);
    res.status(error.response?.status || 500).json({
      error: error.message || 'RunningHub API 调用失败',
      details: error.response?.data || error.toString()
    });
  }
});

// 健康检查接口
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    gemini_api: process.env.GEMINI_API_KEY ? '已配置' : '未配置',
    runninghub_api: process.env.RUNNINGHUB_API_KEY ? '已配置' : '未配置',
    timestamp: new Date().toISOString()
  });
});

// 启动服务器
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n========================================`);
  console.log(`🚀 代理服务器已启动`);
  console.log(`📡 监听地址: http://0.0.0.0:${PORT}`);
  console.log(`🌐 局域网访问: http://192.168.10.134:${PORT}`);
  console.log(`✅ CORS: 已启用（允许所有来源）`);
  console.log(`🔑 Gemini API: ${process.env.GEMINI_API_KEY ? '已配置' : '未配置'}`);
  console.log(`🔑 RunningHub API: ${process.env.RUNNINGHUB_API_KEY ? '已配置' : '未配置'}`);
  console.log(`========================================\n`);
});

// 错误处理
process.on('uncaughtException', (error) => {
  console.error('未捕获的异常:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('未处理的 Promise 拒绝:', reason);
});
