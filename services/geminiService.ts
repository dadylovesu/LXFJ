
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { AspectRatio, ImageSize, Asset, CollageData } from "../types";

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

/**
 * Helper to wrap Gemini API calls with exponential backoff retry logic.
 */
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

const validateAspectRatio = (ar: AspectRatio | string): string => {
  const supported = ["1:1", "3:4", "4:3", "9:16", "16:9"];
  if (supported.includes(ar)) return ar;
  switch (ar) {
    case AspectRatio.CINEMA: return "16:9";
    case AspectRatio.PHOTO_LANDSCAPE: return "4:3";
    case AspectRatio.PHOTO_PORTRAIT: return "3:4";
    default: return "16:9";
  }
};

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
  gridRows: number, 
  gridCols: number, 
  aspectRatio: AspectRatio,
  imageSize: ImageSize, 
  categorizedRefs: ReferenceImageData[] = [],
  contextImage?: string,
  panelInstructions?: string[],
  collageRef?: CollageData 
): Promise<{ fullImage: string, slices: string[] }> => {
  await ensureApiKey();
  
  const totalViews = gridRows * gridCols;
  const gridType = `${gridRows}x${gridCols}`;

  const roles = categorizedRefs.filter(r => r.category === 'role');
  const bgs = categorizedRefs.filter(r => r.category === 'background');
  const props = categorizedRefs.filter(r => r.category === 'prop');

  // 构建更强的一致性系统指令
  let systemPrompt = `[CORE TASK]: AS A PROFESSIONAL CINEMATIC DIRECTOR, GENERATE A SINGLE ${gridType} STORYBOARD GRID.
[CRITICAL REQUIREMENT: VISUAL CONSISTENCY]:
1. THE FACIAL FEATURES, HAIR, CLOTHING, AND BODY PROPORTIONS OF EACH "ROLE" MUST BE 100% CONSISTENT ACROSS ALL PANELS.
2. THE LIGHTING, TEXTURES, AND SPATIAL LAYOUT OF THE "BACKGROUND" MUST REMAIN PERMANENTLY ANCHORED.
3. ALL "PROPS" MUST MAINTAIN THEIR SCALE AND DESIGN DETAILS.

[ENTITY MAPPING]:
${roles.map((r, i) => `- IMAGE_PART_${i}: This is the visual anchor for "ROLE ${r.roleIndex}". Extract and lock their identity.`).join('\n')}
${bgs.map((b, i) => `- IMAGE_PART_${roles.length + i}: This is the visual anchor for the ENVIRONMENT.`).join('\n')}
${props.map((p, i) => `- IMAGE_PART_${roles.length + bgs.length + i}: This is the visual anchor for "PROP ${p.roleIndex}".`).join('\n')}

[STORYBOARD CONTENT]:
- MAIN THEME: "${prompt}"
- ASPECT RATIO: Adapt all content to ${aspectRatio}.
- LAYOUT: Exactly ${totalViews} distinct narrative panels.

${collageRef ? `\n[COMPOSITION REFERENCE]: Use the provided Collage image to guide camera angles, framing, and sequential flow.` : ''}

${panelInstructions && panelInstructions.length > 0 ? `\n[PANEL-BY-PANEL SPECIFICS]:\n${panelInstructions.map((instr, idx) => `Panel ${idx + 1}: ${instr || 'Evolve the narrative logically'}`).join('\n')}` : ''}

[FINAL STYLE]: Ultra-realistic cinematic render, 35mm lens feel, high production value. No text or icons in the image.`;

  const parts: any[] = [];
  
  // 严格排序以对应 Prompt 中的索引
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
              aspectRatio: validateAspectRatio(aspectRatio) as any,
              imageSize: imageSize as any 
            }
          }
        });
    });

    let fullImageBase64 = '';
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) fullImageBase64 = `data:image/png;base64,${part.inlineData.data}`;
    }

    if (!fullImageBase64) throw new Error("Render engine returned no image data.");
    const panels = await sliceImageGrid(fullImageBase64, gridRows, gridCols);
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
  
  parts.push({ text: `MANDATORY INSTRUCTION: Update this storyboard panel based on: "${editPrompt}". 
Maintain EXACT consistency with the character's facial features and environment from the original image. 
Output: Cinematic High-Fidelity Render.` });

  try {
    const response = await withRetry<GenerateContentResponse>(() => {
        const ai = getClient();
        return ai.models.generateContent({
          model: modelName,
          contents: { parts },
          config: {
            imageConfig: {
              aspectRatio: validateAspectRatio(aspectRatio) as any,
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
                    text: `你是一个专业的电影分镜规划师。
                    任务：将以下场景描述规划为 ${panelCount} 个连贯的视觉分镜指令。
                    
                    场景描述：${prompt}
                    
                    【严格输出格式要求】：
                    1. 必须输出正好 ${panelCount} 条指令，每条指令占据一行。
                    2. 严禁带有数字编号（如 1. 2. 3.）、前缀词（如 镜头1：）或任何引言。
                    3. 每一行必须是一个完整且丰富的专业描述。
                    
                    【内容要求】：
                    每条描述必须包含以下要素：
                    - 景别：如 远景、全景、中景、近景、特写。
                    - 构图：如 三分法构图、黄金分割、对称构图、引导线构图。
                    - 角度：如 平视、仰拍、俯拍、斜角镜头。
                    - 拍摄手法：如 固定镜头、推镜头、摇镜头、移镜头。
                    - 角色细节：详细描述角色的朝向（如 面向镜头左侧45度）、镜头角度、具体的身体姿态、细微的面部表情（如 坚定、忧虑、狂喜）。
                    - 叙事内容：描述画面中发生的关键动作、光影氛围（如 丁达尔效应、侧逆光）。
                    
                    请以专业的导演视角进行创作，确保这 ${panelCount} 个镜头构成一个逻辑严密的视觉序列。` 
                  }] 
                }
            });
        });
        
        // Process the text to ensure it's a clean line-by-line array
        const rawText = response.text || "";
        const lines = rawText.split('\n')
            .map(line => line.replace(/^[0-9]+[.\-、\s]*/, '').trim()) // Remove any leading numbers
            .filter(line => line.length > 5) // Filter out garbage/short lines
            .slice(0, panelCount);
            
        // Padding if AI returns fewer lines than requested
        while (lines.length < panelCount) {
            lines.push("电影级全景镜头：角色正对镜头，中性表情，侧逆光氛围，专业电影感。");
        }
        
        return lines;
    } catch (error) { 
        console.error("Camera suggestions failed:", error);
        return new Array(panelCount).fill("专业级电影分镜：高清渲染，导演级构图逻辑。"); 
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
                    { text: `你是一个专业的电影分镜脚本拆解师。
                    任务：将以下输入内容拆解为正好 ${count} 条独立的视觉描述指令。
                    要求：
                    1. 每条指令必须严格遵循以下结构：“时间，景别，拍摄角度，构图，角色标号+名称，角色的行为动作，关键道具，环境描述”。
                    2. 【严格禁止】：不要描述角色身上的服装、细节或任何多余的角色长相细节。角色部分必须仅保留“角色标号+名称”。
                    3. 保持叙事的连贯性。
                    4. 直接返回这 ${count} 条文本，每条占一行。不要编号。使用中文。
                    
                    输入内容/文档：
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
        return new Array(count).fill("时间，全景，平视，黄金分割，角色1，正在待命，无，场景待定");
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
                    { text: `根据以下分镜脚本，生成一段简短的、基于选中脚本的片段梗概。
                    描述结构必须包含：时间，地点，角色标号+名称，角色的行为动作，关键道具，环境描述。
                    【注意】：不要描述角色身上的服装或多余角色细节。
                    使用中文，控制在100字以内。
                    
                    分镜脚本列表：
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
          contents: `Enhance cinematic prompt: "${rawPrompt}" (Chinese, <60 words)`,
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
