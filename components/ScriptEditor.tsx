
import React, { useState, useEffect, useRef } from 'react';
import { X, FileText, Send, Check, Trash2, Plus, Sparkles, Save, BookOpen, Layers, CheckCircle2, Circle, Hash, FileUp, Eraser, Edit3, FolderOpen, History, Archive } from 'lucide-react';
import { Button } from './Button';
import { ScriptItem, SavedPrompt, ScriptGroup } from '../types';
import { generateScriptLines, generateDirectorSummary } from '../services/geminiService';
import { saveToStorage, loadFromStorage } from '../services/persistenceService';

interface ScriptEditorProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyScripts: (summary: string, scripts: string[]) => void;
  defaultPanelCount: number;
  savedGroups: ScriptGroup[];
  onSaveGroup: (group: ScriptGroup) => void;
  onDeleteGroup: (id: string) => void;
  onUpdateGroupName: (id: string, name: string) => void;
}

export const ScriptEditor: React.FC<ScriptEditorProps> = ({ 
  isOpen, 
  onClose, 
  onApplyScripts,
  defaultPanelCount,
  savedGroups,
  onSaveGroup,
  onDeleteGroup,
  onUpdateGroupName
}) => {
  const [instruction, setInstruction] = useState("");
  const [panelCount, setPanelCount] = useState(defaultPanelCount);
  const [attachmentContent, setAttachmentContent] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [scriptItems, setScriptItems] = useState<ScriptItem[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [savedPrompts, setSavedPrompts] = useState<SavedPrompt[]>([]);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [tempGroupName, setTempGroupName] = useState("");
  const [activeTab, setActiveTab] = useState<'create' | 'library'>('create');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      loadFromStorage<SavedPrompt[]>('cine_saved_prompts').then(res => {
        if (res) setSavedPrompts(res);
      });
      setPanelCount(defaultPanelCount);
    }
  }, [isOpen, defaultPanelCount]);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFileName(file.name);
      const reader = new FileReader();
      reader.onload = (ev) => setAttachmentContent(ev.target?.result as string);
      reader.readAsText(file);
    }
  };

  const handleClearAttachment = () => {
      setFileName(null);
      setAttachmentContent(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleGenerate = async () => {
    if (!instruction.trim() && !attachmentContent) return;
    setIsGenerating(true);
    const lines = await generateScriptLines(instruction, panelCount, attachmentContent || undefined);
    setScriptItems(lines.map(l => ({ id: crypto.randomUUID(), content: l, selected: false })));
    setIsGenerating(false);
  };

  const handleSaveToLibrary = async () => {
      const selectedScripts = scriptItems.filter(s => s.selected).map(s => s.content);
      if (selectedScripts.length === 0) return;
      
      setIsSummarizing(true);
      const summary = await generateDirectorSummary(selectedScripts);
      
      const newGroup: ScriptGroup = {
          id: crypto.randomUUID(),
          name: `脚本组 ${savedGroups.length + 1}`,
          summary: summary,
          scripts: selectedScripts,
          timestamp: Date.now()
      };
      
      onSaveGroup(newGroup);
      setIsSummarizing(false);
      alert("脚本组已保存至库。");
  };

  const handleLoadGroup = (group: ScriptGroup) => {
      setInstruction(group.summary);
      setScriptItems(group.scripts.map(content => ({
          id: crypto.randomUUID(),
          content,
          selected: true
      })));
      setPanelCount(group.scripts.length);
      setActiveTab('create');
  };

  const handleApply = async () => {
    const selectedItems = scriptItems.filter(i => i.selected);
    if (selectedItems.length === 0) return;
    
    setIsSummarizing(true);
    try {
        const selectedTexts = selectedItems.map(i => i.content);
        const summary = await generateDirectorSummary(selectedTexts);
        onApplyScripts(summary, selectedTexts);
        onClose();
    } catch (e) {
        console.error(e);
    } finally {
        setIsSummarizing(false);
    }
  };

  const toggleSelection = (id: string) => {
    setScriptItems(prev => prev.map(item => 
      item.id === id ? { ...item, selected: !item.selected } : item
    ));
  };

  const updateScriptContent = (id: string, content: string) => {
    setScriptItems(prev => prev.map(item => 
      item.id === id ? { ...item, content } : item
    ));
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/95 backdrop-blur-xl p-6 animate-in fade-in duration-300">
      <div className="bg-cine-dark border border-zinc-800 w-full max-w-7xl rounded-lg shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-800 bg-zinc-900/40">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-md bg-cine-accent flex items-center justify-center shadow-[0_0_20px_rgba(255,122,0,0.3)]">
              <Sparkles size={22} className="text-black" />
            </div>
            <div>
              <h2 className="text-white font-mono uppercase tracking-[0.25em] text-sm font-bold">
                智能脚本拆解 (AI SCRIPT DECONSTRUCT)
              </h2>
              <p className="text-[10px] text-zinc-300 font-mono mt-0.5 uppercase tracking-widest">
                专业结构：环境信息、镜头语言、视角焦段、动态状态、角色构图元素
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
              <div className="flex bg-zinc-900/80 rounded-sm p-1 border border-zinc-800 mr-4">
                  <button onClick={() => setActiveTab('create')} className={`px-4 py-1.5 rounded-[1px] text-[10px] font-mono font-bold tracking-widest transition-all ${activeTab === 'create' ? 'bg-cine-accent text-black' : 'text-zinc-500 hover:text-zinc-300'}`}>
                      新建拆解
                  </button>
                  <button onClick={() => setActiveTab('library')} className={`px-4 py-1.5 rounded-[1px] text-[10px] font-mono font-bold tracking-widest transition-all flex items-center gap-2 ${activeTab === 'library' ? 'bg-cine-accent text-black' : 'text-zinc-500 hover:text-zinc-300'}`}>
                      <Archive size={12} />
                      脚本库 ({savedGroups.length})
                  </button>
              </div>
              <button onClick={onClose} className="text-zinc-500 hover:text-white transition-all hover:rotate-90">
                <X size={20} />
              </button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {activeTab === 'create' ? (
              <>
                {/* Left: Input Area */}
                <div className="w-[380px] border-r border-zinc-800 p-6 flex flex-col gap-6 bg-zinc-900/30 overflow-y-auto custom-scrollbar">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] uppercase text-zinc-300 font-bold tracking-[0.2em] flex items-center gap-2">
                        <FileText size={12} /> 文档与提示词输入
                      </label>
                    </div>
                    <textarea 
                      value={instruction}
                      onChange={(e) => setInstruction(e.target.value)}
                      placeholder="在此输入故事大纲或场景描述..."
                      className="w-full bg-black/40 border border-zinc-800 rounded-sm p-4 text-[12px] text-zinc-200 font-mono min-h-[160px] focus:border-cine-accent focus:ring-0 resize-none leading-relaxed placeholder:text-zinc-600"
                    />
                    <div className="flex gap-2">
                      <div className="flex-1 relative">
                          <Button variant="primary" size="sm" className="w-full text-[9px] h-9 pr-10" onClick={() => fileInputRef.current?.click()}>
                            <FileUp size={12} className="mr-2" />
                            {fileName ? `${fileName.slice(0, 15)}...` : '上传文档 (.txt)'}
                          </Button>
                          {fileName && <button onClick={handleClearAttachment} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-red-500"><X size={14} /></button>}
                      </div>
                      <input type="file" ref={fileInputRef} className="hidden" accept=".txt" onChange={handleFileUpload} />
                    </div>
                  </div>

                  <div className="space-y-4">
                     <label className="text-[10px] uppercase text-zinc-300 font-bold tracking-[0.2em] flex items-center gap-2">
                      <Hash size={12} /> 拆解脚本条数
                    </label>
                    <div className="flex items-center gap-4 bg-black/40 border border-zinc-800 p-3 rounded-sm">
                      <input 
                          type="number" 
                          min="1" max="64" 
                          value={panelCount} 
                          onChange={(e) => setPanelCount(Math.min(64, Math.max(1, parseInt(e.target.value) || 1)))}
                          className="flex-1 bg-transparent border-none text-cine-accent font-mono font-bold text-sm focus:ring-0 text-center"
                      />
                    </div>
                  </div>

                  <div className="mt-auto pt-4 border-t border-zinc-800">
                    <Button 
                      variant="accent" 
                      className="w-full h-12 gap-3 shadow-lg"
                      onClick={handleGenerate}
                      disabled={isGenerating || (!instruction.trim() && !attachmentContent)}
                    >
                      {isGenerating ? <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" /> : <Send size={16} />}
                      {isGenerating ? '正在执行拆解...' : '执行拆解任务'}
                    </Button>
                  </div>
                </div>

                {/* Right: Preview & Library Controls */}
                <div className="flex-1 bg-black/60 p-8 flex flex-col">
                  <div className="flex items-center justify-between mb-6">
                    <label className="text-[10px] uppercase text-zinc-300 font-bold tracking-[0.2em] flex items-center gap-2">
                      <Layers size={14} /> 生成预览 (PREVIEW)
                    </label>
                    <div className="flex gap-4">
                        <button onClick={handleSaveToLibrary} disabled={scriptItems.filter(s => s.selected).length === 0} className="flex items-center gap-2 text-[10px] text-cine-accent font-mono font-bold hover:brightness-125 disabled:opacity-30">
                            <Save size={14} /> 保存至库
                        </button>
                        <div className="h-4 w-[1px] bg-zinc-800"></div>
                        <button onClick={() => setScriptItems(s => s.map(i => ({...i, selected: true})))} className="text-[9px] text-zinc-400 font-mono uppercase tracking-widest hover:text-white">全选</button>
                        <button onClick={() => setScriptItems(s => s.map(i => ({...i, selected: false})))} className="text-[9px] text-zinc-400 font-mono uppercase tracking-widest hover:text-white">清空</button>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto custom-scrollbar pr-4">
                     <div className="grid grid-cols-1 gap-4">
                       {scriptItems.map((item, idx) => (
                         <div key={item.id} className={`flex gap-4 items-start p-4 bg-zinc-900/40 border rounded-sm transition-all duration-300 ${item.selected ? 'border-cine-accent/50 bg-cine-accent/5 shadow-[0_0_15px_rgba(255,122,0,0.05)]' : 'border-zinc-800'}`}>
                            <div className={`w-8 h-8 rounded-full border flex items-center justify-center text-[11px] font-bold font-mono transition-colors ${item.selected ? 'bg-cine-accent border-cine-accent text-black' : 'bg-zinc-800 border-zinc-700 text-zinc-400'}`}>
                              {idx + 1}
                            </div>
                            <textarea value={item.content} onChange={(e) => updateScriptContent(item.id, e.target.value)} className="flex-1 bg-transparent border-none p-0 text-[13px] text-zinc-200 font-mono focus:ring-0 resize-none min-h-[50px] leading-relaxed" />
                            <button onClick={() => toggleSelection(item.id)} className={`px-4 h-9 rounded-sm transition-all border flex items-center gap-2 text-[10px] font-mono tracking-widest font-bold ${item.selected ? 'bg-cine-accent text-black border-cine-accent' : 'bg-black/40 text-zinc-500 border-zinc-800'}`}>
                                {item.selected ? <CheckCircle2 size={14} /> : <Circle size={14} />}
                                {item.selected ? '已选用' : '选用'}
                            </button>
                         </div>
                       ))}
                       {scriptItems.length === 0 && (
                         <div className="h-full flex flex-col items-center justify-center text-zinc-800 py-32 gap-4">
                            <History size={48} className="opacity-20" />
                            <p className="font-mono text-[11px] uppercase tracking-[0.3em]">等待输入指令并执行拆解...</p>
                         </div>
                       )}
                     </div>
                  </div>

                  <div className="mt-8 flex justify-end gap-6 border-t border-zinc-800 pt-6">
                     <div className="flex gap-4">
                         <Button variant="accent" className="px-12 h-12 shadow-xl min-w-[200px]" onClick={handleApply} disabled={isSummarizing || scriptItems.filter(i => i.selected).length === 0}>
                           {isSummarizing ? <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin mr-3" /> : <Check size={18} className="mr-3" />}
                           {isSummarizing ? '同步中...' : '同步至镜头控制台'}
                         </Button>
                     </div>
                  </div>
                </div>
              </>
          ) : (
              <div className="flex-1 bg-black/40 p-10 overflow-y-auto custom-scrollbar">
                  <div className="max-w-4xl mx-auto space-y-6">
                      <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
                          <h3 className="text-white font-mono text-sm font-bold uppercase tracking-widest flex items-center gap-3">
                              <FolderOpen size={18} className="text-cine-accent" />
                              脚本资产库 (SCRIPT LIBRARY)
                          </h3>
                          <span className="text-[10px] text-zinc-500 font-mono">共 {savedGroups.length} 个历史组</span>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {savedGroups.map(group => (
                              <div key={group.id} className="bg-zinc-900/60 border border-zinc-800 rounded-sm p-5 hover:border-cine-accent/50 transition-all group/card">
                                  <div className="flex justify-between items-start mb-4">
                                      {editingGroupId === group.id ? (
                                          <div className="flex items-center gap-2 flex-1">
                                              <input value={tempGroupName} onChange={e => setTempGroupName(e.target.value)} className="bg-black border border-cine-accent text-white px-2 py-1 text-xs font-mono w-full" autoFocus onBlur={() => { onUpdateGroupName(group.id, tempGroupName); setEditingGroupId(null); }} />
                                              <button className="text-cine-accent"><Check size={14} /></button>
                                          </div>
                                      ) : (
                                          <div className="flex items-center gap-2">
                                              <span className="text-cine-accent font-mono text-xs font-bold">{group.name}</span>
                                              <button onClick={() => { setEditingGroupId(group.id); setTempGroupName(group.name); }} className="opacity-0 group-hover/card:opacity-100 text-zinc-500 hover:text-white transition-opacity"><Edit3 size={12} /></button>
                                          </div>
                                      )}
                                      <button onClick={() => onDeleteGroup(group.id)} className="text-zinc-700 hover:text-red-500 transition-colors"><Trash2 size={14} /></button>
                                  </div>
                                  <p className="text-[11px] text-zinc-400 font-mono line-clamp-2 mb-4 leading-relaxed">"{group.summary}"</p>
                                  <div className="flex items-center justify-between mt-auto">
                                      <span className="text-[9px] text-zinc-600 font-mono">{new Date(group.timestamp).toLocaleDateString()} · {group.scripts.length} 帧</span>
                                      <Button variant="primary" size="sm" className="h-8 gap-2" onClick={() => handleLoadGroup(group)}>
                                          <Plus size={12} /> 加载至画布
                                      </Button>
                                  </div>
                              </div>
                          ))}
                          {savedGroups.length === 0 && (
                              <div className="col-span-2 py-20 text-center border border-dashed border-zinc-800 rounded-sm">
                                  <p className="text-zinc-600 font-mono text-xs uppercase tracking-widest">暂无保存的脚本组</p>
                              </div>
                          )}
                      </div>
                  </div>
              </div>
          )}
        </div>
      </div>
    </div>
  );
};
