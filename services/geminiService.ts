
import { GoogleGenAI } from "@google/genai";
import { AspectRatio, ImageSize, Asset } from "../types";

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

const validateAspectRatio = (ar: AspectRatio): string => {
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
  category: 'role' | 'background';
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
  cameraTrack?: string
): Promise<{ fullImage: string, slices: string[], slicePrompts: string[] }> => {
  await ensureApiKey();
  const ai = getClient();
  const model = 'gemini-3-pro-image-preview';
  
  const totalViews = gridRows * gridCols;
  const gridType = `${gridRows}x${gridCols}`;

  const roles = categorizedRefs.filter(r => r.category === 'role');
  const bgs = categorizedRefs.filter(r => r.category === 'background');

  let systemPrompt = `[核心任务]: 生成一个单张 ${gridType} 的电影级故事板网格图。
    - 内容主题: "${prompt}"
    - 画面数量: 必须包含精确的 ${totalViews} 个画面，展示剧情或动作的推进。
    - 输出要求: 必须返回两个部分：
      1. 一个包含 ${totalViews} 个字符串的 JSON 数组，每个字符串用中文简短描述该画面的具体内容（导演笔记）。
      2. 生成的图像网格部分。
    - 语言要求: 所有文本输出必须使用中文。`;

  if (cameraTrack && cameraTrack.trim()) {
      systemPrompt += `\n\n[镜头与景别要求]:
      - 必须严格遵守以下指定的镜头运动或景别拍摄方案: "${cameraTrack}"。
      - 如果提供了分镜别的详细说明，请确保网格中每个画面对应的景别（特写、中景、全景等）与描述一致。`;
  } else {
      systemPrompt += `\n\n[自动镜头生成]:
      - 请根据剧情内容自动设计最具电影感的运镜和景别变换（如从全景切入特写，或者环绕推移）。`;
  }

  if (roles.length > 0) {
      systemPrompt += `\n\n[角色一致性]:
      ${roles.map((r, i) => `- 参考图 ${i+1} 是 "角色 ${r.roleIndex}"。在所有画面中保持该角色的面部、服装和特征完全一致。`).join('\n')}`;
  }

  if (bgs.length > 0) {
      systemPrompt += `\n\n[环境设定]:
      - 使用提供的背景参考作为全局场景色调、光影和建筑风格的基准。将角色自然融入此环境中。`;
  }

  if (contextImage) {
      systemPrompt += `\n\n[叙事连贯性]:
      - 提供的上下文图像是前序镜头。请基于此图像推进剧情。`;
  }

  systemPrompt += `\n\n[风格控制]: 电影级写实，35mm 胶片感，体积光，深景深。画面中严禁出现任何文字或水印。`;

  const parts: any[] = [];
  roles.forEach(r => parts.push({ inlineData: { mimeType: r.mimeType, data: r.data } }));
  bgs.forEach(b => parts.push({ inlineData: { mimeType: b.mimeType, data: b.data } }));
  if (contextImage) {
      const cleanBase64 = contextImage.includes(',') ? contextImage.split(',')[1] : contextImage;
      parts.push({ inlineData: { mimeType: 'image/png', data: cleanBase64 } });
  }
  parts.push({ text: systemPrompt });

  try {
    const response = await ai.models.generateContent({
      model,
      contents: { parts },
      config: {
        imageConfig: {
          aspectRatio: validateAspectRatio(aspectRatio) as any,
          imageSize: imageSize as any 
        }
      }
    });

    let fullImageBase64 = '';
    let slicePrompts: string[] = [];

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        fullImageBase64 = `data:image/png;base64,${part.inlineData.data}`;
      } else if (part.text) {
        try {
          const jsonMatch = part.text.match(/\[.*\]/s);
          if (jsonMatch) {
            slicePrompts = JSON.parse(jsonMatch[0]);
          }
        } catch (e) {
          console.warn("解析分镜描述 JSON 失败:", e);
        }
      }
    }

    if (!fullImageBase64) throw new Error("渲染引擎未返回图像数据。");
    
    while (slicePrompts.length < totalViews) {
      slicePrompts.push(`画面 ${slicePrompts.length + 1}: ${prompt}`);
    }

    const panels = await sliceImageGrid(fullImageBase64, gridRows, gridCols);
    return { fullImage: fullImageBase64, slices: panels, slicePrompts };
  } catch (error: any) {
    console.error("网格生成错误:", error);
    throw error;
  }
};

export const generateCameraMovement = async (prompt: string): Promise<string> => {
    await ensureApiKey();
    const ai = getClient();
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: { parts: [{ text: `场景内容: ${prompt}` }] },
            config: { systemInstruction: "你是一个专业的电影摄影师。请输出一段简短的技术性镜头运动描述。不超过15个汉字。必须使用中文。" }
        });
        return response.text || "固定镜头。";
    } catch { return "电影感运镜。"; }
};

export const enhancePrompt = async (rawPrompt: string): Promise<string> => {
  await ensureApiKey();
  const ai = getClient();
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `请优化这段电影故事板提示词，使其更具视觉表现力，包含光影、构图和氛围细节。保持在60字以内。输入: "${rawPrompt}"。请输出中文。`,
    });
    return response.text || rawPrompt;
  } catch { return rawPrompt; }
};

export const analyzeAsset = async (fileBase64: string, mimeType: string, prompt: string): Promise<string> => {
  await ensureApiKey();
  const ai = getClient();
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: { parts: [{ inlineData: { mimeType, data: fileBase64 } }, { text: prompt }] },
      config: { systemInstruction: "你是一个资深的视觉分析专家，请使用中文进行分析。" }
    });
    return response.text || "无分析结果。";
  } catch { return "分析失败。"; }
};

export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
  });
};
