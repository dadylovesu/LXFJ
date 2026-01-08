
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { AspectRatio, ImageSize, Asset, CollageData, PanelAspectRatio, LensLabParams } from "../types";

export const ensureApiKey = async () => {
  // 首先检查用户是否已登录
  const token = localStorage.getItem("cine_auth_token");
  if (!token) {
    setTimeout(() => {
      window.location.reload();
    }, 2500);

    throw new Error("请重新登录");
  }
  // @ts-ignore
  if (window.aistudio && window.aistudio.hasSelectedApiKey) {
    // @ts-ignore
    const hasKey = await window.aistudio.hasSelectedApiKey();
    if (!hasKey) {
      // @ts-ignore
      await window.aistudio.openSelectKey();
    }
  }
};

const getFreshClient = () => {
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

async function withRetry<T>(operation: () => Promise<T>, maxRetries = 4): Promise<T> {
  let lastError: any;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      const errorMsg = error?.message || String(error);
      const statusCode = error?.status || error?.code;
      const isOverloaded = statusCode === 'UNAVAILABLE' || statusCode === 'DEADLINE_EXCEEDED' || statusCode === 503 || statusCode === 504 || errorMsg.includes("503") || errorMsg.includes("504") || errorMsg.includes("Deadline expired") || errorMsg.includes("DEADLINE_EXCEEDED") || errorMsg.includes("UNAVAILABLE");
      const isRateLimited = statusCode === 'RESOURCE_EXHAUSTED' || statusCode === 429 || errorMsg.includes("429") || errorMsg.includes("RESOURCE_EXHAUSTED");

      if ((isOverloaded || isRateLimited) && attempt < maxRetries) {
        const baseDelay = isOverloaded ? 4000 : 2000; 
        const delay = Math.pow(1.5, attempt) * baseDelay + Math.random() * 2000;
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

const sliceImageGrid = (base64Data: string, rows: number, cols: number): Promise<string[]> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => {
      const w = img.width;
      const h = img.height;
      const pieceWidth = w / cols;
      const pieceHeight = h / rows;
      const pieces: string[] = [];
      const canvas = document.createElement('canvas');
      canvas.width = pieceWidth;
      canvas.height = pieceHeight;
      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) return reject(new Error("Canvas error"));
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            ctx.clearRect(0, 0, pieceWidth, pieceHeight);
            ctx.drawImage(img, c * pieceWidth, r * pieceHeight, pieceWidth, pieceHeight, 0, 0, pieceWidth, pieceHeight);
            pieces.push(canvas.toDataURL('image/png', 1.0));
        }
      }
      resolve(pieces);
    };
    img.onerror = () => reject(new Error("Image load error"));
    img.src = base64Data;
  });
};

export interface ReferenceImageData {
  mimeType: string;
  data: string;
  category: 'role' | 'background' | 'prop' | 'style';
  roleIndex?: number;
}

// 定义统一的五维度脚本指南
const FIVE_DIMENSION_SCRIPT_GUIDE = `
每一个分镜必须严格按照以下 5 维度格式输出（必须使用中文）：
1. [环境信息]：描述场景发生的时间、光效氛围、环境核心色调及建筑/自然特征。
2. [镜头语言]：明确镜头的景别（如：特写 CU、中景 MCU、远景 WS、大远景 VWS）以及具体的构图逻辑（如：三分法、对称式、黄金分割）。
3. [镜头视角与焦段]：设定摄像机的视角（平视/俯视/仰视/倾斜）以及模拟焦段（如：24mm广角、35mm标准、85mm人像、200mm长焦）。
4. [动态状态]：描述镜头的运镜方式（推拉摇移、手持震颤、跟随拍摄）或画面中主体的动态趋势。
5. [角色构图元素]：描述角色在画面中的相对坐标（如：(0.3, 0.5)）、角色在画面中的占比描述、角色朝向、视线焦点以及具体的动作细节描述。
`;

export const generateLensLabSequence = async (
  anchorImageBase64: string,
  gridSize: number,
  params: LensLabParams[],
  panelAspectRatio: PanelAspectRatio,
  containerAspectRatio: AspectRatio,
  imageSize: ImageSize,
  stylePrompt?: string,
  styleRefImage?: string
): Promise<{ fullImage: string, slices: string[], panelPrompts: string[] }> => {
  await ensureApiKey();
  const panelPrompts = params.map((p, i) => {
    let pitchDesc = p.pitch > 0 ? `俯视角 ${p.pitch}度` : (p.pitch < 0 ? `仰角 ${Math.abs(p.pitch)}度` : "水平视角");
    let yawDesc = p.yaw > 0 ? `向右旋转 ${p.yaw}度视角` : (p.yaw < 0 ? `向左旋转 ${Math.abs(p.yaw)}度视角` : "正前方视角");
    return `使用 ${p.focalLength}mm 镜头拍摄。镜头角度：${pitchDesc}，${yawDesc}。画面内容必须基于参考图进行视角转换，保持角色和环境一致。`;
  });
  const panelDescriptionsText = panelPrompts.map((p, i) => `分镜 ${i + 1}: ${p}`).join("\n");
  let styleInstruction = stylePrompt && stylePrompt.trim() ? `[视觉风格核心指令]: 严格锁定风格为: "${stylePrompt}"。` : "[视觉风格]: 高级电影质感，35mm 胶片摄影风格。";
  if (styleRefImage) styleInstruction += " [绝对风格参照]: 提供的‘风格参考图’是唯一的视觉准则。必须1:1复刻其调色方案、光影对比度、影调氛围、画面颗粒感和艺术质感。";
  const systemPrompt = `[核心任务]: 3D 多角度一致性重绘。[参考基准]: 你将获得一张名为“锚点”的参考图。[任务逻辑]: 保持锚点图中的角色、环境、光影不变。仅根据焦段、俯仰角、旋转角重新渲染每一格画面。\n\n${styleInstruction}\n\n[布局]: ${gridSize}x${gridSize} 宫格。[比例]: 容器比例 ${containerAspectRatio}, 单格比例 ${panelAspectRatio}。\n\n[分镜指令]:\n${panelDescriptionsText}`;
  const parts: any[] = [{ inlineData: { mimeType: 'image/png', data: anchorImageBase64 } }];
  if (styleRefImage) parts.push({ inlineData: { mimeType: 'image/png', data: styleRefImage.split(',')[1] } });
  parts.push({ text: systemPrompt });
  try {
    const response = await withRetry<GenerateContentResponse>(() => {
        const ai = getFreshClient();
        return ai.models.generateContent({ model: 'gemini-3-pro-image-preview', contents: { parts }, config: { imageConfig: { aspectRatio: containerAspectRatio as any, imageSize: imageSize as any } } });
    });
    let fullImageBase64 = '';
    for (const part of response.candidates?.[0]?.content?.parts || []) { if (part.inlineData) fullImageBase64 = `data:image/png;base64,${part.inlineData.data}`; }
    if (!fullImageBase64) throw new Error("No image generated.");
    const panels = await sliceImageGrid(fullImageBase64, gridSize, gridSize);
    return { fullImage: fullImageBase64, slices: panels, panelPrompts };
  } catch (error: any) { throw error; }
};

export const generateMultiViewGrid = async (
  prompt: string, gridSize: number, panelAspectRatio: PanelAspectRatio, containerAspectRatio: AspectRatio, imageSize: ImageSize, categorizedRefs: ReferenceImageData[] = [], contextImage?: string, panelInstructions?: string[], collageRef?: CollageData, stylePrompt?: string, styleRefImage?: string
): Promise<{ fullImage: string, slices: string[] }> => {
  await ensureApiKey();
  const bgs = categorizedRefs.filter(r => r.category === 'background');
  const roles = categorizedRefs.filter(r => r.category === 'role');
  const props = categorizedRefs.filter(r => r.category === 'prop');
  
  const hasBgRef = bgs.length > 0;
  const hasPanelScripts = panelInstructions && panelInstructions.length > 0;

  // 核心逻辑升级：处理环境参考图与脚本的融合
  let environmentFusionInstruction = "";
  if (hasBgRef && hasPanelScripts) {
    environmentFusionInstruction = `
[ENVIRONMENT FUSION - CRITICAL]: 
1. 检测到已提供“环境参考图”。该图定义了分镜的唯一物理舞台（Stage）。
2. 下方[分镜详细指令]中的“[环境信息]”必须服从于“环境参考图”。
3. 严禁生成参考图之外的新环境结构。如果脚本描述了“夜晚”，则在参考图的物理结构基础上进行夜间光效渲染，而不是更换场景。
4. 保持所有宫格在视觉空间上的绝对连贯，所有的镜头切换都发生在这个确定的物理空间内。`;
  } else if (hasBgRef) {
    environmentFusionInstruction = `[ENVIRONMENT]: 严格复刻提供的环境参考图作为场景背景。`;
  }

  const isVertical = panelAspectRatio === PanelAspectRatio.P9_16 || panelAspectRatio === PanelAspectRatio.P3_4;
  let compositionInstruction = isVertical ? `MANDATORY: Use EDGE-TO-EDGE VERTICAL COMPOSITION.` : "MANDATORY: Use CINEMATIC WIDESCREEN with ZERO LETTERBOXING.";
  
  let styleInstruction = stylePrompt && stylePrompt.trim() ? `[MANDATORY STYLE]: "${stylePrompt}".` : `[STYLE]: Hyper-realistic cinematic film.`;
  if (styleRefImage) styleInstruction = `[VISUAL ANCHOR]: Match EXACT color/lighting of style reference.`;

  let systemPrompt = `[CORE TASK]: GENERATE A SEAMLESS ${gridSize}x${gridSize} STORYBOARD GRID.
[FORMAT]: ${panelAspectRatio}. CANVAS: ${containerAspectRatio}. ${compositionInstruction}
${styleInstruction}
${environmentFusionInstruction}

[SCENE BASE PROMPT]: "${prompt}"

${hasPanelScripts && !collageRef ? `\n[PANEL DETAILED SCRIPTS]:\n${panelInstructions.map((instr, idx) => `Panel ${idx + 1}: ${instr}`).join('\n')}` : ''}`;

  const parts: any[] = [];
  roles.forEach(r => parts.push({ inlineData: { mimeType: r.mimeType, data: r.data } }));
  bgs.forEach(b => parts.push({ inlineData: { mimeType: b.mimeType, data: b.data } }));
  props.forEach(p => parts.push({ inlineData: { mimeType: p.mimeType, data: p.data } }));
  if (styleRefImage) parts.push({ inlineData: { mimeType: 'image/png', data: styleRefImage.split(',')[1] } });
  if (collageRef) parts.push({ inlineData: { mimeType: 'image/png', data: collageRef.url.split(',')[1] } });
  if (contextImage) parts.push({ inlineData: { mimeType: 'image/png', data: contextImage.split(',')[1] } });
  parts.push({ text: systemPrompt });

  try {
    const response = await withRetry<GenerateContentResponse>(() => {
        const ai = getFreshClient();
        return ai.models.generateContent({ model: 'gemini-3-pro-image-preview', contents: { parts }, config: { imageConfig: { aspectRatio: containerAspectRatio as any, imageSize: imageSize as any } } });
    });
    let fullImageBase64 = '';
    for (const part of response.candidates?.[0]?.content?.parts || []) { if (part.inlineData) fullImageBase64 = `data:image/png;base64,${part.inlineData.data}`; }
    if (!fullImageBase64) throw new Error("No image generated.");
    const panels = await sliceImageGrid(fullImageBase64, gridSize, gridSize);
    return { fullImage: fullImageBase64, slices: panels };
  } catch (error: any) { throw error; }
};

export const editImage = async (
  base64Image: string, editPrompt: string, modelName: 'gemini-2.5-flash-image' | 'gemini-3-pro-image-preview', aspectRatio: string = '1:1', refImageBase64?: string, imageSize: ImageSize = ImageSize.K1, stylePrompt?: string, styleRefImage?: string
): Promise<string> => {
  await ensureApiKey();
  const cleanBase64 = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;
  const parts: any[] = [{ inlineData: { mimeType: 'image/png', data: cleanBase64 } }];
  if (refImageBase64) parts.push({ inlineData: { mimeType: 'image/png', data: refImageBase64.split(',')[1] } });
  if (styleRefImage) parts.push({ inlineData: { mimeType: 'image/png', data: styleRefImage.split(',')[1] } });
  parts.push({ text: `EDIT TASK: Modify this ${aspectRatio} shot. REQUEST: "${editPrompt}". PRESERVE morphology. NO BORDERS.` });
  try {
    const response = await withRetry<GenerateContentResponse>(() => {
        const ai = getFreshClient();
        return ai.models.generateContent({ model: modelName, contents: { parts }, config: { imageConfig: { aspectRatio: aspectRatio as any, imageSize: modelName === 'gemini-3-pro-image-preview' ? imageSize as any : undefined } } });
    });
    for (const part of response.candidates?.[0]?.content?.parts || []) { if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`; }
    throw new Error("No image data returned.");
  } catch (error: any) { throw error; }
};

export const generateCameraSuggestions = async (prompt: string, panelCount: number): Promise<string[]> => {
    await ensureApiKey();
    try {
        const response = await withRetry<GenerateContentResponse>(() => {
            const ai = getFreshClient();
            return ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: { parts: [{ text: `你是一个世界级的电影摄影指导。请基于场景描述，规划 ${panelCount} 个具备极高专业深度的电影级分镜脚本。
                
场景背景：${prompt}

${FIVE_DIMENSION_SCRIPT_GUIDE}

输出要求：
- 请输出恰好 ${panelCount} 行纯文本。
- 每一行代表一个独立的分镜描述。
- 严禁输出任何序号、前导词或多余的解释。` }] }
            });
        });
        const rawText = response.text || "";
        return rawText.split('\n').map(line => line.replace(/^[0-9]+[.\-、\s]*/, '').trim()).filter(line => line.length > 10).slice(0, panelCount);
    } catch (error) { return new Array(panelCount).fill("[环境信息]：电影级光影。[镜头语言]：MCU。[镜头视角与焦段]：平视，35mm。[动态状态]：固定镜头。[角色构图元素]：角色位于中心(0.5, 0.5)，动作待命。"); }
};

export const generateCameraMovement = async (prompt: string): Promise<string> => {
    await ensureApiKey();
    try {
        const response = await withRetry<GenerateContentResponse>(() => {
            const ai = getFreshClient();
            return ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: { parts: [{ text: `场景: ${prompt}` }] }, config: { systemInstruction: "Output a camera movement description (Chinese). Max 10 words." } });
        });
        return response.text || "固定镜头。";
    } catch { return "电影动效。"; }
};

export const generateScriptLines = async (instruction: string, count: number, attachmentText?: string): Promise<string[]> => {
    await ensureApiKey();
    try {
        const response = await withRetry<GenerateContentResponse>(() => {
            const ai = getFreshClient();
            return ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: { 
                  parts: [{ 
                    text: `你是一个世界级电影分镜脚本专家。请将以下输入内容拆解为恰好 ${count} 个独立的、具备极高视觉冲击力的电影级分镜描述。

${FIVE_DIMENSION_SCRIPT_GUIDE}

输入内容：${attachmentText || ''}
附加指令：${instruction}

输出要求：
- 每一行代表一个独立的镜头。
- 严禁输出任何多余的解释、序号或前导词。
- 确保这 ${count} 个分镜在视觉叙事上具备连贯性。` 
                  }] 
                }
            });
        });
        return (response.text || "").split('\n').filter(l => l.trim() && l.includes('[')).slice(0, count);
    } catch (e) {
        console.error("Script decomposition failed:", e);
        return new Array(count).fill("[环境信息]：日间，室内。[镜头语言]：中景。[镜头视角与焦段]：平视，35mm。[动态状态]：固定镜头。[角色构图元素]：角色位于中心，正在待命。");
    }
};

export const analyzeVideoToScript = async (videoBase64: string, mimeType: string): Promise<string[]> => {
    await ensureApiKey();
    try {
        const response = await withRetry<GenerateContentResponse>(() => {
            const ai = getFreshClient();
            return ai.models.generateContent({
                model: 'gemini-3-pro-preview',
                contents: { 
                  parts: [
                    { inlineData: { mimeType, data: videoBase64 } },
                    { text: `你是一个世界顶尖的电影分析专家。
请仔细观察这段视频，识别视频中的所有镜头切换点（Shot Cuts）。

对每一个识别出的独立镜头，请按照以下标准分镜脚本格式进行反推描述：
${FIVE_DIMENSION_SCRIPT_GUIDE}

输出要求：
- 每一行代表一个独立的镜头分镜描述。
- 严禁输出多余的解释，仅输出分镜脚本内容。` }
                  ]
                }
            });
        });
        return (response.text || "").split('\n').filter(l => l.trim() && l.includes('['));
    } catch (e) {
        console.error("Video analysis failed:", e);
        throw new Error("视频反推失败，请检查视频格式或稍后重试。");
    }
};

export const generateDirectorSummary = async (scripts: string[]): Promise<string> => {
    await ensureApiKey();
    try {
        const response = await withRetry<GenerateContentResponse>(() => {
            const ai = getFreshClient();
            return ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: { parts: [{ text: `根据以下分镜总结成简洁梗概：\n${scripts.join('\n')}` }] } });
        });
        return response.text?.trim() || "选中的分镜场景。";
    } catch { return "无法生成梗概。"; }
};

export const enhancePrompt = async (rawPrompt: string): Promise<string> => {
  await ensureApiKey();
  try {
    const response = await withRetry<GenerateContentResponse>(() => {
        const ai = getFreshClient();
        return ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: `Enhance cinematic prompt: "${rawPrompt}"` });
    });
    return response.text || rawPrompt;
  } catch { return rawPrompt; }
};

export const analyzeAsset = async (fileBase64: string, mimeType: string, prompt: string): Promise<string> => {
  await ensureApiKey();
  try {
    const response = await withRetry<GenerateContentResponse>(() => {
        const ai = getFreshClient();
        return ai.models.generateContent({ model: 'gemini-3-pro-preview', contents: { parts: [{ inlineData: { mimeType, data: fileBase64 } }, { text: prompt }] } });
    });
    return response.text || "No analysis.";
  } catch { return "Failed."; }
};

export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
  });
};
