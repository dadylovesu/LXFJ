
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
      const isOverloaded = error?.status === 'UNAVAILABLE' || error?.code === 503;
      const isRateLimited = error?.status === 'RESOURCE_EXHAUSTED' || error?.code === 429;

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
      const pieceWidth = Math.floor(w / cols);
      const pieceHeight = Math.floor(h / rows);
      const pieces: string[] = [];
      const canvas = document.createElement('canvas');
      canvas.width = pieceWidth;
      canvas.height = pieceHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error("Canvas error"));
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            ctx.clearRect(0, 0, pieceWidth, pieceHeight);
            ctx.drawImage(img, c * pieceWidth, r * pieceHeight, pieceWidth, pieceHeight, 0, 0, pieceWidth, pieceHeight);
            pieces.push(canvas.toDataURL('image/png'));
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

  // 根据比例类型生成特定的构图强化指令
  const isVertical = panelAspectRatio.includes('3:4') || panelAspectRatio.includes('9:16') || panelAspectRatio.includes('2:3');
  const isSquare = panelAspectRatio === '1:1';
  
  let compositionInstruction = "";
  if (isVertical) {
    compositionInstruction = `MANDATORY COMPOSITION: Use NATIVE VERTICAL FRAMING for each panel. Every individual shot must be a portrait-style cinematic composition. NO HORIZONTAL LETTERBOXING. Ensure characters and action fill the ${panelAspectRatio} height.`;
  } else if (isSquare) {
    compositionInstruction = `MANDATORY COMPOSITION: Use NATIVE SQUARE FRAMING. Center-weighted cinematic composition for each of the ${totalViews} panels.`;
  } else {
    compositionInstruction = `MANDATORY COMPOSITION: Use NATIVE WIDESCREEN CINEMATOGRAPHY for each ${panelAspectRatio} panel.`;
  }

  const roles = categorizedRefs.filter(r => r.category === 'role');
  const bgs = categorizedRefs.filter(r => r.category === 'background');
  const props = categorizedRefs.filter(r => r.category === 'prop');

  let systemPrompt = `[CORE TASK]: GENERATE A SINGLE ${gridType} STORYBOARD GRID.

[STRICT LAYOUT RULE]:
- Exactly ${gridSize} rows and ${gridSize} columns.
- THE FULL IMAGE RATIO IS ${containerAspectRatio}.
- EACH INDIVIDUAL PANEL RATIO IS ${panelAspectRatio}.

[COMPOSITION RULE]:
${compositionInstruction}
- DO NOT stretch, distort, or add black bars.
- THE CONTENT OF EACH PANEL MUST NATIVELY MATCH THE ${panelAspectRatio} SHAPE.

[ENTITY MAPPING]:
${roles.map((r, i) => `- IMAGE_PART_${i}: ROLE ${r.roleIndex} visual identity.`).join('\n')}
${bgs.map((b, i) => `- IMAGE_PART_${roles.length + i}: Environment style.`).join('\n')}
${props.map((p, i) => `- IMAGE_PART_${roles.length + bgs.length + i}: Prop detail.`).join('\n')}

[SCENE]: "${prompt}"

${collageRef ? `\n[ACTION REF]: Match the camera angles in the provided collage.` : ''}
${panelInstructions && panelInstructions.length > 0 ? `\n[PANEL DETAILS]:\n${panelInstructions.map((instr, idx) => `Panel ${idx + 1}: ${instr}`).join('\n')}` : ''}

[STYLE]: Hyper-realistic cinematic film, 35mm, master lighting.`;

  const parts: any[] = [];
  roles.forEach(r => parts.push({ inlineData: { mimeType: r.mimeType, data: r.data } }));
  bgs.forEach(b => parts.push({ inlineData: { mimeType: b.mimeType, data: b.data } }));
  props.forEach(p => parts.push({ inlineData: { mimeType: p.mimeType, data: p.data } }));
  if (collageRef) parts.push({ inlineData: { mimeType: 'image/png', data: collageRef.url.split(',')[1] } });
  if (contextImage) parts.push({ inlineData: { mimeType: 'image/png', data: contextImage.split(',')[1] } });
  
  parts.push({ text: systemPrompt });

  try {
    const response = await withRetry<GenerateContentResponse>(() => {
        const ai = getClient();
        return ai.models.generateContent({
          model: 'gemini-3-pro-image-preview',
          contents: { parts },
          config: {
            imageConfig: {
              aspectRatio: containerAspectRatio as any,
              imageSize: imageSize as any 
            }
          }
        });
    });

    let fullImageBase64 = '';
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) fullImageBase64 = `data:image/png;base64,${part.inlineData.data}`;
    }

    if (!fullImageBase64) throw new Error("No image generated.");
    const panels = await sliceImageGrid(fullImageBase64, gridSize, gridSize);
    return { fullImage: fullImageBase64, slices: panels };
  } catch (error: any) {
    console.error("Grid gen error:", error);
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
  
  parts.push({ text: `EDIT TASK: Modify this ${aspectRatio} cinematic shot.
REQUEST: "${editPrompt}"
RULE: Maintain consistent character features and the original ${aspectRatio} aspect ratio content framing.` });

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
                    text: `你是一个世界级的电影摄影指导。基于场景描述，规划 ${panelCount} 个电影级分镜。
                    
                    场景：${prompt}
                    
                    输出格式参考：
                    “清晨金辉，全景，黄金分割构图，35mm焦段，低角度仰拍。角色1位于画面左侧偏下，面向右前方，画面占比30%。”
                    
                    请输出 ${panelCount} 行纯文本：` 
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
            lines.push("日间自然光，全景，中心构图，35mm焦段，平视镜头。角色1位于画面中心。");
        }
        
        return lines;
    } catch (error) { 
        return new Array(panelCount).fill("专业级电影分镜：35mm焦段，导演级构图逻辑。"); 
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
                config: { systemInstruction: "Output a camera movement description (Chinese). Max 10 words." }
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
                    { text: `你是一个电影分镜脚本师。拆解为 ${count} 条独立指令。
                    
                    输入内容：
                    ${attachmentText || ''}
                    
                    附加指令：
                    ${instruction}` }
                  ] 
                }
            });
        });
        return (response.text || "").split('\n').filter(l => l.trim()).slice(0, count);
    } catch (e) {
        console.error(e);
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
                    { text: `生成剧情梗概。
                    
                    分镜列表：
                    ${scripts.join('\n')}` }
                  ] 
                }
            });
        });
        return response.text?.trim() || "生成的梗概。";
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
