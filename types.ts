
export enum AspectRatio {
  SQUARE = '1:1',
  STANDARD = '4:3',
  PORTRAIT = '3:4',
  WIDE = '16:9',
  MOBILE = '9:16'
}

export enum PanelAspectRatio {
  P3_4 = '3:4',
  P9_16 = '9:16',
  P2_3 = '2:3',
  P16_9 = '16:9',
  P3_2 = '3:2',
  P4_3 = '4:3',
  P1_1 = '1:1'
}

export enum ImageSize {
  K1 = '1K',
  K2 = '2K',
  K4 = '4K'
}

export type NodeType = 'prompt' | 'asset_group' | 'render' | 'slice';

export type AssetCategory = 'role' | 'background' | 'prop';

export interface GeneratedImage {
  id: string;
  url: string; 
  fullGridUrl?: string;
  prompt: string;
  aspectRatio: string;
  panelAspectRatio?: string;
  timestamp: number;
  
  // Node Graph Properties
  nodeType: NodeType; 
  parentId?: string; 
  position?: { x: number; y: number }; 
  
  // Specific data containers
  assetIds?: string[]; 
  textData?: string; 
  cameraDescription?: string; 
  slices?: string[]; 
  sliceHistory?: Record<number, string[]>; // Map slice index to array of past image URLs
  gridRows?: number;
  gridCols?: number;
}

export interface Asset {
  id: string;
  file: File;
  previewUrl: string;
  type: 'image' | 'video';
  category: AssetCategory;
  index?: number; // For Role 1, Role 2 or Prop 1, Prop 2 labeling
  analysis?: string;
}

export interface CollageData {
  url: string; // Stitched image base64
  rows: number;
  cols: number;
  aspectRatio: string;
}

export type InspectorTab = 'details' | 'analysis';

export interface ScriptItem {
  id: string;
  content: string;
  selected: boolean;
}

export interface SavedPrompt {
  id: string;
  title: string;
  content: string;
  timestamp: number;
}
