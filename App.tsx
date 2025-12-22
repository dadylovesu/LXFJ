
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AssetBay } from './components/AssetBay';
import { DirectorDeck } from './components/DirectorDeck';
import { Canvas } from './components/Canvas';
import { Inspector } from './components/Inspector';
import { CameraEditor } from './components/CameraEditor';
import { CollageEditor } from './components/CollageEditor';
import { Asset, GeneratedImage, AspectRatio, ImageSize, AssetCategory, CollageData } from './types';
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
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(AspectRatio.WIDE);
  const [imageSize, setImageSize] = useState<ImageSize>(ImageSize.K4);
  const [prompt, setPrompt] = useState<string>('');
  const [panelPrompts, setPanelPrompts] = useState<string[]>([]);
  const [isCameraEditorOpen, setIsCameraEditorOpen] = useState(false);
  const [isCollageEditorOpen, setIsCollageEditorOpen] = useState(false);
  const [activeCollage, setActiveCollage] = useState<CollageData | null>(null);
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState<string>(''); 
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  // 初始化加载
  useEffect(() => {
    loadFromStorage<GeneratedImage[]>('cine_images').then(saved => {
        if (saved) {
          setImages(saved);
        }
    });
  }, []);

  // 状态变更保存
  useEffect(() => {
    saveToStorage('cine_images', images);
  }, [images]);

  // 更新图片状态并记录历史
  const updateImagesWithHistory = useCallback((newImages: GeneratedImage[]) => {
    setHistory(prev => [...prev, images].slice(-30)); 
    setImages(newImages);
  }, [images]);

  // 快捷键监听
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedImageId) {
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
        handleDeleteNode(selectedImageId);
      }
      
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
        e.preventDefault();
        undo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedImageId, history, images]);

  const undo = useCallback(() => {
    if (history.length > 0) {
      const prev = history[history.length - 1];
      setImages(prev);
      setHistory(prevStack => prevStack.slice(0, -1));
      setSelectedImageId(undefined);
    }
  }, [history]);

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
        let roleIdx = 1;
        let propIdx = 1;
        return filtered.map(a => {
            if (a.category === 'role') {
                return { ...a, index: roleIdx++ };
            }
            if (a.category === 'prop') {
                return { ...a, index: propIdx++ };
            }
            return a;
        });
    });
    if (selectedAssetId === id) setSelectedAssetId(undefined);
  };

  const handleGenerate = async () => {
    setError(null);
    setIsGenerating(true);
    abortControllerRef.current = new AbortController();

    try {
      const timestamp = Date.now();
      const parentNode = images.find(i => i.id === selectedImageId && i.nodeType === 'render');
      
      let startX = 100;
      let startY = 100;
      let previousContextImage = undefined;
      
      if (parentNode) {
          startX = (parentNode.position?.x || 0); 
          startY = (parentNode.position?.y || 0) + 480; 
          previousContextImage = parentNode.fullGridUrl || parentNode.url;
      } else {
          const rootNodes = images.filter(i => !i.parentId);
          startX = rootNodes.length === 0 ? 100 : (rootNodes[rootNodes.length-1].position?.x || 100) + 420;
      }

      setGenerationStep(activeCollage ? "正在复刻拼贴镜头组的构图与景别..." : "正在根据镜头逻辑、核心道具与视觉资产执行渲染...");
      
      const referenceData: ReferenceImageData[] = [];
      for (const asset of assets) {
          referenceData.push({
             data: await fileToBase64(asset.file),
             mimeType: asset.file.type,
             category: asset.category,
             roleIndex: asset.index
          });
      }

      // If collage is active, use its grid settings
      const finalRows = activeCollage ? activeCollage.rows : gridRows;
      const finalCols = activeCollage ? activeCollage.cols : gridCols;
      const finalAspectRatio = activeCollage ? (activeCollage.aspectRatio as AspectRatio) : aspectRatio;

      const finalResult = await generateMultiViewGrid(
          prompt, 
          finalRows, 
          finalCols, 
          finalAspectRatio, 
          imageSize, 
          referenceData,
          previousContextImage,
          activeCollage ? undefined : panelPrompts, // Bypass panel prompts if collage is active
          activeCollage || undefined
      );
      
      setGenerationStep("正在分析最终画面动线...");
      const cameraMove = await generateCameraMovement(prompt);

      const finalNode: GeneratedImage = {
          id: crypto.randomUUID(),
          url: finalResult.fullImage,
          fullGridUrl: finalResult.fullImage,
          prompt: prompt,
          textData: prompt, 
          assetIds: assets.map(a => a.id), 
          aspectRatio: finalAspectRatio,
          timestamp: timestamp + 1,
          nodeType: 'render',
          parentId: parentNode?.id, 
          position: { x: startX, y: startY },
          cameraDescription: cameraMove,
          slices: finalResult.slices,
          sliceHistory: {}, 
          gridRows: finalRows,
          gridCols: finalCols
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
    setGenerationStep("正在应用AI重绘与增强...");
    try {
      const image = images.find(img => img.id === imageId);
      if (!image || !image.slices) return;

      const currentSlice = image.slices[sliceIndex];
      const model = usePro ? 'gemini-3-pro-image-preview' : 'gemini-2.5-flash-image';
      
      const newSliceUrl = await editImage(currentSlice, editPrompt, model, image.aspectRatio, refImage, targetImageSize);

      const newImages = images.map(img => {
        if (img.id === imageId) {
          const newSlices = [...(img.slices || [])];
          const newHistory = { ...(img.sliceHistory || {}) };
          
          if (!newHistory[sliceIndex]) newHistory[sliceIndex] = [];
          newHistory[sliceIndex].push(currentSlice);
          
          newSlices[sliceIndex] = newSliceUrl;
          
          return { ...img, slices: newSlices, sliceHistory: newHistory };
        }
        return img;
      });

      updateImagesWithHistory(newImages);
    } catch (err: any) {
      setError(err.message || "重绘失败");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRevertSlice = (imageId: string, sliceIndex: number, historyIndex: number) => {
    const newImages = images.map(img => {
      if (img.id === imageId) {
        const history = img.sliceHistory?.[sliceIndex] || [];
        const targetUrl = history[historyIndex];
        const newSlices = [...(img.slices || [])];
        const newHistoryList = [...history];
        
        const current = newSlices[sliceIndex];
        newSlices[sliceIndex] = targetUrl;
        newHistoryList[historyIndex] = current; 
        
        const updatedHistory = { ...(img.sliceHistory || {}) };
        updatedHistory[sliceIndex] = newHistoryList;

        return { ...img, slices: newSlices, sliceHistory: updatedHistory };
      }
      return img;
    });
    updateImagesWithHistory(newImages);
  };

  const handleDownloadSelected = async () => {
    const selected = images.find(i => i.id === selectedImageId);
    if (!selected || selected.nodeType !== 'render') {
      alert("请先在画布中选择一个分镜组（RENDER NODE）进行下载。");
      return;
    }

    try {
      setGenerationStep("正在准备 ZIP 下载文件...");
      setIsGenerating(true);

      const renderNodes = images
        .filter(i => i.nodeType === 'render')
        .sort((a, b) => a.timestamp - b.timestamp);
      
      const groupIndex = renderNodes.findIndex(i => i.id === selected.id) + 1;
      const zipName = `组${groupIndex}.zip`;

      const zip = new JSZip();

      const addToZip = async (url: string, filename: string) => {
        const response = await fetch(url);
        const blob = await response.blob();
        zip.file(filename, blob);
      };

      const fullImageUrl = selected.fullGridUrl || selected.url;
      if (fullImageUrl) {
        await addToZip(fullImageUrl, `full_grid_${groupIndex}.png`);
      }

      if (selected.slices) {
        for (let i = 0; i < selected.slices.length; i++) {
          await addToZip(selected.slices[i], `panel_${i + 1}.png`);
        }
      }

      const content = await zip.generateAsync({ type: "blob" });
      const downloadLink = document.createElement('a');
      downloadLink.href = URL.createObjectURL(content);
      downloadLink.download = zipName;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
    } catch (err: any) {
      setError("下载 ZIP 失败: " + err.message);
    } finally {
      setIsGenerating(false);
      setGenerationStep("");
    }
  };

  const handleSaveCollage = (base64Url: string, rows: number, cols: number, ar: string) => {
    setActiveCollage({ url: base64Url, rows, cols, aspectRatio: ar });
    setIsCollageEditorOpen(false);
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
                assets={assets} 
                onAddAsset={handleAddAsset} 
                onRemoveAsset={handleRemoveAsset} 
                onSelectAsset={(a) => { setSelectedAssetId(a.id); setSelectedImageId(undefined); }}
                selectedAssetId={selectedAssetId}
                onOpenCollage={() => setIsCollageEditorOpen(true)}
            />

            <div className="px-2">
                {activeCollage ? (
                  <div className="p-3 bg-cine-accent/10 border border-cine-accent/30 rounded-sm space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                     <div className="flex items-center justify-between">
                        <span className="text-[10px] text-cine-accent font-bold uppercase tracking-widest flex items-center gap-2">
                           <LayoutGrid size={12} />
                           独立参考模式 (STRICT)
                        </span>
                        <button onClick={() => setActiveCollage(null)} className="text-cine-accent hover:text-white transition-colors">
                           <XIcon size={12} />
                        </button>
                     </div>
                     <div className="aspect-video bg-black rounded-sm overflow-hidden border border-cine-accent/20">
                        <img src={activeCollage.url} className="w-full h-full object-contain" />
                     </div>
                     <p className="text-[8px] text-cine-accent/60 font-mono uppercase">将会完全参照此拼贴组复刻镜头</p>
                  </div>
                ) : (
                  <div className="p-3 bg-zinc-900/40 border border-zinc-800/40 border-dashed rounded-sm text-center">
                     <p className="text-[9px] text-zinc-600 font-mono">未激活拼贴模式</p>
                  </div>
                )}
            </div>

            <DirectorDeck 
                gridRows={activeCollage ? activeCollage.rows : gridRows} setGridRows={setGridRows}
                gridCols={activeCollage ? activeCollage.cols : gridCols} setGridCols={setGridCols}
                aspectRatio={activeCollage ? (activeCollage.aspectRatio as AspectRatio) : aspectRatio} setAspectRatio={setAspectRatio}
                imageSize={imageSize} setImageSize={setImageSize}
                prompt={prompt} setPrompt={setPrompt}
                onGenerate={handleGenerate}
                onStop={() => setIsGenerating(false)}
                isGenerating={isGenerating}
                onEnhancePrompt={async () => setPrompt(await enhancePrompt(prompt))}
                onGenerateCamera={activeCollage ? undefined : (() => setIsCameraEditorOpen(true))} // Disabled if collage is active
                isContinuing={!!(selectedImageId && images.find(i => i.id === selectedImageId)?.nodeType === 'render')}
                onDeselect={() => { setSelectedImageId(undefined); setSelectedAssetId(undefined); }}
            />
        </div>
      </aside>

      <main className="flex-1 relative bg-cine-black">
        <Canvas
            images={images} 
            onSelect={(i) => { setSelectedImageId(i.id); setSelectedAssetId(undefined); }} 
            selectedId={selectedImageId}
            onDelete={handleDeleteNode} 
            onUpdateNodePosition={handleUpdateNodePosition}
            onDownloadAll={handleDownloadSelected}
            assets={assets} 
            onDeselectAll={() => { setSelectedImageId(undefined); setSelectedAssetId(undefined); }}
        />
        
        {isGenerating && (
            <div className="absolute inset-0 bg-cine-black/90 backdrop-blur-xl z-50 flex flex-col items-center justify-center space-y-8">
                 <div className="w-16 h-16 border-t-2 border-cine-accent rounded-full animate-spin"></div>
                 <div className="text-center space-y-2">
                     <p className="text-white font-mono tracking-[0.3em] text-sm uppercase font-bold">{generationStep}</p>
                     <p className="text-cine-accent/50 font-mono text-[10px]">AI ENGINE: GEMINI MULTIMODAL</p>
                 </div>
            </div>
        )}

        {error && (
            <div className="absolute bottom-8 left-8 z-50 bg-red-950/80 backdrop-blur border border-red-500/30 text-red-200 p-4 rounded-md text-xs flex gap-3">
                <AlertCircle size={16} className="text-red-400" />
                <span className="font-mono">{error}</span>
                <button onClick={() => setError(null)}><XIcon size={14} /></button>
            </div>
        )}

        {/* Camera Logic Editor */}
        <CameraEditor 
          isOpen={isCameraEditorOpen}
          onClose={() => setIsCameraEditorOpen(false)}
          rows={gridRows}
          cols={gridCols}
          mainPrompt={prompt}
          initialPrompts={panelPrompts}
          onSave={(newPrompts) => setPanelPrompts(newPrompts)}
        />

        {/* Collage Editor */}
        <CollageEditor 
          isOpen={isCollageEditorOpen}
          onClose={() => setIsCollageEditorOpen(false)}
          onSave={handleSaveCollage}
          defaultAspectRatio={aspectRatio}
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
            onEditSlice={handleEditSlice}
            onRevertSlice={handleRevertSlice}
         />
      </aside>
    </div>
  );
};

export default App;
