
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { AspectRatio, ImageSize, Asset, CollageData, PanelAspectRatio } from "../types";

const getClient = () => {
  // 从 window.process 或环境变量中抓取 Key
  const apiKey = (process.env as any).API_KEY;
  
  if (!apiKey || apiKey === "") {
    console.error("Critical Error: API_KEY is missing in the runtime environment.");
    // 抛出错误以防止后续代码导致 "An API Key must be set when running in a browser" 警告弹窗
    throw new Error("Missing API Key. Please configure it in your environment or select one via the UI.");
  }
  
  return new GoogleGenAI({ apiKey });
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
  const totalViews = gridSize * gridSize;
  const gridType = `${gridSize}x${gridSize}`;

  const isVertical = panelAspectRatio.includes('3:4') || panelAspectRatio.includes('9:16');
  const isSquare = panelAspectRatio === '1:1';
  
  let compositionInstruction = "";
  if (isVertical) {
    compositionInstruction = `MANDATORY: Use EDGE-TO-EDGE VERTICAL COMPOSITION. NO BLACK BARS. NO MARGINS. The scene must bleed to the very edge of each ${panelAspectRatio} frame.`;
  } else if (isSquare) {
    compositionInstruction = `MANDATORY: Use FULL-BLEED SQUARE COMPOSITION. ZERO GUTTERS. Each of the ${totalViews} panels must be perfectly contiguous.`;
  } else {
    compositionInstruction = `MANDATORY: Use CINEMATIC WIDESCREEN with ZERO LETTERBOXING. Ensure the content fills the entire ${panelAspectRatio} area of each panel completely.`;
  }

  const roles = categorizedRefs.filter(r => r.category === 'role');
  const bgs = categorizedRefs.filter(r => r.category === 'background');
  const props = categorizedRefs.filter(r => r.category === 'prop');

  let systemPrompt = `[CORE TASK]: GENERATE A SEAMLESS ${gridType} STORYBOARD GRID.

[STRICT LAYOUT RULE]:
- Exactly ${gridSize} rows and ${gridSize} columns.
- FULL IMAGE ASPECT RATIO: ${containerAspectRatio}.
- INDIVIDUAL PANEL ASPECT RATIO: ${panelAspectRatio}.

${collageRef ? `
[SHOT GROUP REFERENCE - HIGHEST PRIORITY]:
- You are provided with a VISUAL REFERENCE GRID (Collage).
- For each panel, you MUST MATCH the EXACT:
  1. SHOT SIZE (CU, MCU, LS, etc.) from the reference.
  2. CAMERA ANGLE (Low, Eye-level, High-angle, Dutch tilt) from the reference.
  3. CHARACTER ORIENTATION (Back to camera, Profile, 3/4 view) from the reference.
  4. COMPOSITION (Rule of thirds, Center-framed, Leading lines) from the reference.
- IMPORTANT: Only replicate the SHOT ATTRIBUTES. DO NOT copy the specific people or objects from the collage. Replace them with the current character and scene content described in the prompt.
` : ''}

[CHARACTER ANATOMY PRESERVATION]:
- The provided 'role' reference images define the ABSOLUTE morphology of the character.
- STRICTLY adhere to the anatomical structure of the role. If the character is a simple blob, creature, or object without legs/arms/human body, IT MUST REMAIN IN THAT FORM.
- DO NOT spontaneously generate legs, feet, bodies, or human-like limbs if they are not explicitly shown in the role reference.

[NEGATIVE CONSTRAINTS]:
- NO WHITE BARS, NO BLACK BARS, NO LETTERBOXING.
- NO PADDING OR MARGINS BETWEEN PANELS. NO INTERNAL GRID LINES.

[SCENE]: "${prompt}"

${!collageRef && panelInstructions && panelInstructions.length > 0 ? `\n[PANEL DETAILS (TEXT LOGIC)]:\n${panelInstructions.map((instr, idx) => `Panel ${idx + 1}: ${instr}`).join('\n')}` : ''}

[STYLE]: Hyper-realistic cinematic film, 35mm photography. Consistent lighting and grading.`;

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
  const cleanBase64 = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;
  const parts: any[] = [{ inlineData: { mimeType: 'image/png', data: cleanBase64 } }];
  if (refImageBase64) parts.push({ inlineData: { mimeType: 'image/png', data: refImageBase64.split(',')[1] } });
  
  parts.push({ text: `EDIT TASK: Modify this ${aspectRatio} cinematic shot.
REQUEST: "${editPrompt}"
ANATOMY RULE: Preserve the original morphology and anatomical structure of the character in the image. DO NOT add limbs (legs/arms) if they are not part of the character's design.
RULE: ABSOLUTELY NO BLACK/WHITE BORDERS. Maintain full-bleed framing.` });

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
    try {
        const response = await withRetry<GenerateContentResponse>(() => {
            const ai = getClient();
            return ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: { 
                  parts: [{ 
                    text: `你是一个世界级的电影摄影指导。基于场景描述，规划 ${panelCount} 个极具专业深度的电影级分镜脚本。
                    
                    场景：${prompt}
                    
                    每个分镜描述必须严格包含以下要素，并以专业电影术语描述：
                    1. [环境信息]：具体的时间点与天气氛围。
                    2. [镜头语言]：具体的景别与构图逻辑。
                    3. [镜头视角与焦段]：明确视角及具体的焦段感。
                    4. [动态状态]：说明是静态镜头、平滑横移还是带有动态模糊的快速移动。
                    5. [角色构图元素]：描述角色朝向、在画面中的具体坐标位置、画面占比以及具体的动作。
                    
                    重要规则：
                    - 禁止描述角色的长相特征、面部细节。仅将其视为构图元素。
                    - 请输出 ${panelCount} 行纯文本，每行代表一个独立的分镜片段，不要带编号。` 
                  }] 
                }
            });
        });
        
        const rawText = response.text || "";
        const lines = rawText.split('\n')
            .map(line => line.replace(/^[0-9]+[.\-、\s]*/, '').trim())
            .filter(line => line.length > 5)
            .slice(0, panelCount);
            
        return lines;
    } catch (error) { 
        return new Array(panelCount).fill("专业级电影分镜：35mm焦段，导演级构图逻辑。"); 
    }
};

export const generateCameraMovement = async (prompt: string): Promise<string> => {
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
    try {
        const response = await withRetry<GenerateContentResponse>(() => {
            const ai = getClient();
            return ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: { 
                  parts: [
                    { text: `你是一个电影分镜脚本师。请将输入内容拆解为 ${count} 条独立且详尽的专业电影分镜指令。
                    
                    输入内容：
                    ${attachmentText || ''}
                    
                    附加指令：
                    ${instruction}
                    
                    每条指令必须包含：时间天气、景别构图、焦段视角、动静态、角色位置动作。` }
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
    try {
        const response = await withRetry<GenerateContentResponse>(() => {
            const ai = getClient();
            return ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: { 
                  parts: [
                    { text: `根据这些分镜描述生成一个总体的剧情梗概：
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
