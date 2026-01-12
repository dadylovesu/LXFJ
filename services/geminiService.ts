
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

// 优化后的七项分镜脚本指南 - 新增角色方位与正背面朝向描述
const COMPACT_SCRIPT_GUIDE = `
每个分镜描述必须采用紧凑格式，严禁包含标题词，格式如下：
[环境影调, 景别构图, 视角焦段, 镜头倾斜度, 纵深空间关系, 位置/朝向, 叙事(角色动作/表情姿态)]
示例：[午后侧逆光, LS/对角线构图, 平视/35mm, 倾斜5°, 纵深(右前侧船舷遮挡/角色卧于中景), 画面偏左/左后侧背对镜头, 叙事(男主角正悠闲地闭目养神，右手搭在额头)]
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
    return `[参考锚点, 视角转换, ${p.focalLength}mm 焦段/${pitchDesc}/${yawDesc}, 镜头倾斜0°, 纵深(一致), 画面中心/跟随锚点, 叙事(保持锚点图动作的一致性延续)]`;
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
[SPATIAL GUIDELINE]: 每一格必须体现明显的纵深层次感、精准的画面位置排布及角色的叙事动态。
${panelInstructions && panelInstructions.length > 0 ? `\n[PANEL INSTRUCTIONS]:\n${panelInstructions.map((instr, idx) => `Grid ${idx + 1}: ${instr}`).join('\n')}` : ''}
FINAL CHECK: Ensure all panels are ${panelAspectRatio} vertical aspect ratio.`;

  const parts: any[] = [];
  roles.forEach(r => parts.push({ inlineData: { mimeType: r.mimeType, data: r.data } }));
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
  parts.push({ text: `EDIT TASK: Modify this ${aspectRatio} shot. REQUEST: "${editPrompt}". 保持专业分镜纵深、构图位置规范以及角色的叙事动态。` });
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
- 每行必须严格遵循七项简写格式。
- 位置/朝向模块：请明确描述角色的画面占位（偏左/偏右/居中等）及正背面朝向（正对/侧对/背向镜头等）。
- 叙事模块：请丰富描述角色具体的肢体动作和面部表情。` }] }
            });
        });
        const rawText = response.text || "";
        return rawText.split('\n').map(line => line.replace(/^[0-9]+[.\-、\s]*/, '').trim()).filter(line => line.length > 5).slice(0, panelCount);
    } catch (error) { return new Array(panelCount).fill("[自然光, MCU, 平视/35mm, 镜头倾斜0°, 纵深(无前景), 画面中心/正对镜头, 叙事(角色保持静态，表情平和)]"); }
};

export const generateCameraMovement = async (prompt: string): Promise<string> => {
    await ensureApiKey();
    try {
        const response = await withRetry<GenerateContentResponse>(() => {
            const ai = getFreshClient();
            return ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: { parts: [{ text: `场景: ${prompt}` }] }, config: { systemInstruction: "输出精简的摄影动线（中文）。必须包含纵深调度逻辑、位置关系与角色的朝向动作描述。" } });
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
- 严格执行七项简写格式。
- 特别强化位置与朝向描述：对于每一个分镜，明确角色在画面中偏向哪一侧，是正对、侧对还是背对镜头。` 
                  }] 
                }
            });
        });
        return (response.text || "").split('\n').filter(l => l.trim() && l.includes('[')).slice(0, count);
    } catch (e) {
        return new Array(count).fill("[自然光, 中景, 平视/35mm, 镜头倾斜0°, 纵深(无), 画面中心/正对, 叙事(角色执行基本待机动作)]");
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
                    { text: `分析这段视频，识别镜头切换点。对每个镜头按以下七项简写格式描述，重点捕捉角色的实际画面位置、正背面朝向、姿态细节：
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

/**
 * 优化后的梗概生成：极其精简，不含 Markdown 标题和元解释。
 */
export const generateDirectorSummary = async (scripts: string[]): Promise<string> => {
    await ensureApiKey();
    try {
        const response = await withRetry<GenerateContentResponse>(() => {
            const ai = getFreshClient();
            return ai.models.generateContent({ 
                model: 'gemini-3-flash-preview', 
                contents: { 
                    parts: [{ 
                        text: `你是一个资深电影导演。请将以下分镜脚本内容提炼为一段极其精炼的“创作指令”（梗概）。
                        
要求：
1. 严禁使用任何 Markdown 标题（如 ###）、列表或解释性文字。
2. 只要 1-2 句简洁的核心叙事总结。
3. 重点突出分镜串联后的视觉逻辑，不需要总结处理手法。
4. 长度控制在 80 字以内。

分镜列表：
${scripts.join('\n')}` 
                    }] 
                } 
            });
        });
        
        let result = response.text?.trim() || "空间叙事。";
        result = result.replace(/^[\s\S]*?(总结如下|摘要|梗概|提炼)[:：]\s*/, '');
        result = result.replace(/^[#\s\-*]+/, '');
        
        return result;
    } catch { return "无法生成梗概。"; }
};

export const enhancePrompt = async (rawPrompt: string): Promise<string> => {
  await ensureApiKey();
  try {
    const response = await withRetry<GenerateContentResponse>(() => {
        const ai = getFreshClient();
        return ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: `Enhance cinematic prompt with depth, position-based composition, and character orientation: "${rawPrompt}"` });
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
