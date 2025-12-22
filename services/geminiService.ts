
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
  panelInstructions?: string[] 
): Promise<{ fullImage: string, slices: string[] }> => {
  await ensureApiKey();
  const ai = getClient();
  const model = 'gemini-3-pro-image-preview';
  
  const totalViews = gridRows * gridCols;
  const gridType = `${gridRows}x${gridCols}`;

  const roles = categorizedRefs.filter(r => r.category === 'role');
  const bgs = categorizedRefs.filter(r => r.category === 'background');
  const props = categorizedRefs.filter(r => r.category === 'prop');

  let systemPrompt = `[CORE TASK]: GENERATE A SINGLE ${gridType} CINEMATIC STORYBOARD GRID.
    - MAIN THEME: "${prompt}"
    - VIEWS: Exactly ${totalViews} unique panels showing narrative progression in a single image grid.`;

  if (panelInstructions && panelInstructions.length > 0) {
      systemPrompt += `\n\n[PANEL SPECIFICS]: Follow these specific camera and composition instructions for each panel index:
      ${panelInstructions.map((instr, idx) => `- Panel ${idx + 1}: ${instr || 'AI Choice'}`).join('\n')}`;
  }

  if (roles.length > 0) {
      systemPrompt += `\n\n[CHARACTER CONSISTENCY]:
      ${roles.map((r, i) => `- Reference Image ${i+1} is "ROLE ${r.roleIndex}". Maintain this character's specific facial features, hairstyle, and clothing across all panels.`).join('\n')}`;
  }

  if (props.length > 0) {
      systemPrompt += `\n\n[PROP/OBJECT CONSISTENCY]:
      ${props.map((p, i) => `- Reference Image ${roles.length + i + 1} is "KEY PROP ${p.roleIndex}". This is a critical object (e.g., a specific boat, weapon, tool). Whenever this object appears in a scene, it MUST precisely match the visual design, material, and details of this reference.`).join('\n')}`;
  }

  if (bgs.length > 0) {
      systemPrompt += `\n\n[ENVIRONMENT]:
      - Use the provided background reference for global scene mood, lighting, and architecture. Adapt characters and props into this setting consistently.`;
  }

  if (contextImage) {
      systemPrompt += `\n\n[STORY CONTINUITY]:
      - The separate context image is the previous shot. Progress the narrative while maintaining visual style and object/character designs.`;
  }

  systemPrompt += `\n\n[STYLING]: Photorealistic, 35mm film look, volumetric lighting, cinematic rendering. NO TEXT overlays.`;

  const parts: any[] = [];
  
  roles.forEach(r => parts.push({ inlineData: { mimeType: r.mimeType, data: r.data } }));
  props.forEach(p => parts.push({ inlineData: { mimeType: p.mimeType, data: p.data } }));
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
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        fullImageBase64 = `data:image/png;base64,${part.inlineData.data}`;
      }
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
  const ai = getClient();
  
  const cleanBase64 = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;

  const parts: any[] = [
    { inlineData: { mimeType: 'image/png', data: cleanBase64 } }
  ];

  if (refImageBase64) {
    const cleanRef = refImageBase64.includes(',') ? refImageBase64.split(',')[1] : refImageBase64;
    parts.push({ inlineData: { mimeType: 'image/png', data: cleanRef } });
  }

  let finalPrompt = editPrompt.trim() 
    ? `Edit this image according to the instruction: "${editPrompt}".` 
    : "Enhance this image to high resolution while maintaining all details and composition.";

  if (refImageBase64) {
    finalPrompt += " Use the provided second image as a visual style and content reference for the edit.";
  }

  finalPrompt += " Photorealistic cinematic render.";
  parts.push({ text: finalPrompt });

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: { parts },
      config: {
        imageConfig: {
          aspectRatio: validateAspectRatio(aspectRatio) as any,
          imageSize: modelName === 'gemini-3-pro-image-preview' ? imageSize as any : undefined
        }
      }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    throw new Error("No image data returned from edit engine.");
  } catch (error: any) {
    console.error("Image edit error:", error);
    throw error;
  }
};

export const generateCameraSuggestions = async (prompt: string, panelCount: number): Promise<string[]> => {
    await ensureApiKey();
    const ai = getClient();
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [{ text: `根据以下电影场景，建议 ${panelCount} 个逻辑性、渐进式的分镜镜头描述或构图。
            要求：仅列出建议，每行一个。不要编号。使用中文。
            场景内容：${prompt}` }] }
        });
        const text = response.text || "";
        return text.split('\n').filter(line => line.trim().length > 0).slice(0, panelCount);
    } catch { 
        return new Array(panelCount).fill("电影级构图。"); 
    }
};

export const generateCameraMovement = async (prompt: string): Promise<string> => {
    await ensureApiKey();
    const ai = getClient();
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [{ text: `场景: ${prompt}` }] },
            config: { systemInstruction: "Output ONLY a technical camera movement description for the overall scene. Max 10 words. Chinese." }
        });
        return response.text || "固定镜头。";
    } catch { return "电影动效。"; }
};

export const enhancePrompt = async (rawPrompt: string): Promise<string> => {
  await ensureApiKey();
  const ai = getClient();
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Enhance this cinematic storyboard prompt. Keep it under 60 words. Use Chinese. Input: "${rawPrompt}"`,
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
      contents: { parts: [{ inlineData: { mimeType, data: fileBase64 } }, { text: prompt }] }
    });
    return response.text || "No analysis result.";
  } catch { return "Analysis failed."; }
};

export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
  });
};
