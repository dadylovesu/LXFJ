
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { AspectRatio, ImageSize, Asset, CollageData, PanelAspectRatio } from "../types";

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

const getClient = () => {
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

async function withRetry<T>(operation: () => Promise<T>, maxRetries = 3): Promise<T> {
  let lastError: any;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      const errorMsg = error?.message || "";
      const statusCode = error?.status || error?.code;

      // Handle mandatory key selection reset if requested entity not found
      if (errorMsg.includes("Requested entity was not found.")) {
        // @ts-ignore
        if (window.aistudio && window.aistudio.openSelectKey) {
            // @ts-ignore
            await window.aistudio.openSelectKey();
        }
        throw error; // Rethrow after prompting for key
      }

      const isOverloaded = statusCode === 'UNAVAILABLE' || statusCode === 503 || statusCode === 500;
      const isRateLimited = statusCode === 'RESOURCE_EXHAUSTED' || statusCode === 429;

      if ((isOverloaded || isRateLimited) && attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 2000 + Math.random() * 1000;
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
  category: 'role' | 'background' | 'prop';
  roleIndex?: number;
}

export const generateMultiViewGrid = async (
  prompt: string,
  gridSize: number, 
  panelAspectRatio: PanelAspectRatio,
  containerAspectRatio: AspectRatio,
  imageSize: ImageSize, 
  categorizedRefs: ReferenceImageData[] = [],
  contextImage?: string,
  panelInstructions?: string[],
  collageRef?: CollageData 
): Promise<{ fullImage: string, slices: string[] }> => {
  await ensureApiKey();
  
  const totalViews = gridSize * gridSize;
  const gridType = `${gridSize}x${gridSize}`;
  const isVertical = panelAspectRatio.includes('3:4') || panelAspectRatio.includes('9:16');
  const isSquare = panelAspectRatio === '1:1';
  
  let compositionInstruction = "";
  if (isVertical) {
    compositionInstruction = `MANDATORY: EDGE-TO-EDGE VERTICAL COMPOSITION. NO MARGINS.`;
  } else if (isSquare) {
    compositionInstruction = `MANDATORY: FULL-BLEED SQUARE COMPOSITION. ZERO GUTTERS.`;
  } else {
    compositionInstruction = `MANDATORY: CINEMATIC WIDESCREEN, ZERO LETTERBOXING.`;
  }

  // Limit input assets to improve stability
  const limitedRefs = categorizedRefs.slice(0, 5);
  const roles = limitedRefs.filter(r => r.category === 'role');
  const bgs = limitedRefs.filter(r => r.category === 'background');
  const props = limitedRefs.filter(r => r.category === 'prop');

  let systemPrompt = `STORYBOARD GRID ${gridType}.
FULL AR: ${containerAspectRatio}. PANEL AR: ${panelAspectRatio}.
${compositionInstruction}
SCENE: "${prompt}"
ANATOMY: Strictly preserve reference morphology. No extra limbs.
NO BORDERS. NO GRID LINES. SEAMLESS MOSAIC.
${panelInstructions && panelInstructions.length > 0 ? `PANELS:\n${panelInstructions.map((instr, idx) => `P${idx + 1}: ${instr}`).join('\n')}` : ''}
STYLE: Cinematic film, high-end production.`;

  const makePayload = () => {
    const parts: any[] = [];
    roles.forEach(r => parts.push({ inlineData: { mimeType: r.mimeType, data: r.data } }));
    bgs.forEach(b => parts.push({ inlineData: { mimeType: b.mimeType, data: b.data } }));
    props.forEach(p => parts.push({ inlineData: { mimeType: p.mimeType, data: p.data } }));
    if (collageRef) parts.push({ inlineData: { mimeType: 'image/png', data: collageRef.url.split(',')[1] } });
    if (contextImage) parts.push({ inlineData: { mimeType: 'image/png', data: contextImage.split(',')[1] } });
    parts.push({ text: systemPrompt });
    return parts;
  };

  const tryGenerate = async (modelName: string, isPro: boolean) => {
    return await withRetry<GenerateContentResponse>(() => {
        const ai = getClient();
        return ai.models.generateContent({
          model: modelName,
          contents: { parts: makePayload() },
          config: {
            imageConfig: {
              aspectRatio: containerAspectRatio as any,
              imageSize: isPro ? imageSize as any : undefined
            }
          }
        });
    });
  };

  try {
    let response: GenerateContentResponse;
    try {
        // Primary attempt with Gemini 3 Pro
        response = await tryGenerate('gemini-3-pro-image-preview', true);
    } catch (e: any) {
        // Fallback to Flash if Pro encounters a 500 or capacity issue
        console.warn("Gemini 3 Pro failed, falling back to 2.5 Flash Image:", e);
        response = await tryGenerate('gemini-2.5-flash-image', false);
    }

    let fullImageBase64 = '';
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) fullImageBase64 = `data:image/png;base64,${part.inlineData.data}`;
    }

    if (!fullImageBase64) throw new Error("No image generated.");
    const panels = await sliceImageGrid(fullImageBase64, gridSize, gridSize);
    return { fullImage: fullImageBase64, slices: panels };
  } catch (error: any) {
    console.error("Grid gen final error:", error);
    throw error;
  }
};

export const editImage = async (
  base64Image: string,
  editPrompt: string,
  modelName: 'gemini-2.5-flash-image' | 'gemini-3-pro-image-preview',
  aspectRatio: string = '1:1',
  refImageBase64?: string,
  imageSize: ImageSize = ImageSize.K1
): Promise<string> => {
  await ensureApiKey();
  const cleanBase64 = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;
  const parts: any[] = [{ inlineData: { mimeType: 'image/png', data: cleanBase64 } }];
  if (refImageBase64) parts.push({ inlineData: { mimeType: 'image/png', data: refImageBase64.split(',')[1] } });
  
  parts.push({ text: `EDIT: ${editPrompt}. AR: ${aspectRatio}. Preserve morphology. No extra limbs. No borders.` });

  try {
    const response = await withRetry<GenerateContentResponse>(() => {
        const ai = getClient();
        return ai.models.generateContent({
          model: modelName,
          contents: { parts },
          config: {
            imageConfig: {
              aspectRatio: aspectRatio as any,
              imageSize: modelName === 'gemini-3-pro-image-preview' ? imageSize as any : undefined
            }
          }
        });
    });
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
    }
    throw new Error("No image data returned.");
  } catch (error: any) {
    console.error("Image edit error:", error);
    throw error;
  }
};

export const generateCameraSuggestions = async (prompt: string, panelCount: number): Promise<string[]> => {
    await ensureApiKey();
    try {
        const response = await withRetry<GenerateContentResponse>(() => {
            const ai = getClient();
            return ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: { 
                  parts: [{ 
                    text: `基于：${prompt}。规划 ${panelCount} 个电影分镜。包含环境、镜头、焦段、动态、角色动作。输出 ${panelCount} 行，纯文本。` 
                  }] 
                }
            });
        });
        
        const rawText = response.text || "";
        const lines = rawText.split('\n')
            .map(line => line.replace(/^[0-9]+[.\-、\s]*/, '').trim())
            .filter(line => line.length > 5)
            .slice(0, panelCount);
            
        while (lines.length < panelCount) {
            lines.push("清晨，中景，黄金分割，50mm，静态，角色中央，侧身观察。");
        }
        
        return lines;
    } catch (error) { 
        return new Array(panelCount).fill("专业分镜：35mm，导演构图。"); 
    }
};

export const generateCameraMovement = async (prompt: string): Promise<string> => {
    await ensureApiKey();
    try {
        const response = await withRetry<GenerateContentResponse>(() => {
            const ai = getClient();
            return ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: { parts: [{ text: `场景: ${prompt}` }] },
                config: { systemInstruction: "Output camera movement (Chinese). Max 10 words." }
            });
        });
        return response.text || "固定镜头。";
    } catch { return "电影动效。"; }
};

export const generateScriptLines = async (instruction: string, count: number, attachmentText?: string): Promise<string[]> => {
    await ensureApiKey();
    try {
        const response = await withRetry<GenerateContentResponse>(() => {
            const ai = getClient();
            return ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: { 
                  parts: [
                    { text: `拆解为 ${count} 条独立电影分镜指令。环境、景别、焦段、动态、角色动作。输入：${attachmentText || ''}。附加：${instruction}` }
                  ] 
                }
            });
        });
        return (response.text || "").split('\n').filter(l => l.trim()).slice(0, count);
    } catch (e) {
        return new Array(count).fill("时间，全景，平视，角色1，正在待命");
    }
};

export const generateDirectorSummary = async (scripts: string[]): Promise<string> => {
    await ensureApiKey();
    try {
        const response = await withRetry<GenerateContentResponse>(() => {
            const ai = getClient();
            return ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: { 
                  parts: [
                    { text: `剧情梗概：${scripts.join('\n')}` }
                  ] 
                }
            });
        });
        return response.text?.trim() || "剧情梗概。";
    } catch {
        return "无法生成梗概。";
    }
};

export const enhancePrompt = async (rawPrompt: string): Promise<string> => {
  await ensureApiKey();
  try {
    const response = await withRetry<GenerateContentResponse>(() => {
        const ai = getClient();
        return ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: `Enhance cinematic prompt: "${rawPrompt}"`,
        });
    });
    return response.text || rawPrompt;
  } catch { return rawPrompt; }
};

export const analyzeAsset = async (fileBase64: string, mimeType: string, prompt: string): Promise<string> => {
  await ensureApiKey();
  try {
    const response = await withRetry<GenerateContentResponse>(() => {
        const ai = getClient();
        return ai.models.generateContent({
          model: 'gemini-3-pro-preview',
          contents: { parts: [{ inlineData: { mimeType, data: fileBase64 } }, { text: prompt }] }
        });
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
