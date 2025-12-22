
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
  panelInstructions?: string[] // Added panel specific instructions
): Promise<{ fullImage: string, slices: string[] }> => {
  await ensureApiKey();
  const ai = getClient();
  const model = 'gemini-3-pro-image-preview';
  
  const totalViews = gridRows * gridCols;
  const gridType = `${gridRows}x${gridCols}`;

  const roles = categorizedRefs.filter(r => r.category === 'role');
  const bgs = categorizedRefs.filter(r => r.category === 'background');

  let systemPrompt = `[CORE TASK]: GENERATE A SINGLE ${gridType} CINEMATIC STORYBOARD GRID.
    - MAIN THEME: "${prompt}"
    - VIEWS: Exactly ${totalViews} unique panels showing narrative progression in a single image grid.`;

  if (panelInstructions && panelInstructions.length > 0) {
      systemPrompt += `\n\n[PANEL SPECIFICS]: Follow these specific camera and composition instructions for each panel index:
      ${panelInstructions.map((instr, idx) => `- Panel ${idx + 1}: ${instr || 'AI Choice'}`).join('\n')}`;
  }

  if (roles.length > 0) {
      systemPrompt += `\n\n[CHARACTER CONSISTENCY]:
      ${roles.map((r, i) => `- Reference Image ${i+1} is "ROLE ${r.roleIndex}". Keep this character's face, clothing, and features exactly as shown in all panels.`).join('\n')}`;
  }

  if (bgs.length > 0) {
      systemPrompt += `\n\n[ENVIRONMENT]:
      - Use the provided background reference for global scene mood, lighting, and architecture. Adapt the characters into this setting consistently across all panels.`;
  } else {
      systemPrompt += `\n\n[ENVIRONMENT]: Design a professional cinematic setting based on the text prompt.`;
  }

  if (contextImage) {
      systemPrompt += `\n\n[STORY CONTINUITY]:
      - The separate context image is the previous shot. Progress the narrative from that point while maintaining visual style.`;
  }

  systemPrompt += `\n\n[STYLING]: Photorealistic, 35mm film look, volumetric lighting, deep depth of field. NO TEXT overlay on images. High-fidelity cinematic rendering.`;

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
  aspectRatio: string = '1:1'
): Promise<string> => {
  await ensureApiKey();
  const ai = getClient();
  
  const cleanBase64 = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/png', data: cleanBase64 } },
          { text: `Edit this image according to the instruction: "${editPrompt}". Keep the overall cinematic style, character features, and composition as consistent as possible with the source. Photorealistic cinematic render.` }
        ]
      },
      config: {
        imageConfig: {
          aspectRatio: validateAspectRatio(aspectRatio) as any
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
            contents: { parts: [{ text: `Based on the following cinematic scene, suggest ${panelCount} logical, progressive camera movements or compositions for a storyboard sequence. 
            Format: List only the suggestions, one per line. No numbering.
            Scene: ${prompt}` }] }
        });
        const text = response.text || "";
        return text.split('\n').filter(line => line.trim().length > 0).slice(0, panelCount);
    } catch { 
        return new Array(panelCount).fill("Cinematic composition."); 
    }
};

export const generateCameraMovement = async (prompt: string): Promise<string> => {
    await ensureApiKey();
    const ai = getClient();
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [{ text: `Scene: ${prompt}` }] },
            config: { systemInstruction: "Output ONLY a technical camera movement description for the overall scene. Max 10 words. English." }
        });
        return response.text || "Static shot.";
    } catch { return "Cinematic move."; }
};

export const enhancePrompt = async (rawPrompt: string): Promise<string> => {
  await ensureApiKey();
  const ai = getClient();
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Enhance this cinematic storyboard prompt. Keep it under 60 words. Input: "${rawPrompt}"`,
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
