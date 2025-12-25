
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

[STRICT CHARACTER ANATOMY & MORPHOLOGY PRESERVATION]:
- The provided 'role' reference images define the ABSOLUTE morphology of the character.
- CRITICAL RULE: Observe the character's physical structure. If the character is a simple shape, blob, creature, or object WITHOUT humanoid features (like the provided reference), IT MUST REMAIN IN THAT EXACT FORM.
- FORBIDDEN: DO NOT spontaneously generate, add, or suggest legs, feet, arms, humanoid hands, shoulders, or human-like skeletal structures if they are not explicitly present in the 'role' reference.
- NO EVOLUTION: Non-humanoid characters must NOT "grow" limbs or bodies to perform actions. They should roll, float, or hop as their natural shape dictates.
- CONSISTENCY: Maintain the exact proportions, eye placement, and lack of limbs across all ${totalViews} panels.

[NEGATIVE CONSTRAINTS]:
- NO WHITE BARS, NO BLACK BARS, NO LETTERBOXING.
- NO PADDING OR MARGINS BETWEEN PANELS. NO INTERNAL GRID LINES.
- NO HUMAN LUNGS, NO HUMAN TORSO, NO ARMS, NO LEGS (unless in reference).

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
  await ensureApiKey();
  const cleanBase64 = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;
  const parts: any[] = [{ inlineData: { mimeType: 'image/png', data: cleanBase64 } }];
  if (refImageBase64) parts.push({ inlineData: { mimeType: 'image/png', data: refImageBase64.split(',')[1] } });
  
  parts.push({ text: `EDIT TASK: Modify this ${aspectRatio} cinematic shot.
REQUEST: "${editPrompt}"
[STRICT ANATOMY RULE]: ABSOLUTELY PRESERVE the original morphology and anatomical structure of the character in the image. 
- DO NOT add limbs (legs, feet, arms, hands) if they are not part of the character's original design. 
- If the character is a simple shape or blob, keep it as a simple shape or blob. 
- DO NOT humanoid-ize the character.
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
                    
                    每个分镜描述必须严格包含以下要素，并以专业电影术语描述：
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
- 例如：若指令是“角色坐在办公室，黑洞冒出来吸走颜色”，应拆解为：1. 角色正常办公 -> 2. 黑洞从天花板突然冒出 -> 3. 黑洞开始吞噬色彩（画面半黑白半彩色） -> 4. 色彩完全消失。
- 每个分镜只描述一个核心视觉 beat。

每个分镜指令必须包含以下详尽要素，使用专业术语描述：
1. [环境基调]：具体的时间、天气及灯光氛围（如：冷调荧光灯、黄昏侧光）。
2. [镜头语言]：
   - 景别：特写(CU)、中景(MS)、全景(LS)等。
   - 构图：黄金分割、对称、框架式构图、对角线构图等。
   - 镜头角度与焦段：仰拍/俯拍/平视，明确具体的焦段感（如：35mm、50mm、85mm人像、远距离长焦等）。
3. [动态状态]：明确是静态镜头，还是带有“动态模糊”效果的横移、推拉、摇移或快速跟拍。
4. [角色呈现]：
   - 角色序号+名称（如：角色1大橙、角色2小青桔）。
   - 角色朝向：侧身朝左、背对镜头、3/4视角等。
   - 画面位置与占比：在画面中的具体坐标（如：左下角1/3处）、占据画面的百分比。
   - 具体的动作姿态：如“正在敲击键盘”、“惊恐地抬头仰望”、“身体微微前倾准备滑行”。

输入内容：
${attachmentText || ''}

附加指令：
${instruction}

输出要求：
- 请输出恰好 ${count} 行纯文本描述，每行代表一个分镜。
- 禁止输出序号（如 1. 2. 3.）、禁止引言或结束语。
- 每一行描述必须足够丰富、详细、实用，能够指导后续的AI生图引擎生成高度一致的画面。` }
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
                    { text: `请根据以下选中的分镜描述，总结成一段极其简洁（1-2句话）的故事梗概。
要求：
- 只描述核心人物、地点 and 核心事件。
- 语言平实直白，不要任何文学渲染、气氛描述或术语。
- 严禁分条列项。

示例1：角色1大橙和角色2小青桔在海边沙滩上晒太阳。
示例2：角色在办公室工作，天花板出现黑洞吸走周围物品，角色站在原地发呆。

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
