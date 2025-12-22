
export enum AspectRatio {
  SQUARE = '1:1',
  STANDARD = '4:3',
  PORTRAIT = '3:4',
  WIDE = '16:9',
  MOBILE = '9:16',
  CINEMA = '21:9',
  PHOTO_LANDSCAPE = '3:2',
  PHOTO_PORTRAIT = '2:3'
}

export enum ImageSize {
  K1 = '1K',
  K2 = '2K',
  K4 = '4K'
}

export type NodeType = 'prompt' | 'asset_group' | 'render' | 'slice';

export type AssetCategory = 'role' | 'background';

export interface GeneratedImage {
  id: string;
  url: string; 
  fullGridUrl?: string;
  prompt: string;
  aspectRatio: string;
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
  slicePrompts?: string[]; // Added: Individual prompts for each panel
  gridRows?: number;
  gridCols?: number;
}

export interface Asset {
  id: string;
  file: File;
  previewUrl: string;
  type: 'image' | 'video';
  category: AssetCategory;
  index?: number; // For Role 1, Role 2 labeling
  analysis?: string;
}

export type InspectorTab = 'details' | 'analysis';
