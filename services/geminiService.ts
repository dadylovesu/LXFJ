
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { AspectRatio, ImageSize, Asset, CollageData, PanelAspectRatio, LensLabParams } from "../types";

export const ensureApiKey = async () => {
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

// 优化后的极简脚本指南 - 包含深度、空间关系、景深及精确倾斜角
const COMPACT_SCRIPT_GUIDE = `
每个分镜描述必须采用紧凑格式，严禁包含标题词，格式如下：
[时间/光效/色调, 景别/构图逻辑, 视角/XXmm 焦段, 镜头向左/右倾斜X°, 纵深(前景遮挡物及位置/物体间前后左右关系/景深聚焦状态)]
示例：[午后斜射光, MCU/黄金分割, 平视/35mm 焦段, 镜头向左倾斜5°, 纵深(左侧前景书架遮挡20%/角色在中景/后景城市灯光虚化)]
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
    let pitchDesc = p.pitch > 0 ? `俯角${p.pitch}°` : (p.pitch < 0 ? `仰角${Math.abs(p.pitch)}°` : "平视");
    let yawDesc = p.yaw > 0 ? `右偏${p.yaw}°` : (p.yaw < 0 ? `左偏${Math.abs(p.yaw)}°` : "正面");
    return `[参考锚点, 视角转换, ${p.focalLength}mm 焦段/${pitchDesc}/${yawDesc}, 镜头倾斜0°, 保持角色与背景纵深一致]`;
  });
  const panelDescriptionsText = panelPrompts.map((p, i) => `格${i + 1}: ${p}`).join("\n");
  let styleInstruction = stylePrompt && stylePrompt.trim() ? `[风格]: ${stylePrompt}。` : "[风格]: 电影质感。";
  if (styleRefImage) styleInstruction += " [参考图]: 严格复刻参考图影调。";
  
  const systemPrompt = `[任务]: 3D一致性重绘。[逻辑]: 锁定参考图角色。布局: ${gridSize}x${gridSize}宫格。单格比例: ${panelAspectRatio}。\n${styleInstruction}\n指令:\n${panelDescriptionsText}`;
  
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
  const roles = categorizedRefs.filter(r => r.category === 'role');
  const bgs = categorizedRefs.filter(r => r.category === 'background');
  
  const isVertical = panelAspectRatio === PanelAspectRatio.P9_16 || panelAspectRatio === PanelAspectRatio.P3_4;
  let arInstruction = `[PHYSICAL ASPECT RATIO]: Every single panel MUST be exactly ${panelAspectRatio}.`;
  if (isVertical) arInstruction += ` CRITICAL: Use EDGE-TO-EDGE VERTICAL COMPOSITION. DO NOT GENERATE HORIZONTAL SHOTS.`;

  let charInstruction = "[CHARACTER CONSISTENCY]: STRICTLY lock the morphology, features, and colors of the characters from the provided 'role' references. Every panel must feature the EXACT SAME character models.";

  let systemPrompt = `[TASK]: GENERATE A ${gridSize}x${gridSize} STORYBOARD GRID.
${arInstruction}
${charInstruction}
[STYLE]: ${stylePrompt || 'Cinematic, hyper-realistic'}.
[SCENE]: ${prompt}
[SPATIAL GUIDELINE]: 每一格必须体现明显的纵深层次感，包含前景遮挡、角色与环境的前后位置关系，以及精准的景深聚焦（Sharp/Blur）。机位倾斜严禁使用描述性词汇，必须使用“向左/右倾斜X°”。
${panelInstructions && panelInstructions.length > 0 ? `\n[PANEL INSTRUCTIONS]:\n${panelInstructions.map((instr, idx) => `Grid ${idx + 1}: ${instr}`).join('\n')}` : ''}
FINAL CHECK: Ensure all panels are ${panelAspectRatio} vertical aspect ratio.`;

  const parts: any[] = [];
  roles.forEach(r => parts.push({ inlineData: { mimeType: r.mimeType, data: r.data } }));
  // Fix: Corrected 'r.mimeType' to 'b.mimeType' to resolve the "Cannot find name 'r'" error.
  bgs.forEach(b => parts.push({ inlineData: { mimeType: b.mimeType, data: b.data } }));
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
  parts.push({ text: `EDIT TASK: Modify this ${aspectRatio} shot. REQUEST: "${editPrompt}". 保持专业分镜纵深与倾斜角规范。` });
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
                contents: { parts: [{ text: `你是一个世界级的电影摄影指导。请规划 ${panelCount} 个精简的分镜。
                
场景背景：${prompt}

${COMPACT_SCRIPT_GUIDE}

输出要求：
- 每行必须体现：纵深度（前景遮挡/前后关系/景深虚实）、精确倾斜度、焦段术语规范。
- 每一行必须严格遵循“[信息1, 信息2, 信息3, 信息4, 信息5]”的简写格式。` }] }
            });
        });
        const rawText = response.text || "";
        return rawText.split('\n').map(line => line.replace(/^[0-9]+[.\-、\s]*/, '').trim()).filter(line => line.length > 5).slice(0, panelCount);
    } catch (error) { return new Array(panelCount).fill("[自然光, MCU, 平视/35mm 焦段, 镜头倾斜0°, 纵深(无前景/角色居中/全景清晰)]"); }
};

export const generateCameraMovement = async (prompt: string): Promise<string> => {
    await ensureApiKey();
    try {
        const response = await withRetry<GenerateContentResponse>(() => {
            const ai = getFreshClient();
            return ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: { parts: [{ text: `场景: ${prompt}` }] }, config: { systemInstruction: "输出精简的摄影动线（中文）。必须包含纵深调度逻辑，严禁模糊词汇。" } });
        });
        return response.text || "固定镜头，纵深构图。";
    } catch { return "电影级纵深调度。"; }
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
                    text: `你是一个影视分镜专家。请将内容拆解为 ${count} 个精简的分镜。

${COMPACT_SCRIPT_GUIDE}

输入内容：${attachmentText || ''}
附加指令：${instruction}

输出要求：
- 严格执行：纵深度（前景遮挡/位置关系/景深）、精确倾斜角、焦段术语。` 
                  }] 
                }
            });
        });
        return (response.text || "").split('\n').filter(l => l.trim() && l.includes('[')).slice(0, count);
    } catch (e) {
        return new Array(count).fill("[自然光, 中景, 平视/35mm 焦段, 镜头倾斜0°, 纵深(无前景/前后适中)]");
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
                    { text: `分析这段视频，识别镜头切换点。对每个镜头按以下简写格式描述，重点分析前景遮挡、纵深关系和精确倾斜度：
${COMPACT_SCRIPT_GUIDE}` }
                  ]
                }
            });
        });
        return (response.text || "").split('\n').filter(l => l.trim() && l.includes('['));
    } catch (e) {
        console.error("Video analysis failed:", e);
        throw new Error("视频反推失败。");
    }
};

export const generateDirectorSummary = async (scripts: string[]): Promise<string> => {
    await ensureApiKey();
    try {
        const response = await withRetry<GenerateContentResponse>(() => {
            const ai = getFreshClient();
            return ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: { parts: [{ text: `总结分镜梗概，强调空间纵深感：\n${scripts.join('\n')}` }] } });
        });
        return response.text?.trim() || "空间叙事。";
    } catch { return "无法生成梗概。"; }
};

export const enhancePrompt = async (rawPrompt: string): Promise<string> => {
  await ensureApiKey();
  try {
    const response = await withRetry<GenerateContentResponse>(() => {
        const ai = getFreshClient();
        return ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: `Enhance cinematic prompt with depth and spatial layers: "${rawPrompt}"` });
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
