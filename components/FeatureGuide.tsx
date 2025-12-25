
import React from 'react';
import { 
  X, HelpCircle, Database, LayoutGrid, Settings2, 
  Wand2, Video, Layers, Workflow, Eye, 
  Download, History, UserSquare2, Box, Mountain, 
  Type, Sparkles, MonitorPlay
} from 'lucide-react';
import { Button } from './Button';

interface FeatureGuideProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FeatureGuide: React.FC<FeatureGuideProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const sections = [
    {
      title: "01. 核心资产库 (ASSETS)",
      items: [
        { icon: <UserSquare2 size={16} />, name: "角色 (ROLES)", desc: "定义分镜中的核心主体，AI将严格遵循参考图的形态与比例，防止人物走形。" },
        { icon: <Box size={16} />, name: "道具 (PROPS)", desc: "上传关键物件。AI会识别其工业设计特征，确保在不同分镜中保持一致。" },
        { icon: <Mountain size={16} />, name: "环境 (BACKGROUNDS)", desc: "设定场景基调。AI会参考参考图的光影氛围、建筑风格和地理特征。" },
        { icon: <LayoutGrid size={16} className="text-cine-accent" />, name: "镜头组参考 (COLLAGE)", desc: "核心功能：通过九宫格参考图直接锁定全组分镜的景别（特写/全景）与机位角度。" },
      ]
    },
    {
      title: "02. 导演控制台 (CONTROL)",
      items: [
        { icon: <Settings2 size={16} />, name: "构图规模", desc: "设定 1x1 到 4x4 的宫格阵列，系统会自动计算输出的最佳比例（16:9/9:16等）。" },
        { icon: <Sparkles size={16} />, name: "视觉风格", desc: "自定义画风滤镜。若留空则默认参考资产图风格，若填写则强制应用特定电影美学。" },
        { icon: <Type size={16} />, name: "创作指令", desc: "描述核心事件。支持续写模式：选中画布已有节点后点击渲染，可生成剧情连续的后续画面。" },
      ]
    },
    {
      title: "03. 智能生产工具 (SMART TOOLS)",
      items: [
        { icon: <Wand2 size={16} />, name: "智能脚本拆解", desc: "将故事梗概自动拆解为专业的电影Beat，包含景别、焦段、光影及动作细节。" },
        { icon: <Video size={16} />, name: "分镜镜头逻辑", desc: "针对宫格中每一格进行独立文本精调。支持自动规划逻辑动线，实现运镜感。" },
      ]
    },
    {
      title: "04. 无限画布与监视器 (CANVAS & INSPECTOR)",
      items: [
        { icon: <Workflow size={16} />, name: "节点流 (NODE)", desc: "可视化剧情分支。通过拖拽和连线管理不同版本的创作路径，支持无限缩放。" },
        { icon: <Eye size={16} />, name: "导演监视器", desc: "深度查看细节。包含元数据分析、高清原图下载以及最核心的“单格重绘”入口。" },
        { icon: <MonitorPlay size={16} className="text-cine-accent" />, name: "单格重绘 (REGEN)", desc: "点击宫格中任意一格，可针对性修改细节（如：加个墨镜）而不改变其他分镜。" },
        { icon: <History size={16} />, name: "版本历史", desc: "每一格的每一次重绘都会被记录，支持随时回溯到之前的任何一个渲染版本。" },
      ]
    }
  ];

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/90 backdrop-blur-xl p-6 animate-in fade-in duration-300">
      <div className="bg-cine-dark border border-zinc-800 w-full max-w-5xl rounded-lg shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-800 bg-zinc-900/40">
          <div className="flex items-center gap-4">
            <HelpCircle size={24} className="text-cine-accent" />
            <div>
              <h2 className="text-white font-mono uppercase tracking-[0.25em] text-sm font-bold">
                功能操作指南 (SYSTEM GUIDE)
              </h2>
              <p className="text-[10px] text-zinc-400 font-mono mt-0.5 uppercase tracking-widest">
                专业电影分镜创作 Agent - 全图标与功能逻辑解析
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-all hover:rotate-90">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10">
            {sections.map((section, sIdx) => (
              <div key={sIdx} className="space-y-5">
                <h3 className="text-cine-accent text-[11px] font-bold font-mono tracking-[0.2em] border-l-2 border-cine-accent pl-3">
                  {section.title}
                </h3>
                <div className="space-y-4">
                  {section.items.map((item, iIdx) => (
                    <div key={iIdx} className="flex gap-4 group">
                      <div className="w-10 h-10 rounded-sm bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 group-hover:text-cine-accent group-hover:border-cine-accent/50 transition-all flex-shrink-0">
                        {item.icon}
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-zinc-200 text-[10px] font-bold font-mono uppercase tracking-wider">{item.name}</h4>
                        <p className="text-[11px] text-zinc-500 leading-relaxed font-sans">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-zinc-800 bg-zinc-900/60 flex justify-center">
          <Button variant="accent" onClick={onClose} className="px-12 h-11 text-[11px] font-bold tracking-widest">
            我已了解 (UNDERSTOOD)
          </Button>
        </div>
      </div>
    </div>
  );
};
