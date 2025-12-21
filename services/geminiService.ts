
import { GoogleGenAI } from "@google/genai";
import { AspectRatio, ImageSize } from "../types";

// Helper to ensure API key selection for premium models
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
 * Gemini 3 Image models only support: "1:1", "3:4", "4:3", "9:16", "16:9"
 * This helper maps unsupported custom ratios to the nearest supported standard.
 */
const validateAspectRatio = (ar: AspectRatio): string => {
  const supported = ["1:1", "3:4", "4:3", "9:16", "16:9"];
  if (supported.includes(ar)) return ar;

  switch (ar) {
    case AspectRatio.CINEMA: return "16:9";
    case AspectRatio.PHOTO_LANDSCAPE: return "3:2" as any === "16:9" ? "16:9" : "4:3"; 
    case AspectRatio.PHOTO_PORTRAIT: return "3:4";
    default: return "16:9";
  }
};

// Helper to slice a grid image into individual images
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
      
      if (!ctx) {
        reject(new Error("无法获取画布上下文"));
        return;
      }

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            ctx.clearRect(0, 0, pieceWidth, pieceHeight);
            ctx.drawImage(
                img, 
                c * pieceWidth, 
                r * pieceHeight, 
                pieceWidth, 
                pieceHeight, 
                0, 
                0, 
                pieceWidth, 
                pieceHeight
            );
            pieces.push(canvas.toDataURL('image/png'));
        }
      }
      resolve(pieces);
    };
    img.onerror = (e) => reject(new Error("无法加载图片进行切片"));
    img.src = base64Data;
  });
};

const getAspectRatioValue = (ar: string): number => {
  const [w, h] = ar.split(':').map(Number);
  return w / h;
};

export const stitchImages = (
  files: File[], 
  rows: number,
  cols: number,
  targetAspectRatio: string = '16:9'
): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (files.length === 0) {
      reject(new Error("No files provided"));
      return;
    }

    const images: HTMLImageElement[] = [];
    let loadedCount = 0;

    const checkDone = () => {
      loadedCount++;
      if (loadedCount === files.length) {
        drawGrid();
      }
    };

    files.forEach(file => {
      const img = new Image();
      img.onload = checkDone;
      img.onerror = checkDone; 
      img.src = URL.createObjectURL(file);
      images.push(img);
    });

    const drawGrid = () => {
      const totalWidth = 2048; 
      const arValue = getAspectRatioValue(targetAspectRatio);
      const totalHeight = Math.round(totalWidth / arValue);

      const cellWidth = totalWidth / cols;
      const cellHeight = totalHeight / rows;

      const canvas = document.createElement('canvas');
      canvas.width = totalWidth;
      canvas.height = totalHeight;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error("Canvas context error"));
        return;
      }

      ctx.fillStyle = "#0a0a0a";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      images.forEach((img, index) => {
        if (index >= rows * cols) return; 

        const r = Math.floor(index / cols);
        const c = index % cols;
        const x = c * cellWidth;
        const y = r * cellHeight;

        const scale = Math.max(cellWidth / img.width, cellHeight / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        const ox = (cellWidth - w) / 2;
        const oy = (cellHeight - h) / 2;

        ctx.save();
        ctx.beginPath();
        ctx.rect(x, y, cellWidth, cellHeight);
        ctx.clip();
        ctx.drawImage(img, x + ox, y + oy, w, h);
        ctx.restore();
      });

      resolve(canvas.toDataURL('image/jpeg', 0.9));
    };
  });
};

export interface ReferenceImageData {
  mimeType: string;
  data: string;
}

export const generateMultiViewGrid = async (
  prompt: string,
  gridRows: number, 
  gridCols: number, 
  aspectRatio: AspectRatio,
  imageSize: ImageSize, 
  referenceImages: ReferenceImageData[] = [],
  contextImage?: string 
): Promise<{ fullImage: string, slices: string[] }> => {
  await ensureApiKey();
  const ai = getClient();
  const model = 'gemini-3-pro-image-preview';
  
  const totalViews = gridRows * gridCols;
  const gridType = `${gridRows}x${gridCols}`;

  // PRIMARY INSTRUCTION: Must start with the clear generation command
  let finalPrompt = `[CORE INSTRUCTION]: ACT AS AN IMAGE GENERATION MODEL. GENERATE AND RETURN A SINGLE ${gridType} IMAGE GRID.
    - CONTENT: Create exactly ${totalViews} distinct panels illustrating the following scene: "${prompt}"
    - FORMAT: One seamless image containing a ${gridRows}x${gridCols} grid. No text overlays, no white borders between panels.`;

  if (contextImage) {
      finalPrompt += `
      
    [STORY CONTINUITY]:
    - The first provided image is the PREVIOUS SCENE.
    - GENERATE THE NEXT CHAPTER: Do not repeat the previous image. 
    - PROGRESSION: Show new movements, new angles, and advanced plot points.
    - CONSISTENCY: Keep characters, lighting, and environmental style exactly as seen in the previous scene.`;
  }

  finalPrompt += `
  
    [TECHNICAL SPEC]:
    - Photorealistic cinematic style, high dynamic range, detailed textures.
    - Varied camera blocking: Mix close-ups and wide shots for cinematic flow.
    - NO TEXT, NO SPEECH BUBBLES, NO CAPTIONS.`;

  const parts: any[] = [];
  
  // Important: Reference images first for model to understand context before instructions
  if (contextImage) {
      const cleanBase64 = contextImage.includes(',') ? contextImage.split(',')[1] : contextImage;
      parts.push({
          inlineData: {
              mimeType: 'image/png',
              data: cleanBase64
          }
      });
  }
  
  for (const ref of referenceImages) {
    parts.push({
      inlineData: {
        mimeType: ref.mimeType,
        data: ref.data
      }
    });
  }
  
  // The Instruction Part
  parts.push({ text: finalPrompt });

  try {
    const response = await ai.models.generateContent({
      model,
      contents: {
        parts: parts
      },
      config: {
        imageConfig: {
          aspectRatio: validateAspectRatio(aspectRatio) as any,
          imageSize: imageSize as any 
        }
      }
    });

    let fullImageBase64 = '';
    let responseText = '';

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        fullImageBase64 = `data:image/png;base64,${part.inlineData.data}`;
      } else if (part.text) {
        responseText += part.text;
      }
    }

    if (!fullImageBase64) {
      // If no image but we have text, the model might be refusing or explaining something
      if (responseText) {
        throw new Error(`渲染引擎拒绝生成: ${responseText}`);
      }
      throw new Error("模型未返回图像数据，请尝试简化提示词或检查内容安全。");
    }

    const panels = await sliceImageGrid(fullImageBase64, gridRows, gridCols);
    return { fullImage: fullImageBase64, slices: panels };

  } catch (error: any) {
    console.error("Grid generation error:", error);
    throw error;
  }
};

export const generateCameraMovement = async (
    prompt: string
): Promise<string> => {
    await ensureApiKey();
    const ai = getClient();
    const model = 'gemini-2.5-flash';

    const systemInstruction = `You are a specialized AI Video prompter assistant. 
    Analyze the scene description and provide a technical Camera Movement Prompt that can be used for video generation models.
    
    Output ONLY the camera movement description. Max 15 words. English.`;

    try {
        const response = await ai.models.generateContent({
            model,
            contents: { parts: [{ text: `Scene: ${prompt}` }] },
            config: { systemInstruction }
        });
        return response.text || "Static shot, slow zoom.";
    } catch (error) {
        console.error("Camera gen error:", error);
        return "Cinematic movement.";
    }
}

export const analyzeAsset = async (
  fileBase64: string,
  mimeType: string,
  prompt: string
): Promise<string> => {
  await ensureApiKey();
  const ai = getClient();
  const model = 'gemini-3-pro-preview';

  try {
    const response = await ai.models.generateContent({
      model,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: fileBase64
            }
          },
          { text: prompt }
        ]
      }
    });

    return response.text || "无法获取分析结果。";
  } catch (error) {
    console.error("Analysis error:", error);
    throw error;
  }
};

export const enhancePrompt = async (rawPrompt: string): Promise<string> => {
  await ensureApiKey();
  const ai = getClient();
  const model = 'gemini-2.5-flash';

  try {
    const response = await ai.models.generateContent({
      model,
      contents: `You are a film director's assistant. Rewrite the following scene description into a detailed, cinematic image generation prompt. Focus on lighting, camera angle, texture, and mood. Keep it under 100 words. \n\nInput: "${rawPrompt}"`,
    });
    return response.text || rawPrompt;
  } catch (error) {
    console.error("Prompt enhancement error:", error);
    return rawPrompt;
  }
};

export const generateCinematicPrompt = async (
  baseIdea: string,
  referenceImages: ReferenceImageData[] = []
): Promise<string> => {
  await ensureApiKey();
  const ai = getClient();
  const model = 'gemini-2.5-flash';

  const systemInstruction = `You are a professional Director of Photography assistant.
  Your goal is to ENHANCE the user's existing idea with technical camera keywords.
  
  Format: [Original User Idea] + ", " + [Technical Keywords]`;

  const contents: any[] = [];
  
  if (baseIdea.trim()) {
    contents.push({ text: `User Idea: "${baseIdea}"` });
  } else {
    contents.push({ text: `User Idea: Cinematic shot based on references.` });
  }

  referenceImages.forEach(ref => {
    contents.push({
      inlineData: {
        mimeType: ref.mimeType,
        data: ref.data
      }
    });
  });

  try {
    const response = await ai.models.generateContent({
      model,
      config: {
        systemInstruction,
        temperature: 0.7 
      },
      contents: { parts: contents }
    });
    return response.text || baseIdea;
  } catch (error) {
    console.error("Auto-Director error:", error);
    return baseIdea;
  }
};

export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = error => reject(error);
  });
};
