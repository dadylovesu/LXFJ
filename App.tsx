
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AssetBay } from './components/AssetBay';
import { DirectorDeck } from './components/DirectorDeck';
import { OmniViewLensLab } from './components/OmniViewLensLab';
import { Canvas } from './components/Canvas';
import { Inspector } from './components/Inspector';
import { CameraEditor } from './components/CameraEditor';
import { CollageEditor } from './components/CollageEditor';
import { ScriptEditor } from './components/ScriptEditor';
import { FeatureGuide } from './components/FeatureGuide'; 
import { ProjectManager } from './components/ProjectManager';
import { Asset, GeneratedImage, AspectRatio, PanelAspectRatio, ImageSize, AssetCategory, CollageData, LensLabParams, ProjectState, ScriptGroup } from './types';
import { generateMultiViewGrid, fileToBase64, enhancePrompt, analyzeAsset, ReferenceImageData, generateCameraMovement, editImage, generateLensLabSequence } from './services/geminiService';
import { saveToStorage, loadFromStorage, clearStorage } from './services/persistenceService';
import { exportProjectBundle, parseProjectFile } from './services/projectService';
import { AlertCircle, X as XIcon, Trash2, LayoutGrid, HelpCircle, CheckCircle2 } from 'lucide-react'; 
import { Button } from './components/Button';
// @ts-ignore
import JSZip from 'jszip';

const App: React.FC = () => {
  // --- Global Projects State ---
  const [projects, setProjects] = useState<ProjectState[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string>('');

  // --- Current Project Derived States ---
  const [assets, setAssets] = useState<Asset[]>([]);
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [history, setHistory] = useState<GeneratedImage[][]>([]);
  const [gridSize, setGridSize] = useState(2);
  const [panelAspectRatio, setPanelAspectRatio] = useState<PanelAspectRatio>(PanelAspectRatio.P16_9);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(AspectRatio.WIDE);
  const [imageSize, setImageSize] = useState<ImageSize>(ImageSize.K4);
  const [prompt, setPrompt] = useState<string>('');
  const [stylePrompt, setStylePrompt] = useState<string>(''); 
  const [styleRefImage, setStyleRefImage] = useState<string | null>(null);
  const [panelPrompts, setPanelPrompts] = useState<string[]>([]);
  const [activeCollage, setActiveCollage] = useState<CollageData | null>(null);
  const [scriptGroups, setScriptGroups] = useState<ScriptGroup[]>([]);

  // --- UI UI UI ---
  const [selectedImageId, setSelectedImageId] = useState<string | undefined>(undefined);
  const [selectedAssetId, setSelectedAssetId] = useState<string | undefined>(undefined);
  const [isCameraEditorOpen, setIsCameraEditorOpen] = useState(false);
  const [isCollageEditorOpen, setIsCollageEditorOpen] = useState(false);
  const [isScriptEditorOpen, setIsScriptEditorOpen] = useState(false);
  const [isFeatureGuideOpen, setIsFeatureGuideOpen] = useState(false); 
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState<string>(''); 
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const saveTimeoutRef = useRef<any>(null);
  const isSavingRef = useRef(false);

  // 1. Initialize DB and Load Projects
  useEffect(() => {
    const init = async () => {
        const savedProjects = await loadFromStorage<ProjectState[]>('cine_projects_list');
        const activeId = await loadFromStorage<string>('cine_active_project_id');

        if (savedProjects && savedProjects.length > 0) {
            setProjects(savedProjects);
            const initialId = activeId && savedProjects.find(p => p.id === activeId) ? activeId : savedProjects[0].id;
            setActiveProjectId(initialId);
            loadProjectToState(savedProjects.find(p => p.id === initialId)!);
        } else {
            const defaultProject: ProjectState = createEmptyProject("我的第一个分镜工程");
            setProjects([defaultProject]);
            setActiveProjectId(defaultProject.id);
            loadProjectToState(defaultProject);
        }
    };
    init();
  }, []);

  const createEmptyProject = (name: string): ProjectState => ({
    id: crypto.randomUUID(),
    name,
    images: [],
    assets: [],
    gridSize: 2,
    panelAspectRatio: PanelAspectRatio.P16_9,
    imageSize: ImageSize.K4,
    prompt: '',
    stylePrompt: '',
    styleRefImage: null,
    panelPrompts: [],
    activeCollage: null,
    scriptGroups: []
  });

  const loadProjectToState = (p: ProjectState) => {
    setHistory([]);
    setAssets(p.assets || []);
    setImages(p.images || []);
    setGridSize(p.gridSize || 2);
    setPanelAspectRatio(p.panelAspectRatio || PanelAspectRatio.P16_9);
    setImageSize(p.imageSize || ImageSize.K4);
    setPrompt(p.prompt || '');
    setStylePrompt(p.stylePrompt || '');
    setStyleRefImage(p.styleRefImage || null);
    setPanelPrompts(p.panelPrompts || []);
    setActiveCollage(p.activeCollage || null);
    setScriptGroups(p.scriptGroups || []);
    setSelectedImageId(undefined);
  };

  const captureCurrentStateAsProject = useCallback((): ProjectState | null => {
    const current = projects.find(p => p.id === activeProjectId);
    if (!current) return null;
    return {
        ...current,
        assets,
        images,
        gridSize,
        panelAspectRatio,
        imageSize,
        prompt,
        stylePrompt,
        styleRefImage,
        panelPrompts,
        activeCollage,
        scriptGroups
    };
  }, [projects, activeProjectId, assets, images, gridSize, panelAspectRatio, imageSize, prompt, stylePrompt, styleRefImage, panelPrompts, activeCollage, scriptGroups]);

  // 2. Optimized Debounced Save Loop
  useEffect(() => {
    if (!activeProjectId) return;

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

    saveTimeoutRef.current = setTimeout(async () => {
        if (isSavingRef.current) return;
        isSavingRef.current = true;
        
        try {
            const updatedState = captureCurrentStateAsProject();
            if (updatedState) {
                const updatedList = projects.map(p => p.id === activeProjectId ? updatedState : p);
                await saveToStorage('cine_projects_list', updatedList);
                await saveToStorage('cine_active_project_id', activeProjectId);
                setProjects(updatedList);
            }
        } catch (err) {
            console.error("Autosave failed:", err);
        } finally {
            isSavingRef.current = false;
        }
    }, 3000);

    return () => {
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [activeProjectId, assets, images, gridSize, panelAspectRatio, imageSize, prompt, stylePrompt, styleRefImage, panelPrompts, activeCollage, scriptGroups]);

  // --- Project Actions ---
  const handleNewProject = () => {
      const p = createEmptyProject(`未命名工程 ${projects.length + 1}`);
      const newList = [...projects, p];
      setProjects(newList);
      setActiveProjectId(p.id);
      loadProjectToState(p);
  };

  const handleSwitchProject = (id: string) => {
      if (id === activeProjectId) return;
      const p = projects.find(proj => proj.id === id);
      if (p) {
          setActiveProjectId(id);
          loadProjectToState(p);
      }
  };

  const handleRenameProject = (id: string, name: string) => {
      setProjects(prev => prev.map(p => p.id === id ? { ...p, name } : p));
  };

  const handleDeleteProject = (id: string) => {
      if (projects.length <= 1) return;
      const newList = projects.filter(p => p.id !== id);
      setProjects(newList);
      if (activeProjectId === id) {
          setActiveProjectId(newList[0].id);
          loadProjectToState(newList[0]);
      }
  };

  const handleImportProject = async (file: File) => {
    try {
        const imported = await parseProjectFile(file);
        setProjects(prev => [...prev, imported]);
        setActiveProjectId(imported.id);
        loadProjectToState(imported);
        setSuccessMsg("项目脚本导入成功");
    } catch (e: any) {
        setError(e.message);
    }
  };

  const handleExportFull = async () => {
      const current = captureCurrentStateAsProject();
      if (!current) return;
      setIsGenerating(true);
      setGenerationStep("正在优化工程并打包导出素材...");
      
      try {
          const { blob, isFullExport } = await exportProjectBundle(current);
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${current.name}_工程导出_${new Date().getTime()}.zip`;
          a.click();
          
          setProjects(prev => prev.map(p => p.id === activeProjectId ? { ...p, lastExportTimestamp: Date.now() } : p));
          
          if (isFullExport) {
            setSuccessMsg("工程已完整导出（含脚本还原文件）");
          } else {
            setSuccessMsg("素材保护导出成功：由于数据超限，仅导出图片与脚本，不含还原文件。");
          }
      } catch (e: any) {
          setError("打包导出失败: " + e.message);
      } finally {
          setIsGenerating(false);
      }
  };

  const handleSaveProjectScript = async () => {
      const current = captureCurrentStateAsProject();
      if (!current) return;
      try {
          const jsonStr = JSON.stringify(current);
          const blob = new Blob([jsonStr], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${current.name}_脚本_${new Date().getTime()}.json`;
          a.click();
          setSuccessMsg("分镜脚本已导出 (JSON)");
      } catch (e) {
          setError("脚本导出失败：体积过大导致浏览器序列化中断，请使用“导出完整工程”以分卷模式保存素材。");
      }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            handleSaveProjectScript();
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [captureCurrentStateAsProject]);

  useEffect(() => {
    switch (panelAspectRatio) {
      case PanelAspectRatio.P16_9: setAspectRatio(AspectRatio.WIDE); break;
      case PanelAspectRatio.P9_16: setAspectRatio(AspectRatio.MOBILE); break;
      case PanelAspectRatio.P3_4: setAspectRatio(AspectRatio.PORTRAIT); break;
      case PanelAspectRatio.P4_3: setAspectRatio(AspectRatio.STANDARD); break;
      case PanelAspectRatio.P1_1: setAspectRatio(AspectRatio.SQUARE); break;
    }
  }, [panelAspectRatio]);

  const updateImagesWithHistory = useCallback((newImages: GeneratedImage[]) => {
    setHistory(prev => [...prev, images].slice(-5)); 
    setImages(newImages);
  }, [images]);

  useEffect(() => {
    const handleGlobalKeys = (e: KeyboardEvent) => {
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
    window.addEventListener('keydown', handleGlobalKeys);
    return () => window.removeEventListener('keydown', handleGlobalKeys);
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
    Array.from(files).forEach(async (file) => {
      const base64 = `data:${file.type};base64,${await fileToBase64(file)}`;
      const categoryCount = assets.filter(a => a.category === category).length;
      const newAsset: Asset = {
        id: crypto.randomUUID(),
        previewUrl: base64,
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

      setGenerationStep("正在准备多模态资产...");
      const referenceData = assets.map(asset => ({
          data: asset.previewUrl.split(',')[1],
          mimeType: 'image/png',
          category: asset.category as any,
          roleIndex: asset.index
      }));

      setGenerationStep("分镜渲染与动线分析同步执行中...");
      
      const [finalResult, cameraMove] = await Promise.all([
        generateMultiViewGrid(
            prompt, gridSize, panelAspectRatio, aspectRatio, imageSize, 
            referenceData, previousContextImage, activeCollage ? undefined : panelPrompts, activeCollage || undefined,
            stylePrompt, styleRefImage || undefined
        ),
        generateCameraMovement(prompt)
      ]);

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

  const handleLensLabRender = async (anchorImage: string, queue: LensLabParams[]) => {
      setError(null);
      setIsGenerating(true);
      setGenerationStep("Lens Lab: 正在执行3D多角度一致性模拟...");
      
      try {
        const rootNodes = images.filter(i => !i.parentId);
        const startX = rootNodes.length === 0 ? 100 : (rootNodes[rootNodes.length-1].position?.x || 100) + 420;

        const result = await generateLensLabSequence(
            anchorImage.split(',')[1],
            gridSize,
            queue,
            panelAspectRatio,
            aspectRatio,
            imageSize,
            stylePrompt,
            styleRefImage || undefined
        );

        const node: GeneratedImage = {
            id: crypto.randomUUID(),
            url: result.fullImage,
            fullGridUrl: result.fullImage,
            prompt: "Lens Lab Sequence Render",
            textData: "Lens Lab Consistency Render\n\nGenerated Panels:\n" + result.panelPrompts.join('\n'),
            aspectRatio,
            panelAspectRatio,
            timestamp: Date.now(),
            nodeType: 'lens_lab',
            position: { x: startX, y: 100 },
            cameraDescription: "Multi-angle spherical orbit sequence.",
            slices: result.slices,
            panelPrompts: result.panelPrompts,
            gridRows: gridSize,
            gridCols: gridSize
        };

        updateImagesWithHistory([...images, node]);
        setSelectedImageId(node.id);
      } catch (err: any) {
          setError(err.message || "Lens Lab 渲染失败");
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
          stylePrompt,
          styleRefImage || undefined
      );

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
    } catch (err: any) { 
        setError(err.message || "重绘失败"); 
    } finally { 
        setIsGenerating(false); 
        setGenerationStep("");
    }
  };

  const handleSaveCameraLogic = (newPrompts: string[]) => {
      setPanelPrompts(newPrompts);
  };

  const handleApplyScripts = (summary: string, scripts: string[]) => {
      setPrompt(summary);
      setPanelPrompts(scripts);
      const count = scripts.length;
      if (count > gridSize * gridSize) {
          const nextSide = Math.ceil(Math.sqrt(count));
          setGridSize(nextSide);
      }
  };

  const handleDownloadZip = async () => {
    const selected = images.find(i => i.id === selectedImageId);
    if (!selected) return;
    
    setIsGenerating(true);
    setGenerationStep("正在准备镜头素材打包...");
    
    try {
      const zip = new JSZip();
      const renderNodes = images.filter(i => i.nodeType === 'render' || i.nodeType === 'lens_lab');
      const sortedNodes = [...renderNodes].sort((a, b) => a.timestamp - b.timestamp);
      const shotIndex = sortedNodes.findIndex(n => n.id === selected.id) + 1;
      
      const folderName = `镜头_${shotIndex}_${selected.id.slice(0, 4)}`;
      const folder = zip.folder(folderName);
      
      const base64ToBlob = (b64: string) => {
        const parts = b64.split(';base64,');
        const byteCharacters = atob(parts[1]);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) byteNumbers[i] = byteCharacters.charCodeAt(i);
        return new Blob([new Uint8Array(byteNumbers)], { type: 'image/png' });
      };

      if (folder) {
          if (selected.slices) {
            selected.slices.forEach((s, i) => {
              folder.file(`渲染图_Shot${shotIndex}_Panel${i+1}.png`, base64ToBlob(s));
            });
          }
          folder.file(`全景宫格_Shot${shotIndex}.png`, base64ToBlob(selected.fullGridUrl || selected.url));
      }
      
      const content = await zip.generateAsync({ type: "blob" });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(content);
      link.download = `${folderName}_素材包.zip`;
      link.click();
      setSuccessMsg("镜头素材包已导出");
    } catch (err) {
      alert("ZIP 打包失败");
    } finally {
      setIsGenerating(false);
      setGenerationStep("");
    }
  };

  const selectedImage = images.find(i => i.id === selectedImageId) || null;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-cine-black text-zinc-400 font-sans">
      <aside className="w-[340px] flex flex-col border-r border-cine-border bg-cine-dark z-20 shadow-2xl">
        <ProjectManager 
            projects={projects}
            activeProjectId={activeProjectId}
            onSwitchProject={handleSwitchProject}
            onNewProject={handleNewProject}
            onImportProject={handleImportProject}
            onExportFull={handleExportFull}
            onSaveIncremental={handleSaveProjectScript}
            onRenameProject={handleRenameProject}
            onDeleteProject={handleDeleteProject}
        />

        <div className="p-4 border-b border-cine-border bg-cine-black/50 flex justify-between items-center">
            <h1 className="text-white text-[10px] font-bold tracking-[0.15em] uppercase font-mono flex items-center gap-2.5">
                <span className="w-2 h-2 bg-cine-accent rounded-[1px]"></span>
                创作中心 (WORKSPACE)
            </h1>
            <button 
                onClick={() => setIsFeatureGuideOpen(true)}
                className="p-1 text-zinc-500 hover:text-cine-accent"
            >
                <HelpCircle size={16} />
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

            <div className="px-1 space-y-6">
                <OmniViewLensLab 
                  gridSize={gridSize}
                  imageSize={imageSize}
                  panelAspectRatio={panelAspectRatio}
                  containerAspectRatio={aspectRatio}
                  onRenderSequence={handleLensLabRender}
                  isGenerating={isGenerating}
                />

                <DirectorDeck 
                    gridSize={gridSize} setGridSize={setGridSize}
                    aspectRatio={aspectRatio} 
                    panelAspectRatio={panelAspectRatio} setPanelAspectRatio={setPanelAspectRatio}
                    imageSize={imageSize} setImageSize={setImageSize}
                    prompt={prompt} setPrompt={setPrompt}
                    stylePrompt={stylePrompt} setStylePrompt={setStylePrompt} 
                    styleRefImage={styleRefImage} setStyleRefImage={setStyleRefImage}
                    onGenerate={handleGenerate}
                    onStop={() => setIsGenerating(false)}
                    isGenerating={isGenerating}
                    onEnhancePrompt={async () => setPrompt(await enhancePrompt(prompt))}
                    onGenerateCamera={() => setIsCameraEditorOpen(true)}
                    onOpenScriptDeconstruct={() => setIsScriptEditorOpen(true)}
                    isContinuing={!!selectedImageId}
                    selectedImage={selectedImage}
                    onDeselect={() => { setSelectedImageId(undefined); setSelectedAssetId(undefined); }}
                    isCollageActive={!!activeCollage}
                />
            </div>
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
            <div className="absolute bottom-8 left-8 z-50 bg-red-950/80 backdrop-blur border border-red-500/30 text-red-200 p-4 rounded-md text-xs flex gap-3 animate-in slide-in-from-left-4">
                <AlertCircle size={16} /> <span className="font-mono">{error}</span> <button onClick={() => setError(null)}><XIcon size={14} /></button>
            </div>
        )}

        {successMsg && (
            <div className="absolute bottom-8 left-8 z-50 bg-cine-accent/20 backdrop-blur border border-cine-accent/40 text-cine-accent p-4 rounded-md text-xs flex gap-3 animate-in slide-in-from-left-4">
                <CheckCircle2 size={16} /> <span className="font-mono">{successMsg}</span> <button onClick={() => setSuccessMsg(null)}><XIcon size={14} /></button>
            </div>
        )}

        <CameraEditor 
          isOpen={isCameraEditorOpen} onClose={() => setIsCameraEditorOpen(false)}
          rows={gridSize} cols={gridSize}
          mainPrompt={prompt} initialPrompts={panelPrompts} onSave={handleSaveCameraLogic}
          selectedImage={selectedImage || undefined}
          onRegenSlice={(idx, p) => handleEditSlice(selectedImageId!, idx, p, true)}
          isGenerating={isGenerating}
        />

        <CollageEditor 
          isOpen={isCollageEditorOpen} onClose={() => setIsCollageEditorOpen(false)}
          onSave={(url, r, c, ar) => { setActiveCollage({ url, rows: r, cols: c, aspectRatio: ar }); setIsCollageEditorOpen(false); }}
        />

        <ScriptEditor 
          isOpen={isScriptEditorOpen} onClose={() => setIsScriptEditorOpen(false)}
          defaultPanelCount={gridSize * gridSize} 
          scriptGroups={scriptGroups}
          onUpdateScriptGroups={setScriptGroups}
          onApplyScripts={handleApplyScripts}
        />

        <FeatureGuide isOpen={isFeatureGuideOpen} onClose={() => setIsFeatureGuideOpen(false)} />
      </main>

      <aside className="w-[400px] bg-cine-dark border-l border-cine-border z-20">
         <Inspector 
            selectedImage={selectedImage}
            selectedAsset={assets.find(a => a.id === selectedAssetId) || null}
            onClose={() => { setSelectedImageId(undefined); setSelectedAssetId(undefined); }}
            onEditSlice={handleEditSlice} 
            onRevertSlice={(imgId, sIdx, hIdx) => {
                const newImages = images.map(img => {
                  if (img.id === imgId) {
                    const historyList = img.sliceHistory?.[sIdx] || [];
                    const newSlices = [...(img.slices || [])];
                    const current = newSlices[sIdx];
                    newSlices[sIdx] = historyList[hIdx];
                    const updatedHistory = { ...(img.sliceHistory || {}) };
                    const newHistoryList = [...historyList];
                    newHistoryList[hIdx] = current;
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
