
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AssetBay } from './components/AssetBay';
import { DirectorDeck } from './components/DirectorDeck';
import { Canvas } from './components/Canvas';
import { Inspector } from './components/Inspector';
import { CameraEditor } from './components/CameraEditor';
import { CollageEditor } from './components/CollageEditor';
import { ScriptEditor } from './components/ScriptEditor';
import { Asset, GeneratedImage, AspectRatio, ImageSize, AssetCategory, CollageData, PanelAspectRatio } from './types';
import { generateMultiViewGrid, fileToBase64, enhancePrompt, analyzeAsset, ReferenceImageData, generateCameraMovement, editImage } from './services/geminiService';
import { saveToStorage, loadFromStorage, clearStorage } from './services/persistenceService';
import { AlertCircle, X as XIcon, Trash2, LayoutGrid } from 'lucide-react';
import { Button } from './components/Button';
// @ts-ignore
import JSZip from 'jszip';

const App: React.FC = () => {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [history, setHistory] = useState<GeneratedImage[][]>([]);
  
  const [selectedImageId, setSelectedImageId] = useState<string | undefined>(undefined);
  const [selectedAssetId, setSelectedAssetId] = useState<string | undefined>(undefined);
  
  const [gridRows, setGridRows] = useState(2);
  const [gridCols, setGridCols] = useState(2);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio | string>(AspectRatio.WIDE);
  const [panelAspectRatio, setPanelAspectRatio] = useState<PanelAspectRatio>(PanelAspectRatio.P16_9);
  const [imageSize, setImageSize] = useState<ImageSize>(ImageSize.K4);
  const [prompt, setPrompt] = useState<string>('');
  const [panelPrompts, setPanelPrompts] = useState<string[]>([]);
  const [isCameraEditorOpen, setIsCameraEditorOpen] = useState(false);
  const [isCollageEditorOpen, setIsCollageEditorOpen] = useState(false);
  const [isScriptEditorOpen, setIsScriptEditorOpen] = useState(false);
  const [activeCollage, setActiveCollage] = useState<CollageData | null>(null);
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState<string>(''); 
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    loadFromStorage<GeneratedImage[]>('cine_images').then(saved => {
        if (saved) setImages(saved);
    });
  }, []);

  useEffect(() => {
    saveToStorage('cine_images', images);
  }, [images]);

  const updateImagesWithHistory = useCallback((newImages: GeneratedImage[]) => {
    setHistory(prev => [...prev, images].slice(-30)); 
    setImages(newImages);
  }, [images]);

  const handleDeleteNode = useCallback((id: string) => {
    updateImagesWithHistory(images.filter(i => i.id !== id));
    setSelectedImageId(undefined);
  }, [images, updateImagesWithHistory]);

  const handleUpdateNodePosition = useCallback((id: string, x: number, y: number) => {
    setImages(prev => prev.map(img => img.id === id ? { ...img, position: { x, y } } : img));
  }, []);

  const handleAddAsset = (files: FileList, category: AssetCategory) => {
    Array.from(files).forEach((file) => {
      const url = URL.createObjectURL(file);
      const categoryCount = assets.filter(a => a.category === category).length;
      const newAsset: Asset = {
        id: crypto.randomUUID(),
        file,
        previewUrl: url,
        type: 'image',
        category,
        index: (category === 'role' || category === 'prop') ? categoryCount + 1 : undefined
      };
      setAssets((prev) => [...prev, newAsset]);
    });
  };

  const handleRemoveAsset = (id: string) => {
    setAssets((prev) => {
        const filtered = prev.filter((a) => a.id !== id);
        let roleIdx = 1; let propIdx = 1;
        return filtered.map(a => {
            if (a.category === 'role') return { ...a, index: roleIdx++ };
            if (a.category === 'prop') return { ...a, index: propIdx++ };
            return a;
        });
    });
  };

  const handleGenerate = async () => {
    setError(null);
    setIsGenerating(true);
    abortControllerRef.current = new AbortController();

    try {
      const parentNode = images.find(i => i.id === selectedImageId && i.nodeType === 'render');
      let startX = 100, startY = 100, previousContextImage = undefined;
      
      if (parentNode) {
          startX = (parentNode.position?.x || 0); 
          startY = (parentNode.position?.y || 0) + 480; 
          previousContextImage = parentNode.fullGridUrl || parentNode.url;
      } else {
          const rootNodes = images.filter(i => !i.parentId);
          startX = rootNodes.length === 0 ? 100 : (rootNodes[rootNodes.length-1].position?.x || 100) + 420;
      }

      setGenerationStep("正在渲染分镜...");
      const referenceData: ReferenceImageData[] = [];
      for (const asset of assets) {
          referenceData.push({
             data: await fileToBase64(asset.file),
             mimeType: asset.file.type,
             category: asset.category,
             roleIndex: asset.index
          });
      }

      const finalResult = await generateMultiViewGrid(
          prompt, gridRows, gridCols, aspectRatio, imageSize, panelAspectRatio,
          referenceData, previousContextImage, panelPrompts, activeCollage || undefined
      );
      
      setGenerationStep("正在分析动线...");
      const cameraMove = await generateCameraMovement(prompt);

      const finalNode: GeneratedImage = {
          id: crypto.randomUUID(),
          url: finalResult.fullImage,
          fullGridUrl: finalResult.fullImage,
          prompt,
          textData: prompt, 
          assetIds: assets.map(a => a.id), 
          aspectRatio: typeof aspectRatio === 'string' ? aspectRatio : String(aspectRatio),
          panelAspectRatio: panelAspectRatio,
          timestamp: Date.now(),
          nodeType: 'render',
          parentId: parentNode?.id, 
          position: { x: startX, y: startY },
          cameraDescription: cameraMove,
          slices: finalResult.slices,
          sliceHistory: {}, 
          gridRows,
          gridCols
      };

      updateImagesWithHistory([...images, finalNode]);
      setSelectedImageId(finalNode.id);
    } catch (err: any) {
      setError(err.message || "生成失败");
    } finally {
      setIsGenerating(false);
      setGenerationStep("");
    }
  };

  const handleEditSlice = async (imageId: string, sliceIndex: number, editPrompt: string, usePro: boolean, refImage?: string, targetImageSize: ImageSize = ImageSize.K1) => {
    setIsGenerating(true);
    setGenerationStep("正在重绘...");
    try {
      const image = images.find(img => img.id === imageId);
      if (!image || !image.slices) return;
      const model = usePro ? 'gemini-3-pro-image-preview' : 'gemini-2.5-flash-image';
      const newSliceUrl = await editImage(image.slices[sliceIndex], editPrompt, model, image.panelAspectRatio || image.aspectRatio, refImage, targetImageSize);
      const newImages = images.map(img => {
        if (img.id === imageId) {
          const newSlices = [...(img.slices || [])];
          const newHistory = { ...(img.sliceHistory || {}) };
          if (!newHistory[sliceIndex]) newHistory[sliceIndex] = [];
          newHistory[sliceIndex].push(image.slices![sliceIndex]);
          newSlices[sliceIndex] = newSliceUrl;
          return { ...img, slices: newSlices, sliceHistory: newHistory };
        }
        return img;
      });
      updateImagesWithHistory(newImages);
    } catch (err: any) { setError(err.message || "失败"); } finally { setIsGenerating(false); }
  };

  const handleRevertSlice = (imageId: string, sliceIndex: number, historyIndex: number) => {
    const newImages = images.map(img => {
      if (img.id === imageId) {
        const history = img.sliceHistory?.[sliceIndex] || [];
        const newSlices = [...(img.slices || [])];
        const newHistoryList = [...history];
        const current = newSlices[sliceIndex];
        newSlices[sliceIndex] = history[historyIndex];
        newHistoryList[historyIndex] = current; 
        const updatedHistory = { ...(img.sliceHistory || {}) };
        updatedHistory[sliceIndex] = newHistoryList;
        return { ...img, slices: newSlices, sliceHistory: updatedHistory };
      }
      return img;
    });
    updateImagesWithHistory(newImages);
  };

  const handleApplyScripts = (summary: string, scripts: string[]) => {
      setPrompt(summary);
      setPanelPrompts(scripts);
      const count = scripts.length;
      if (count > gridRows * gridCols) {
          const nextSide = Math.ceil(Math.sqrt(count));
          setGridRows(nextSide);
          setGridCols(nextSide);
      }
  };

  const handleDownloadZip = async () => {
    const selected = images.find(i => i.id === selectedImageId);
    if (!selected || selected.nodeType !== 'render') {
      alert("请先选择一个分镜组。");
      return;
    }
    setIsGenerating(true);
    try {
      const zip = new JSZip();
      const folderName = `ShotGroup_${selected.id.slice(0, 8)}`;
      const folder = zip.folder(folderName);
      const base64ToBlob = (b64: string) => {
        const byteCharacters = atob(b64.split(',')[1]);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) byteNumbers[i] = byteCharacters.charCodeAt(i);
        return new Blob([new Uint8Array(byteNumbers)], { type: 'image/png' });
      };
      folder.file(`FullGrid.png`, base64ToBlob(selected.fullGridUrl || selected.url));
      selected.slices?.forEach((s, i) => folder.file(`Panel_${i + 1}.png`, base64ToBlob(s)));
      const content = await zip.generateAsync({ type: "blob" });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(content);
      link.download = `${folderName}.zip`;
      link.click();
    } catch (err) { alert("打包失败"); } finally { setIsGenerating(false); }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-cine-black text-zinc-400 font-sans">
      <aside className="w-[340px] flex flex-col border-r border-cine-border bg-cine-dark z-20 shadow-2xl">
        <div className="p-5 border-b border-cine-border bg-cine-black/50 flex justify-between items-center">
            <h1 className="text-white text-xs font-bold tracking-[0.15em] uppercase font-mono flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 bg-cine-accent rounded-[1px]"></span>
                橙意机构 - 连续分镜
            </h1>
            <button onClick={() => { if(confirm("重置工作区？")) { setImages([]); setHistory([]); setPanelPrompts([]); setActiveCollage(null); clearStorage(); } }} className="text-zinc-700 hover:text-red-500 transition-colors">
              <Trash2 size={14} />
            </button>
        </div>

        <div className="flex-1 flex flex-col p-4 gap-7 overflow-y-auto custom-scrollbar">
            <AssetBay 
                assets={assets} onAddAsset={handleAddAsset} onRemoveAsset={handleRemoveAsset} 
                onSelectAsset={(a) => { setSelectedAssetId(a.id); setSelectedImageId(undefined); }}
                selectedAssetId={selectedAssetId} onOpenCollage={() => setIsCollageEditorOpen(true)}
            />

            <DirectorDeck 
                gridRows={gridRows} setGridRows={setGridRows}
                gridCols={gridCols} setGridCols={setGridCols}
                aspectRatio={aspectRatio} setAspectRatio={setAspectRatio}
                panelAspectRatio={panelAspectRatio} setPanelAspectRatio={setPanelAspectRatio}
                imageSize={imageSize} setImageSize={setImageSize}
                prompt={prompt} setPrompt={setPrompt}
                onGenerate={handleGenerate}
                onStop={() => setIsGenerating(false)}
                isGenerating={isGenerating}
                onEnhancePrompt={async () => setPrompt(await enhancePrompt(prompt))}
                onGenerateCamera={() => setIsCameraEditorOpen(true)}
                onOpenScriptDeconstruct={() => setIsScriptEditorOpen(true)}
                isContinuing={!!(selectedImageId && images.find(i => i.id === selectedImageId)?.nodeType === 'render')}
                onDeselect={() => { setSelectedImageId(undefined); setSelectedAssetId(undefined); }}
            />
        </div>
      </aside>

      <main className="flex-1 relative bg-cine-black">
        <Canvas
            images={images} onSelect={(i) => { setSelectedImageId(i.id); setSelectedAssetId(undefined); }} 
            selectedId={selectedImageId} onDelete={handleDeleteNode} onUpdateNodePosition={handleUpdateNodePosition}
            onDownloadAll={handleDownloadZip} assets={assets} onDeselectAll={() => { setSelectedImageId(undefined); setSelectedAssetId(undefined); }}
        />
        
        {isGenerating && (
            <div className="absolute inset-0 bg-cine-black/90 backdrop-blur-xl z-[150] flex flex-col items-center justify-center space-y-8">
                 <div className="w-16 h-16 border-t-2 border-cine-accent rounded-full animate-spin"></div>
                 <div className="text-center space-y-2">
                     <p className="text-white font-mono tracking-[0.3em] text-sm uppercase font-bold">{generationStep}</p>
                 </div>
            </div>
        )}

        {error && (
            <div className="absolute bottom-8 left-8 z-50 bg-red-950/80 backdrop-blur border border-red-500/30 text-red-200 p-4 rounded-md text-xs flex gap-3">
                <AlertCircle size={16} /> <span className="font-mono">{error}</span> <button onClick={() => setError(null)}><XIcon size={14} /></button>
            </div>
        )}

        <CameraEditor 
          isOpen={isCameraEditorOpen} onClose={() => setIsCameraEditorOpen(false)}
          rows={gridRows} cols={gridCols} mainPrompt={prompt}
          initialPrompts={panelPrompts} onSave={(newPrompts) => setPanelPrompts(newPrompts)}
        />

        <CollageEditor 
          isOpen={isCollageEditorOpen} onClose={() => setIsCollageEditorOpen(false)}
          onSave={(url, r, c, ar) => { setActiveCollage({ url, rows: r, cols: c, aspectRatio: ar }); setIsCollageEditorOpen(false); }}
        />

        <ScriptEditor 
          isOpen={isScriptEditorOpen} onClose={() => setIsScriptEditorOpen(false)}
          defaultPanelCount={gridRows * gridCols} onApplyScripts={handleApplyScripts}
        />
      </main>

      <aside className="w-[400px] bg-cine-dark border-l border-cine-border z-20">
         <Inspector 
            selectedImage={images.find(i => i.id === selectedImageId) || null}
            selectedAsset={assets.find(a => a.id === selectedAssetId) || null}
            onClose={() => { setSelectedImageId(undefined); setSelectedAssetId(undefined); }}
            onAnalyze={async (p) => { 
                setIsAnalyzing(true);
                const asset = assets.find(a => a.id === selectedAssetId);
                if (asset) setAnalysisResult(await analyzeAsset(await fileToBase64(asset.file), asset.file.type, p));
                setIsAnalyzing(false);
            }}
            isAnalyzing={isAnalyzing}
            analysisResult={analysisResult}
            onEditSlice={handleEditSlice} onRevertSlice={handleRevertSlice}
         />
      </aside>
    </div>
  );
};

export default App;