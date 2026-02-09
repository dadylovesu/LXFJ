
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
  
  const gridIsolation = `[GRID ISOLATION]: This is a ${gridSize}x${gridSize} matrix of individual camera shots. SEAMLESS tiling is required. NO GAPS, NO WHITE BORDERS, NO PADDING between cells. Each cell MUST be an independent image touching its neighbors edge-to-edge.`;

  const systemPrompt = `[TASK]: 3D一致性重绘宫格布局。\n${gridIsolation}\n布局: ${gridSize}x${gridSize}宫格。\n单格比例: ${panelAspectRatio}。\n${styleInstruction}\n指令:\n${panelDescriptionsText}`;
  
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
  if (isVertical) arInstruction += ` CRITICAL: Use EDGE-TO-EDGE VERTICAL COMPOSITION.`;

  let gridIsolation = `[GRID ISOLATION]: CRITICAL! This is a ${gridSize}x${gridSize} grid of INDEPENDENT shots.
  1. NO BORDERS: Zero white space, gaps, or borders between cells.
  2. SEAMLESS TILING: Panels must touch edge-to-edge.
  3. NO GAPS: Form a solid image with no internal margins.`;

  let charInstruction = "[CHARACTER CONSISTENCY]: Lock the identity, features, and clothing of characters from the 'role' references. Character models MUST remain constant across all panels.";

  // 强化核心场景指令，防止偏离
  let systemPrompt = `[CORE NARRATIVE - MANDATORY]: ${prompt}
[TASK]: Generate a ${gridSize}x${gridSize} storyboard grid based STICKLY on the core narrative above.
${gridIsolation}
${arInstruction}
${charInstruction}
[STYLE]: ${stylePrompt || 'Cinematic, hyper-realistic'}.
[SPATIAL GUIDELINE]: Each cell must show professional depth, composition, and character orientation.
${panelInstructions && panelInstructions.length > 0 ? `\n[PANEL-SPECIFIC VARIATIONS]: The following technical directions apply to each grid cell BUT MUST NOT override the core narrative (${prompt}):\n${panelInstructions.map((instr, idx) => `Grid ${idx + 1}: ${instr}`).join('\n')}` : ''}
FINAL VALIDATION: All characters in all panels must be performing actions related to "${prompt}". NO WHITE BORDERS.`;

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
  parts.push({ text: `EDIT TASK: Modify this ${aspectRatio} shot. REQUEST: "${editPrompt}". Keep cinematic depth and consistent character features.` });
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
                contents: { parts: [{ text: `你是一个世界级的电影摄影指导。请针对以下场景规划 ${panelCount} 个精简的分镜。
                
场景背景（核心指令）：${prompt}

${COMPACT_SCRIPT_GUIDE}

输出要求：
1. 每一行必须严格遵循七项简写格式。
2. 叙事(叙事内容) 必须紧扣主指令 "${prompt}"。例如如果主指令是"开坦克"，分镜必须全都在坦克内外进行。
3. 位置/朝向：明确角色位置。` }] }
            });
        });
        const rawText = response.text || "";
        return rawText.split('\n').map(line => line.replace(/^[0-9]+[.\-、\s]*/, '').trim()).filter(line => line.length > 5).slice(0, panelCount);
    } catch (error) { return new Array(panelCount).fill("[自然光, MCU, 平视/35mm, 镜头倾斜0°, 纵深(无), 画面中心, 叙事(角色保持静态)]"); }
};

export const generateCameraMovement = async (prompt: string): Promise<string> => {
    await ensureApiKey();
    try {
        const response = await withRetry<GenerateContentResponse>(() => {
            const ai = getFreshClient();
            return ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: { parts: [{ text: `场景: ${prompt}` }] }, config: { systemInstruction: "输出精简的摄影动线（中文）。" } });
        });
        return response.text || "固定镜头。";
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
                    text: `你是一个影视分镜专家。请基于以下内容拆解为 ${count} 个精简的分镜。

${COMPACT_SCRIPT_GUIDE}

核心背景：${instruction}
输入素材：${attachmentText || ''}

输出要求：
1. 严格执行七项简写格式。
2. 每一个分镜的动作描述必须高度契合核心背景 "${instruction}"。如果是"开坦克"，严禁出现任何与坦克无关的运动。` 
                  }] 
                }
            });
        });
        return (response.text || "").split('\n').filter(l => l.trim() && l.includes('[')).slice(0, count);
    } catch (e) {
        return new Array(count).fill("[自然光, 中景, 平视/35mm, 镜头倾斜0°, 纵深(无), 画面中心, 叙事(待机动作)]");
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
                    { text: `分析这段视频，识别镜头切换点。按以下简写格式描述每一镜：
${COMPACT_SCRIPT_GUIDE}` }
                  ]
                }
            });
        });
        return (response.text || "").split('\n').filter(l => l.trim() && l.includes('['));
    } catch (e) {
        throw new Error("视频反推失败。");
    }
};

export const generateDirectorSummary = async (scripts: string[]): Promise<string> => {
    await ensureApiKey();
    try {
        const response = await withRetry<GenerateContentResponse>(() => {
            const ai = getFreshClient();
            return ai.models.generateContent({ 
                model: 'gemini-3-flash-preview', 
                contents: { 
                    parts: [{ 
                        text: `提炼以下分镜为一段极其精炼的创作指令（梗概），严禁使用列表或 Markdown 标题，控制在 60 字内：\n${scripts.join('\n')}` 
                    }] 
                } 
            });
        });
        return response.text?.trim() || "空间叙事。";
    } catch { return "无法生成梗概。"; }
};

export const enhancePrompt = async (rawPrompt: string): Promise<string> => {
  await ensureApiKey();
  try {
    const response = await withRetry<GenerateContentResponse>(() => {
        const ai = getFreshClient();
        return ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: `Enhance this cinematic prompt: "${rawPrompt}"` });
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
