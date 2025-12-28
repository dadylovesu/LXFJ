
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

const getClient = () => {
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

async function withRetry<T>(operation: () => Promise<T>, maxRetries = 5): Promise<T> {
  let lastError: any;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      
      // 提取错误信息，因为 SDK 可能返回对象或 stringified JSON
      const errorMsg = error?.message || String(error);
      const statusCode = error?.status || error?.code;

      // 针对 503 (Deadline expired / UNAVAILABLE) 进行深度识别
      const isOverloaded = 
        statusCode === 'UNAVAILABLE' || 
        statusCode === 503 || 
        errorMsg.includes("503") || 
        errorMsg.includes("Deadline expired") ||
        errorMsg.includes("UNAVAILABLE");

      const isRateLimited = 
        statusCode === 'RESOURCE_EXHAUSTED' || 
        statusCode === 429 || 
        errorMsg.includes("429") || 
        errorMsg.includes("RESOURCE_EXHAUSTED");

      if ((isOverloaded || isRateLimited) && attempt < maxRetries) {
        // 对于 503 等重负载错误，采用更长的初始延迟和指数退避
        const baseDelay = isOverloaded ? 5000 : 2000;
        const delay = Math.pow(1.5, attempt) * baseDelay + Math.random() * 2000;
        console.debug(`[GeminiService] Attempt ${attempt + 1} failed. Retrying in ${Math.round(delay)}ms...`);
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
    let pitchDesc = "";
    if (p.pitch > 0) {
      pitchDesc = `俯视角 ${p.pitch}度`;
    } else if (p.pitch < 0) {
      pitchDesc = `仰角 ${Math.abs(p.pitch)}度`;
    } else {
      pitchDesc = "水平视角";
    }

    let yawDesc = "";
    if (p.yaw > 0) {
      yawDesc = `向右旋转 ${p.yaw}度视角`;
    } else if (p.yaw < 0) {
      yawDesc = `向左旋转 ${Math.abs(p.yaw)}度视角`;
    } else {
      yawDesc = "正前方视角";
    }

    return `使用 ${p.focalLength}mm 镜头拍摄。镜头角度：${pitchDesc}，${yawDesc}。画面内容必须基于参考图进行视角转换，保持角色和环境一致。`;
  });

  const panelDescriptionsText = panelPrompts.map((p, i) => `分镜 ${i + 1}: ${p}`).join("\n");

  let styleInstruction = stylePrompt && stylePrompt.trim() 
    ? `[视觉风格核心指令]: 严格锁定风格为: "${stylePrompt}"。`
    : "[视觉风格]: 高级电影质感，35mm 胶片摄影风格。";

  if (styleRefImage) {
    styleInstruction += " [绝对风格参照]: 提供的‘风格参考图’是唯一的视觉准则。必须1:1复刻其调色方案、光影对比度、影调氛围、画面颗粒感和艺术质感。禁止使用默认的写实风格，必须完全向参考图偏移。";
  }

  const systemPrompt = `[核心任务]: 3D 多角度一致性重绘。
[参考基准]: 你将获得一张名为“锚点”的参考图。
[任务逻辑]: 保持锚点图中的角色、环境、光影不变。仅根据下方提供的摄像机参数（焦段、俯仰角、旋转角）重新渲染每一格画面。

${styleInstruction}

[布局]: ${gridSize}x${gridSize} 宫格。
[比例]: 容器比例 ${containerAspectRatio}, 单格比例 ${panelAspectRatio}。

[分镜指令]:
${panelDescriptionsText}`;

  const parts: any[] = [
    { inlineData: { mimeType: 'image/png', data: anchorImageBase64 } }
  ];

  if (styleRefImage) {
    parts.push({ inlineData: { mimeType: 'image/png', data: styleRefImage.split(',')[1] } });
  }

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
    return { fullImage: fullImageBase64, slices: panels, panelPrompts };
  } catch (error: any) {
    console.error("Lens Lab gen error:", error);
    throw error;
  }
};

export const generateMultiViewGrid = async (
  prompt: string,
  gridSize: number, 
  panelAspectRatio: PanelAspectRatio,
  containerAspectRatio: AspectRatio,
  imageSize: ImageSize, 
  categorizedRefs: ReferenceImageData[] = [],
  contextImage?: string,
  panelInstructions?: string[],
  collageRef?: CollageData,
  stylePrompt?: string,
  styleRefImage?: string
): Promise<{ fullImage: string, slices: string[] }> => {
  await ensureApiKey();
  
  const totalViews = gridSize * gridSize;
  const gridType = `${gridSize}x${gridSize}`;

  const isVertical = panelAspectRatio === PanelAspectRatio.P9_16 || panelAspectRatio === PanelAspectRatio.P3_4;
  const isWidescreen = panelAspectRatio === PanelAspectRatio.P16_9 || panelAspectRatio === PanelAspectRatio.P4_3;
  const isSquare = panelAspectRatio === PanelAspectRatio.P1_1;
  
  let compositionInstruction = "";
  let formatKeywords = "";

  if (isVertical) {
    formatKeywords = "VERTICAL PORTRAIT ORIENTATION, MOBILE FORMAT, TALL FRAME";
    compositionInstruction = `MANDATORY: Use EDGE-TO-EDGE VERTICAL COMPOSITION. The ENTIRE CANVAS must be a single vertical ${containerAspectRatio} block. NO BLACK BARS on left or right. NO HORIZONTAL LETTERBOXING. Each of the ${totalViews} panels must be a vertical ${panelAspectRatio} rectangle.`;
  } else if (isSquare) {
    formatKeywords = "SQUARE COMPOSITION, 1:1 FORMAT";
    compositionInstruction = `MANDATORY: Use FULL-BLEED SQUARE COMPOSITION. ZERO GUTTERS. The ENTIRE CANVAS must be a perfect 1:1 square. Each panel must be perfectly contiguous.`;
  } else if (isWidescreen) {
    formatKeywords = "WIDESCREEN LANDSCAPE, CINEMATIC HORIZONTAL";
    compositionInstruction = `MANDATORY: Use CINEMATIC WIDESCREEN with ZERO LETTERBOXING. The ENTIRE CANVAS must be a horizontal ${containerAspectRatio} block. Ensure the content fills the entire area completely.`;
  }

  const roles = categorizedRefs.filter(r => r.category === 'role');
  const bgs = categorizedRefs.filter(r => r.category === 'background');
  const props = categorizedRefs.filter(r => r.category === 'prop');

  let styleInstruction = stylePrompt && stylePrompt.trim() 
    ? `[MANDATORY STYLE CONSTRAINT]: Every panel MUST strictly mirror this artistic style: "${stylePrompt}".`
    : `[STYLE]: Hyper-realistic cinematic film, 35mm photography.`;

  if (styleRefImage) {
    styleInstruction = `[ULTIMATE VISUAL ANCHOR]: A Style Reference Image is provided. 
- You MUST CLONE the visual essence of this reference image. 
- Match the EXACT color grading (LUT), lighting temperature, shadow depth, and highlights.
- Replicate the specific film grain, lens characteristics, and overall atmospheric texture across ALL ${totalViews} panels. 
- The reference image's aesthetic is MANDATORY and supersedes all default rendering styles.`;
  }

  let systemPrompt = `[CORE TASK]: GENERATE A SEAMLESS ${gridType} STORYBOARD GRID.

[STRICT LAYOUT & FORMAT RULE]:
- FORMAT: ${formatKeywords}.
- CANVAS RATIO: The WHOLE generated image MUST BE ${containerAspectRatio}.
- PANEL LAYOUT: Exactly ${gridSize} rows and ${gridSize} columns.
- PANEL RATIO: Every individual panel MUST BE ${panelAspectRatio}.
- ${compositionInstruction}

${styleInstruction}

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

[STRICT CHARACTER ANATOMY & MORPHOLOGY PRESERVATION]:
- The provided 'role' reference images define the ABSOLUTE morphology of the character.
- CRITICAL RULE: Observe the character's physical structure. If the character is a simple shape, blob, creature, or object WITHOUT humanoid features (like the provided reference), IT MUST REMAIN IN THAT EXACT FORM.
- FORBIDDEN: DO NOT spontaneously generate, add, or suggest legs, feet, arms, humanoid hands, shoulders, or human-like skeletal structures if they are not explicitly present in the 'role' reference.
- NO EVOLUTION: Non-humanoid characters must NOT "grow" limbs or bodies to perform actions. They should roll, float, or hop as their natural shape dictates.
- CONSISTENCY: Maintain the exact proportions, eye placement, and lack of limbs across all ${totalViews} panels.

[NEGATIVE CONSTRAINTS]:
- NO WHITE BARS, NO BLACK BARS, NO LETTERBOXING, NO PILLARBOXING.
- NO PADDING OR MARGINS BETWEEN PANELS. NO INTERNAL GRID LINES.

[SCENE]: "${prompt}"

${!collageRef && panelInstructions && panelInstructions.length > 0 ? `\n[PANEL DETAILS (TEXT LOGIC)]:\n${panelInstructions.map((instr, idx) => `Panel ${idx + 1}: ${instr}`).join('\n')}` : ''}`;

  const parts: any[] = [];
  roles.forEach(r => parts.push({ inlineData: { mimeType: r.mimeType, data: r.data } }));
  bgs.forEach(b => parts.push({ inlineData: { mimeType: b.mimeType, data: b.data } }));
  props.forEach(p => parts.push({ inlineData: { mimeType: p.mimeType, data: p.data } }));
  
  if (styleRefImage) {
    parts.push({ 
      inlineData: { mimeType: 'image/png', data: styleRefImage.split(',')[1] }
    });
  }

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
  imageSize: ImageSize = ImageSize.K1,
  stylePrompt?: string,
  styleRefImage?: string
): Promise<string> => {
  await ensureApiKey();
  const cleanBase64 = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;
  const parts: any[] = [{ inlineData: { mimeType: 'image/png', data: cleanBase64 } }];
  if (refImageBase64) parts.push({ inlineData: { mimeType: 'image/png', data: refImageBase64.split(',')[1] } });
  if (styleRefImage) parts.push({ inlineData: { mimeType: 'image/png', data: styleRefImage.split(',')[1] } });
  
  const isVertical = aspectRatio === '9:16' || aspectRatio === '3:4';
  const formatTag = isVertical ? "VERTICAL PORTRAIT" : "LANDSCAPE";

  let styleConstraint = stylePrompt && stylePrompt.trim() 
    ? `MANDATORY STYLE: Strictly follow the artistic style description: "${stylePrompt}".`
    : "Maintain cinematic 35mm photography consistency.";

  if (styleRefImage) {
    styleConstraint = `[MANDATORY STYLE OVERRIDE]: You MUST adopt the EXACT visual style, color palette, lighting, and texture of the provided style reference image. This is a strict requirement for aesthetic consistency.`;
  }

  parts.push({ text: `EDIT TASK: Modify this ${aspectRatio} (${formatTag}) cinematic shot.
REQUEST: "${editPrompt}"
[STRICT ANATOMY RULE]: ABSOLUTELY PRESERVE the original morphology and anatomical structure of the character in the image. 
- DO NOT add limbs (legs, feet, arms, hands) if they are not part of the character's original design. 
- If the character is a simple shape or blob, keep it as a simple shape or blob. 
- DO NOT humanoid-ize the character.
${styleConstraint}
RULE: ABSOLUTELY NO BLACK/WHITE BORDERS. Maintain full-bleed ${aspectRatio} framing. Ensure the output strictly matches the ${aspectRatio} ratio.` });

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
                    text: `你是一个世界级的电影摄影指导。基于场景描述，规划 ${panelCount} 个极具专业深度的电影级分镜脚本。
                    
                    场景：${prompt}
                    
                    每个分镜描述必须严格包含以下要素，并以 professional 电影术语描述：
                    1. [环境信息]：具体的时间点与天气氛围。
                    2. [镜头语言]：具体的景别与构图逻辑。
                    3. [镜头视角与焦段]：明确视角及具体的焦段感。
                    4. [动态状态]：说明是静态镜头、平滑横移还是带有动态模糊的快速移动。
                    5. [角色构图元素]：描述角色朝向、在画面中的具体坐标位置、画面占比以及具体的动作姿态。
                    
                    输出要求：
                    - 输出 ${panelCount} 行纯文本，每行代表一个独立的分镜片段。
                    - 禁止序号，禁止开场白。` 
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
            lines.push("清晨，微弱阳光，中景，黄金分割构图，佳能 50mm f/1.2 视角，静态镜头，角色位于画面中央，侧身朝向右侧，占据画面约 30%，正在静立观察。");
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
                    { text: `你是一个世界级电影分镜脚本专家。你的任务是将输入的故事梗概或指令，按照严谨的电影叙事逻辑，拆解为 ${count} 个独立且高度专业的精细化分镜指令。

逻辑规则（核心）：
- 严禁在一个分镜中写完整个动作过程。必须将故事根据逻辑拆分为多个连续的瞬间。
- 每个分镜只描述一个核心视觉 beat。

每个分镜指令必须包含以下详尽要素，使用专业术语描述：
1. [环境基调]：具体的时间、天气及灯光氛围。
2. [镜头语言]：景别、构图、镜头角度与焦段。
3. [动态状态]：明确是静态还是动态模糊推拉摇移。
4. [角色呈现]：动作姿态、朝向、位置占比。

输入内容：
${attachmentText || ''}

附加指令：
${instruction}

输出要求：
- 请输出恰好 ${count} 行纯文本描述，每行代表一个分镜。` }
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
                    { text: `请根据以下选中的分镜描述，总结成一段极其简洁（1-2句话）的故事梗概。
分镜描述内容：
${scripts.join('\n')}` }
                  ] 
                }
            });
        });
        return response.text?.trim() || "选中的分镜场景。";
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
