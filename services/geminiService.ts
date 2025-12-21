
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

  let finalPrompt = `[CORE TASK]: Generate a single high-fidelity SEAMLESS ${gridType} storyboarding grid containing exactly ${totalViews} DIFFERENT and NEW panels.
    - LAYOUT: Mandatory ${gridRows} rows by ${gridCols} columns. Zero padding, zero borders.
    
    [NEW SCENE CONTENT]: "${prompt}"`;

  if (contextImage) {
      finalPrompt += `
      
    [TEMPORAL CONTINUITY INSTRUCTIONS]:
    - The provided "Context Image" represents the PREVIOUS scene/shot.
    - Your output MUST depict a NEW SEQUENCE of events that occurs AFTER the context image.
    - DO NOT REPLICATE or REPRODUCE the context image. Your panels must show DIFFERENT actions, movements, and story progression.
    - CONSISTENCY: Maintain exact character design, facial features, clothing, and environment style as shown in the Context Image, but in ENTIRELY NEW poses and angles.
    - Think of this as "Scene 2" or "Shot 2" following the reference.`;
      
      if (referenceImages.length > 0) {
          finalPrompt += `
    - ACTION MAPPING: Use the additional "Action References" provided only to influence the new composition and poses for this sequence.`;
      }
  } else if (referenceImages.length > 0) {
      finalPrompt += `
      
    [REFERENCE INSTRUCTION]:
    - Use provided images as visual references for style, mood, and character baseline.`;
  }

  finalPrompt += `
  
    [TECHNICAL REQUIREMENTS]:
    - Cinematic 8k rendering, photorealistic, professional lighting.
    - Varied camera angles within the grid (e.g., mix of close-ups, medium shots, and wide shots as defined by the flow).
    - No text, no captions, no watermarks.`;

  const parts: any[] = [];
  
  // 1. Context (Previous Shot)
  if (contextImage) {
      const cleanBase64 = contextImage.includes(',') ? contextImage.split(',')[1] : contextImage;
      parts.push({
          inlineData: {
              mimeType: 'image/png',
              data: cleanBase64
          }
      });
  }
  
  // 2. Style/Action References
  for (const ref of referenceImages) {
    parts.push({
      inlineData: {
        mimeType: ref.mimeType,
        data: ref.data
      }
    });
  }
  
  // 3. The Final Prompt
  parts.push({ text: finalPrompt });

  try {
    const response = await ai.models.generateContent({
      model,
      contents: {
        parts: parts
      },
      config: {
        imageConfig: {
          aspectRatio: aspectRatio,
          imageSize: imageSize as any 
        }
      }
    });

    let fullImageBase64 = '';
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        fullImageBase64 = `data:image/png;base64,${part.inlineData.data}`;
        break;
      }
    }

    if (!fullImageBase64) throw new Error("未能生成 Grid 图片");

    const panels = await sliceImageGrid(fullImageBase64, gridRows, gridCols);
    return { fullImage: fullImageBase64, slices: panels };

  } catch (error) {
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
