
import JSZip from 'jszip';
import { ProjectState, GeneratedImage } from '../types';

/**
 * 格式化导出 ZIP 项目文件夹
 * 改进：处理“Invalid string length”异常，实现超大工程的降级导出
 */
export const exportProjectBundle = async (project: ProjectState): Promise<Blob> => {
  const zip = new JSZip();
  const projectFolderName = `${project.name}_${new Date().toISOString().slice(0, 10)}`;
  const root = zip.folder(projectFolderName);
  
  if (!root) throw new Error("Could not create ZIP folder");

  let isFullStateExported = false;

  // 1. 尝试导出项目主脚本文件 (.json)
  try {
    const projectJson = JSON.stringify(project);
    root.file(`${project.name}_工程脚本_可导入.json`, projectJson);
    isFullStateExported = true;
  } catch (err: any) {
    console.warn("Project state too large for single JSON file, switching to assets-only export mode.");
    // 降级：添加一个说明文件告知用户
    const readme = `
橙意机构 - 导出说明
------------------
状态：部分导出（数据超限降级）
原因：由于本项目包含的分镜数量较多或分辨率过高，已超过浏览器单文件导出限制。
结果：本项目未包含“.json”格式的可导入工程文件。
已保全：
1. 所有的分镜渲染图（位于“素材库”文件夹）
2. 所有的历史脚本记录（位于“脚本历史”文件夹）

您可以手动提取素材用于后续创作。
    `;
    root.file("README_导出必读.txt", readme);
  }

  // 2. 素材库文件夹 (Assets) - 无论 JSON 是否成功，这部分都必须导出
  const assetsFolder = root.folder("素材库 (Assets)");
  if (assetsFolder) {
    const renderNodes = project.images.filter(i => i.nodeType === 'render' || i.nodeType === 'lens_lab');
    
    // 按时间顺序排序
    const sortedNodes = [...renderNodes].sort((a, b) => a.timestamp - b.timestamp);

    for (let i = 0; i < sortedNodes.length; i++) {
      const node = sortedNodes[i];
      const shotName = `镜头_${i + 1}`;
      const shotFolder = assetsFolder.folder(shotName);
      
      if (shotFolder) {
        // 导出分段图
        if (node.slices) {
          for (let j = 0; j < node.slices.length; j++) {
            const sliceUrl = node.slices[j];
            if (sliceUrl && sliceUrl.includes('base64,')) {
              const imgData = sliceUrl.split(',')[1];
              shotFolder.file(`渲染图_Shot${i+1}_Panel${j+1}.png`, imgData, { base64: true });
            }
          }
        }
        
        // 导出全景宫格图
        const fullGridUrl = node.fullGridUrl || node.url;
        if (fullGridUrl && fullGridUrl.includes('base64,')) {
          const fullImgData = fullGridUrl.split(',')[1];
          shotFolder.file(`全景宫格_Shot${i+1}.png`, fullImgData, { base64: true });
        }

        // 同时在每个镜头文件夹下保存该镜头的脚本作为备份
        if (node.textData) {
          shotFolder.file(`镜头脚本_${i+1}.txt`, node.textData);
        }
      }
    }

    // 保存原始参考资产
    const refFolder = assetsFolder.folder("原始参考图 (References)");
    if (refFolder) {
      project.assets.forEach((asset, idx) => {
        if (asset.previewUrl && asset.previewUrl.includes('base64,')) {
            const imgData = asset.previewUrl.split(',')[1];
            refFolder.file(`${asset.category}_${asset.index || idx}.png`, imgData, { base64: true });
        }
      });
    }
  }

  // 3. 脚本历史文件夹 (Script History)
  if (project.scriptGroups && project.scriptGroups.length > 0) {
    const historyFolder = root.folder("脚本历史 (Script History)");
    if (historyFolder) {
      project.scriptGroups.forEach((group, idx) => {
        const safeName = group.name.replace(/[\\/:*?"<>|]/g, '_');
        const content = `橙意机构 - 分镜脚本专家导出\n项目名称: ${project.name}\n记录名称: ${group.name}\n生成时间: ${new Date(group.timestamp).toLocaleString()}\n\n梗概/指令:\n${group.summary}\n\n---\n\n` + 
                        group.scripts.map((s, i) => `[分镜 ${i + 1}]\n${s}`).join('\n\n');
        
        historyFolder.file(`${idx + 1}_${safeName}.txt`, content);
      });
    }
  }

  // 使用生成 Blob 方式，JSZip 处理大量文件时比单个大字符串更稳定
  return await zip.generateAsync({ 
    type: "blob",
    compression: "STORE", // 对于已经压缩过的PNG，STORE 模式更快且不容易溢出内存
    streamFiles: true
  });
};

/**
 * 解析项目 JSON
 */
export const parseProjectFile = async (file: File): Promise<ProjectState> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        resolve(json as ProjectState);
      } catch (err) {
        reject(new Error("无效的项目脚本文件或文件过大导致解析失败"));
      }
    };
    reader.onerror = reject;
    reader.readAsText(file);
  });
};
