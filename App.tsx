
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AssetBay } from './components/AssetBay';
import { DirectorDeck } from './components/DirectorDeck';
import { Canvas } from './components/Canvas';
import { Inspector } from './components/Inspector';
import { CameraEditor } from './components/CameraEditor';
import { CollageEditor } from './components/CollageEditor';
import { ScriptEditor } from './components/ScriptEditor';
import { FeatureGuide } from './components/FeatureGuide'; 
import { Asset, GeneratedImage, AspectRatio, PanelAspectRatio, ImageSize, AssetCategory, CollageData, CameraTransformConfig } from './types';
import { generateMultiViewGrid, fileToBase64, enhancePrompt, analyzeAsset, ReferenceImageData, generateCameraMovement, editImage, generateMultiAngleTransformation } from './services/geminiService';
import { saveToStorage, loadFromStorage, clearStorage } from './services/persistenceService';
import { AlertCircle, X as XIcon, Trash2, LayoutGrid, HelpCircle } from 'lucide-react'; 
import { Button } from './components/Button';
// @ts-ignore
import JSZip from 'jszip';

const App: React.FC = () => {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [history, setHistory] = useState<GeneratedImage[][]>([]);
  
  const [selectedImageId, setSelectedImageId] = useState<string | undefined>(undefined);
  const [selectedAssetId, setSelectedAssetId] = useState<string | undefined>(undefined);
  
  const [gridSize, setGridSize] = useState(2);
  const [panelAspectRatio, setPanelAspectRatio] = useState<PanelAspectRatio>(PanelAspectRatio.P16_9);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(AspectRatio.WIDE);
  const [imageSize, setImageSize] = useState<ImageSize>(ImageSize.K4);
  const [prompt, setPrompt] = useState<string>('');
  const [stylePrompt, setStylePrompt] = useState<string>(''); 
  const [panelPrompts, setPanelPrompts] = useState<string[]>([]);
  const [isCameraEditorOpen, setIsCameraEditorOpen] = useState(false);
  const [isCollageEditorOpen, setIsCollageEditorOpen] = useState(false);
  const [isScriptEditorOpen, setIsScriptEditorOpen] = useState(false);
  const [isFeatureGuideOpen, setIsFeatureGuideOpen] = useState(false); 
  const [activeCollage, setActiveCollage] = useState<CollageData | null>(null);
  
  // Multi-Angle States
  const [isTransformActive, setIsTransformActive] = useState(false);
  const [transformConfigs, setTransformConfigs] = useState<CameraTransformConfig[]>([]);

  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState<string>(''); 
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    switch (panelAspectRatio) {
      case PanelAspectRatio.P16_9: setAspectRatio(AspectRatio.WIDE); break;
      case PanelAspectRatio.P9_16: setAspectRatio(AspectRatio.MOBILE); break;
      case PanelAspectRatio.P3_4: setAspectRatio(AspectRatio.PORTRAIT); break;
      case PanelAspectRatio.P4_3: setAspectRatio(AspectRatio.STANDARD); break;
      case PanelAspectRatio.P1_1: setAspectRatio(AspectRatio.SQUARE); break;
    }
  }, [panelAspectRatio]);

  // Sync transform configs count with gridSize
  useEffect(() => {
    const total = gridSize * gridSize;
    setTransformConfigs(prev => {
      const next = [...prev];
      while (next.length < total) {
        next.push({ focalLength: 35, pitch: 0, yaw: 0 });
      }
      return next.slice(0, total);
    });
  }, [gridSize]);

  useEffect(() => {
    loadFromStorage<GeneratedImage[]>('cine_images').then(saved => {
        if (saved) setImages(saved);
    });
    loadFromStorage<string>('cine_selected_id').then(id => {
        if (id) setSelectedImageId(id);
    });
    loadFromStorage<CollageData>('cine_active_collage').then(collage => {
        if (collage) setActiveCollage(collage);
    });
  }, []);

  useEffect(() => {
    saveToStorage('cine_images', images);
  }, [images]);

  useEffect(() => {
    saveToStorage('cine_selected_id', selectedImageId || null);
  }, [selectedImageId]);

  useEffect(() => {
    saveToStorage('cine_active_collage', activeCollage);
  }, [activeCollage]);

  useEffect(() => {
    if (selectedImageId) {
      const selected = images.find(i => i.id === selectedImageId);
      if (selected && selected.nodeType === 'render') {
        setPrompt(selected.prompt);
        setStylePrompt(selected.stylePrompt || ''); 
        setPanelPrompts(selected.panelPrompts || []);
        if (selected.gridRows) setGridSize(selected.gridRows);
        if (selected.panelAspectRatio) setPanelAspectRatio(selected.panelAspectRatio as any);
      }
    }
  }, [selectedImageId, images]);

  const updateImagesWithHistory = useCallback((newImages: GeneratedImage[]) => {
    setHistory(prev => [...prev, images].slice(-30)); 
    setImages(newImages);
  }, [images]);

  const handleTransformGenerate = async () => {
    const activeItem = images.find(i => i.id === selectedImageId) || assets.find(a => a.id === selectedAssetId);
    if (!activeItem) {
      setError("请先在画布或资产库中选择一张图片作为变换基准。");
      return;
    }

    setError(null);
    setIsGenerating(true);
    setGenerationStep("正在分析镜头位移参数...");

    try {
      let base64Source = '';
      if ('url' in activeItem) {
        base64Source = activeItem.url;
      } else if ('file' in activeItem) {
        base64Source = `data:${activeItem.file.type};base64,${await fileToBase64(activeItem.file)}`;
      }

      setGenerationStep("执行多角度无缝渲染...");
      const result = await generateMultiAngleTransformation(
        base64Source,
        gridSize,
        aspectRatio,
        imageSize,
        transformConfigs
      );

      const parentNode = images.find(i => i.id === selectedImageId);
      const startX = parentNode?.position ? parentNode.position.x : 100;
      const startY = parentNode?.position ? parentNode.position.y + 480 : 100;

      const newNode: GeneratedImage = {
        id: crypto.randomUUID(),
        url: result.fullImage,
        fullGridUrl: result.fullImage,
        prompt: `Transformation of ${activeItem.id}`,
        aspectRatio,
        panelAspectRatio,
        timestamp: Date.now(),
        nodeType: 'render',
        parentId: selectedImageId,
        position: { x: startX, y: startY },
        cameraDescription: "多角度机位变换序列",
        slices: result.slices,
        gridRows: gridSize,
        gridCols: gridSize,
        isTransformation: true
      };

      updateImagesWithHistory([...images, newNode]);
      setSelectedImageId(newNode.id);
    } catch (err: any) {
      setError(err.message || "变换生成失败");
    } finally {
      setIsGenerating(false);
      setGenerationStep("");
    }
  };

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
        let roleIdx = 1; let propIdx = 1;
        return filtered.map(a => {
            if (a.category === 'role') return { ...a, index: roleIdx++ };
            if (a.category === 'prop') return { ...a, index: propIdx++ };
            return a;
        });
    });
    if (selectedAssetId === id) setSelectedAssetId(undefined);
  };

  const handleGenerate = async () => {
    setError(null);
    setIsGenerating(true);
    setGenerationStep("正在启动渲染引擎...");
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

      setGenerationStep("正在渲染分镜组...");
      const referenceData: ReferenceImageData[] = [];
      for (const asset of assets) {
          referenceData.push({
             data: await fileToBase64(asset.file),
             mimeType: asset.file.type,
             category: asset.category,
             roleIndex: asset.index
          });
      }

      const instructionsToSend = activeCollage ? undefined : panelPrompts;

      const finalResult = await generateMultiViewGrid(
          prompt, gridSize, panelAspectRatio, aspectRatio, imageSize, 
          referenceData, previousContextImage, instructionsToSend, activeCollage || undefined,
          stylePrompt 
      );
      
      setGenerationStep("正在分析动线逻辑...");
      const cameraMove = await generateCameraMovement(prompt);

      const finalNode: GeneratedImage = {
          id: crypto.randomUUID(),
          url: finalResult.fullImage,
          fullGridUrl: finalResult.fullImage,
          prompt,
          stylePrompt, 
          textData: prompt, 
          assetIds: assets.map(a => a.id), 
          aspectRatio,
          panelAspectRatio,
          timestamp: Date.now(),
          nodeType: 'render',
          parentId: parentNode?.id, 
          position: { x: startX, y: startY },
          cameraDescription: cameraMove,
          slices: finalResult.slices,
          panelPrompts: [...panelPrompts], 
          sliceHistory: {}, 
          gridRows: gridSize,
          gridCols: gridSize
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
    setGenerationStep("正在执行单格无缝重绘...");
    try {
      const image = images.find(img => img.id === imageId);
      if (!image || !image.slices) return;
      const model = usePro ? 'gemini-3-pro-image-preview' : 'gemini-2.5-flash-image';
      
      const newSliceUrl = await editImage(
          image.slices[sliceIndex], 
          editPrompt, 
          model, 
          image.panelAspectRatio || image.aspectRatio, 
          refImage, 
          targetImageSize,
          stylePrompt 
      );

      const newImages = images.map(img => {
        if (img.id === imageId) {
          const newSlices = [...(img.slices || [])];
          const newHistory = { ...(img.sliceHistory || {}) };
          if (!newHistory[sliceIndex]) newHistory[sliceIndex] = [];
          newHistory[sliceIndex].push(image.slices![sliceIndex]);
          newSlices[sliceIndex] = newSliceUrl;
          
          const newPanelPrompts = [...(img.panelPrompts || [])];
          while(newPanelPrompts.length <= sliceIndex) newPanelPrompts.push("");
          newPanelPrompts[sliceIndex] = editPrompt;
          return { ...img, slices: newSlices, sliceHistory: newHistory, panelPrompts: newPanelPrompts };
        }
        return img;
      });
      updateImagesWithHistory(newImages);
      
      if (imageId === selectedImageId) {
          setPanelPrompts(prev => {
              const next = [...prev];
              while(next.length <= sliceIndex) next.push("");
              next[sliceIndex] = editPrompt;
              return next;
          });
      }
    } catch (err: any) { 
        setError(err.message || "重绘失败"); 
    } finally { 
        setIsGenerating(false); 
        setGenerationStep("");
    }
  };

  const handleSaveCameraLogic = (newPrompts: string[]) => {
      setPanelPrompts(newPrompts);
      if (selectedImageId) {
          setImages(prev => prev.map(img => 
              img.id === selectedImageId ? { ...img, panelPrompts: newPrompts } : img
          ));
      }
  };

  const handleApplyScripts = (summary: string, scripts: string[]) => {
      setPrompt(summary);
      setPanelPrompts(scripts);
      const count = scripts.length;
      if (count > gridSize * gridSize) {
          const nextSide = Math.ceil(Math.sqrt(count));
          setGridSize(nextSide);
      }
      if (selectedImageId) {
          setImages(prev => prev.map(img => 
              img.id === selectedImageId ? { ...img, prompt: summary, panelPrompts: scripts } : img
          ));
      }
  };

  const handleDownloadZip = async () => {
    const selected = images.find(i => i.id === selectedImageId);
    if (!selected || selected.nodeType !== 'render') {
      alert("请先在画布上选择一个分镜组。");
      return;
    }

    setGenerationStep("准备打包 ZIP...");
    setIsGenerating(true);

    try {
      const zip = new JSZip();
      const folderName = `导出分镜_${selected.id.slice(0, 8)}`;
      const folder = zip.folder(folderName);

      const base64ToBlob = (b64: string) => {
        const parts = b64.split(';base64,');
        const byteCharacters = atob(parts[1]);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        return new Blob([byteArray], { type: 'image/png' });
      };

      folder.file(`全景宫格.png`, base64ToBlob(selected.fullGridUrl || selected.url));

      if (selected.slices) {
        selected.slices.forEach((sliceUrl, i) => {
          folder.file(`分镜_${i + 1}.png`, base64ToBlob(sliceUrl));
        });
      }

      const content = await zip.generateAsync({ type: "blob" });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(content);
      link.download = `${folderName}.zip`;
      link.click();
    } catch (err) {
      alert("ZIP 打包失败。");
    } finally {
      setIsGenerating(false);
      setGenerationStep("");
    }
  };

  const selectedImage = images.find(i => i.id === selectedImageId) || null;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-cine-black text-zinc-400 font-sans">
      <aside className="w-[340px] flex flex-col border-r border-cine-border bg-cine-dark z-20 shadow-2xl">
        <div className="p-5 border-b border-cine-border bg-cine-black/50 flex justify-between items-center">
            <h1 className="text-white text-xs font-bold tracking-[0.15em] uppercase font-mono flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 bg-cine-accent rounded-[1px]"></span>
                橙意机构 - 连续分镜
            </h1>
            <button onClick={() => setIsFeatureGuideOpen(true)} className="p-1.5 text-zinc-500 hover:text-cine-accent transition-all hover:bg-zinc-800 rounded-md">
                <HelpCircle size={18} />
            </button>
        </div>

        <div className="flex-1 flex flex-col p-4 gap-7 overflow-y-auto custom-scrollbar">
            <AssetBay 
                assets={assets} onAddAsset={handleAddAsset} onRemoveAsset={handleRemoveAsset} 
                onSelectAsset={(a) => { setSelectedAssetId(a.id); setSelectedImageId(undefined); }}
                selectedAssetId={selectedAssetId} onOpenCollage={() => setIsCollageEditorOpen(true)}
            />

            <div className="px-2">
                {activeCollage ? (
                  <div className="p-3 bg-cine-accent/10 border border-cine-accent/30 rounded-sm space-y-2">
                     <div className="flex items-center justify-between">
                        <span className="text-[10px] text-cine-accent font-bold uppercase tracking-widest flex items-center gap-2">
                           <LayoutGrid size={12} /> 镜头组参考 (ACTIVE)
                        </span>
                        <button onClick={() => setActiveCollage(null)} className="text-cine-accent hover:text-white"><XIcon size={12} /></button>
                     </div>
                     <img src={activeCollage.url} className="w-full aspect-video object-contain bg-black rounded-sm border border-cine-accent/20" />
                  </div>
                ) : (
                  <div className="p-3 bg-zinc-900/40 border border-zinc-800/40 border-dashed rounded-sm text-center">
                     <p className="text-[9px] text-zinc-400 font-mono">未激活镜头组参考</p>
                  </div>
                )}
            </div>

            <DirectorDeck 
                gridSize={gridSize} setGridSize={setGridSize}
                aspectRatio={aspectRatio} 
                panelAspectRatio={panelAspectRatio} setPanelAspectRatio={setPanelAspectRatio}
                imageSize={imageSize} setImageSize={setImageSize}
                prompt={prompt} setPrompt={setPrompt}
                stylePrompt={stylePrompt} setStylePrompt={setStylePrompt} 
                onGenerate={handleGenerate}
                onStop={() => setIsGenerating(false)}
                isGenerating={isGenerating}
                onEnhancePrompt={async () => setPrompt(await enhancePrompt(prompt))}
                onGenerateCamera={() => setIsCameraEditorOpen(true)}
                onOpenScriptDeconstruct={() => setIsScriptEditorOpen(true)}
                isContinuing={!!(selectedImageId && images.find(i => i.id === selectedImageId)?.nodeType === 'render')}
                onDeselect={() => { setSelectedImageId(undefined); setSelectedAssetId(undefined); }}
                isCollageActive={!!activeCollage}
                transformConfigs={transformConfigs}
                setTransformConfigs={setTransformConfigs}
                onTransformGenerate={handleTransformGenerate}
                isTransformActive={isTransformActive}
                setIsTransformActive={setIsTransformActive}
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
          rows={selectedImage?.gridRows || gridSize} 
          cols={selectedImage?.gridCols || gridSize} 
          mainPrompt={selectedImage?.prompt || prompt}
          initialPrompts={panelPrompts} onSave={handleSaveCameraLogic}
          currentImage={selectedImage || undefined}
          onRegenSlice={(idx, p) => handleEditSlice(selectedImageId!, idx, p, true)}
          isGenerating={isGenerating}
        />

        <CollageEditor 
          isOpen={isCollageEditorOpen} onClose={() => setIsCollageEditorOpen(false)}
          onSave={(url, r, c, ar) => { setActiveCollage({ url, rows: r, cols: c, aspectRatio: ar }); setIsCollageEditorOpen(false); }}
        />

        <ScriptEditor 
          isOpen={isScriptEditorOpen} onClose={() => setIsScriptEditorOpen(false)}
          defaultPanelCount={gridSize * gridSize} onApplyScripts={handleApplyScripts}
        />

        <FeatureGuide isOpen={isFeatureGuideOpen} onClose={() => setIsFeatureGuideOpen(false)} />
      </main>

      <aside className="w-[400px] bg-cine-dark border-l border-cine-border z-20">
         <Inspector 
            selectedImage={selectedImage}
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
            onRevertSlice={(imgId, sIdx, hIdx) => {
                const newImages = images.map(img => {
                  if (img.id === imgId) {
                    const history = img.sliceHistory?.[sIdx] || [];
                    const newSlices = [...(img.slices || [])];
                    const newHistoryList = [...history];
                    const current = newSlices[sIdx];
                    newSlices[sIdx] = history[hIdx];
                    newHistoryList[hIdx] = current; 
                    const updatedHistory = { ...(img.sliceHistory || {}) };
                    updatedHistory[sIdx] = newHistoryList;
                    return { ...img, slices: newSlices, sliceHistory: updatedHistory };
                  }
                  return img;
                });
                updateImagesWithHistory(newImages);
            }}
         />
      </aside>
    </div>
  );
};

export default App;
