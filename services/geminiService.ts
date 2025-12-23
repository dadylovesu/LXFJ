
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

  // 构建更强的一致性系统指令 - 特别强调对非人形生物解剖结构的遵循
  let systemPrompt = `[CORE TASK]: AS A PROFESSIONAL CINEMATIC DIRECTOR, GENERATE A SINGLE ${gridType} STORYBOARD GRID.

[CRITICAL REQUIREMENT: CHARACTER ANATOMY FIDELITY]:
1. DIRECTLY INHERIT THE PHYSICAL STRUCTURE AND ANATOMY FROM THE PROVIDED ROLE IMAGES.
2. DO NOT ADD HUMAN LIMBS (ARMS, LEGS) OR HUMAN FEATURES TO ENTITIES THAT DO NOT HAVE THEM IN THE REFERENCE. 
3. IF A CHARACTER IS A CARTOON OBJECT OR NON-HUMANOID, MAINTAIN ITS ORIGINAL SHAPE STRICTLY.
4. DO NOT INTERPRET NARRATIVE ACTIONS BY MODIFYING THE CHARACTER'S FUNDAMENTAL BIOLOGY.

[ENTITY MAPPING]:
${roles.map((r, i) => `- IMAGE_PART_${i}: This is the visual source for "ROLE ${r.roleIndex}". LOCK ITS PHYSICAL STRUCTURE AND IDENTITY.`).join('\n')}
${bgs.map((b, i) => `- IMAGE_PART_${roles.length + i}: Environment visual anchor.`).join('\n')}
${props.map((p, i) => `- IMAGE_PART_${roles.length + bgs.length + i}: Prop visual anchor.`).join('\n')}

[STORYBOARD CONTENT]:
- MAIN THEME: "${prompt}"
- LAYOUT: Exactly ${totalViews} distinct panels.

${collageRef ? `\n[COMPOSITION REFERENCE]: Use the provided Collage image to guide camera angles and flow.` : ''}
${panelInstructions && panelInstructions.length > 0 ? `\n[PANEL SPECIFICS]:\n${panelInstructions.map((instr, idx) => `Panel ${idx + 1}: ${instr}`).join('\n')}` : ''}

[FINAL STYLE]: Ultra-realistic cinematic render, 35mm lens. No text.`;

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
  
  parts.push({ text: `MANDATORY: Edit this storyboard panel. 
1. STRICTLY ADHERE TO THE ORIGINAL CHARACTER'S ANATOMY. 
2. DO NOT ADD ARMS/LEGS IF THE CHARACTER DOES NOT HAVE THEM. 
3. Edit Request: "${editPrompt}".` });

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
                    text: `你是一个世界级的电影摄影指导（DoP）。
                    任务：基于以下剧本/场景描述，规划 ${panelCount} 个电影级分镜。
                    
                    场景：${prompt}
                    
                    【输出规范】：
                    每一行必须包含以下要素，严禁省略：
                    1. [时间/光影环境]：如“清晨冷色调侧光”、“午后强烈顶光”、“夜晚霓虹低照度”。
                    2. [景别]：如“特写”、“中景”、“全景”、“远景”。
                    3. [构图逻辑]：如“黄金分割构图”、“中心对称构图”、“框架构图”、“对角线构图”。
                    4. [焦段]：明确具体的mm数。如“14mm超广角”、“35mm叙事焦段”、“85mm人像焦段”、“200mm长焦压缩”。
                    5. [镜头角度]：如“低角度仰拍”、“平视镜头”、“高位俯拍”、“鸟瞰镜头”。
                    6. [角色空间属性]：描述“角色1”在画面中的朝向（如“侧向镜头”）、画面位置（如“位于右侧三分之一处”）以及画面占比（如“占比60%”）。
                    
                    【禁止事项】：
                    1. 禁止描述角色长相细节或服装（只用“角色1”、“角色2”）。
                    2. 禁止描述不符合参考图解剖结构的动作。
                    
                    输出格式参考：
                    “清晨金辉，全景，黄金分割构图，35mm焦段，低角度仰拍。角色1位于画面左侧偏下，面向右前方，画面占比30%，正处于逆光中。”
                    
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
            lines.push("日间自然光，全景，中心构图，35mm焦段，平视镜头。角色1位于画面中心，正对镜头，画面占比50%。");
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
                    { text: `你是一个电影分镜脚本师。
                    任务：拆解为 ${count} 条独立指令。
                    
                    【强制规范】：
                    1. 严禁描述角色长相、服装、细节。
                    2. 角色部分只能写“角色[编号]”。
                    3. 禁止描述不符合参考图物理结构的动作（例如，如果角色没有手，禁止描述“抓取”）。
                    
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
                    禁止描述角色外貌或多余解剖细节。
                    
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
          contents: `Enhance cinematic prompt (Strictly focus on environment/atmosphere, ignore character details): "${rawPrompt}"`,
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
