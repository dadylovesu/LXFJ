
import JSZip from 'jszip';
import { ProjectState, GeneratedImage } from '../types';

/**
 * 预估工程数据体积（主要计算 Base64 字符串长度）
 */
const estimateProjectDataSize = (project: ProjectState): number => {
  let size = 0;
  // 计算图片体积
  project.images.forEach(img => {
    size += (img.url?.length || 0);
    size += (img.fullGridUrl?.length || 0);
    img.slices?.forEach(s => size += (s?.length || 0));
    if (img.sliceHistory) {
      Object.values(img.sliceHistory).forEach(historyList => {
        historyList.forEach(h => size += (h?.length || 0));
      });
    }
  });
  // 计算参考资产体积
  project.assets.forEach(asset => {
    size += (asset.previewUrl?.length || 0);
  });
  return size;
};

/**
 * 格式化导出 ZIP 项目文件夹
 * 优化：当数据量过大导致 JSON 序列化可能失败时，采取保护性导出模式（不含 JSON 脚本，仅含素材）
 */
export const exportProjectBundle = async (project: ProjectState): Promise<{ blob: Blob, isFullExport: boolean }> => {
  const zip = new JSZip();
  const projectFolderName = `${project.name}_${new Date().toISOString().slice(0, 10)}`;
  const root = zip.folder(projectFolderName);
  
  if (!root) throw new Error("Could not create ZIP folder");

  const dataSize = estimateProjectDataSize(project);
  // 浏览器 JSON.stringify 限制通常在 256MB 左右，保守设定 150MB 字符长度为阈值
  const SIZE_THRESHOLD = 150 * 1024 * 1024; 
  const isFullExport = dataSize < SIZE_THRESHOLD;

  // 1. 项目主脚本文件 (.json) - 仅在体积安全时生成
  if (isFullExport) {
    try {
      const projectJson = JSON.stringify(project, null, 2);
      root.file(`${project.name}_工程状态.json`, projectJson);
    } catch (e) {
      console.warn("JSON stringify failed despite estimate, falling back to resource-only export.");
    }
  }

  // 生成导出报告
  const manifest = [
    `橙意机构 - 分镜创作导出报告`,
    `项目名称: ${project.name}`,
    `导出时间: ${new Date().toLocaleString()}`,
    `导出模式: ${isFullExport ? "【全量导出】(可重新导入还原工程)" : "【素材保护导出】(体积过大，仅导出图文素材)"}`,
    `数据预估体积: ${(dataSize / (1024 * 1024)).toFixed(2)} MB`,
    `--------------------------------------`,
    isFullExport ? "" : "注意：由于工程数据（高清图及其历史版本）超过浏览器处理极限，本次导出未包含 .json 工程状态文件。您可以通过手动备份图片素材来保留成果。"
  ].join('\n');
  root.file(`READ_ME_导出说明.txt`, manifest);

  // 2. 素材库文件夹 (Assets)
  const assetsFolder = root.folder("素材库 (Assets)");
  if (assetsFolder) {
    const renderNodes = project.images.filter(i => i.nodeType === 'render' || i.nodeType === 'lens_lab');
    const sortedNodes = [...renderNodes].sort((a, b) => a.timestamp - b.timestamp);

    for (let i = 0; i < sortedNodes.length; i++) {
      const node = sortedNodes[i];
      const shotName = `镜头_${i + 1}`;
      const shotFolder = assetsFolder.folder(shotName);
      
      if (shotFolder) {
        // 导出切片图
        if (node.slices) {
          for (let j = 0; j < node.slices.length; j++) {
            const sliceUrl = node.slices[j];
            const imgData = sliceUrl.includes(',') ? sliceUrl.split(',')[1] : sliceUrl;
            shotFolder.file(`渲染图_Shot${i+1}_Panel${j+1}.png`, imgData, { base64: true });
          }
        }
        
        // 导出全景图
        const fullImgUrl = node.fullGridUrl || node.url;
        const fullImgData = fullImgUrl.includes(',') ? fullImgUrl.split(',')[1] : fullImgUrl;
        shotFolder.file(`全景宫格_Shot${i+1}.png`, fullImgData, { base64: true });
      }
    }

    // 保存原始参考资产
    const refFolder = assetsFolder.folder("原始参考图 (References)");
    if (refFolder) {
      project.assets.forEach((asset, idx) => {
        const imgData = asset.previewUrl.includes(',') ? asset.previewUrl.split(',')[1] : asset.previewUrl;
        refFolder.file(`${asset.category}_${asset.index || idx}.png`, imgData, { base64: true });
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

  const blob = await zip.generateAsync({ 
    type: "blob",
    compression: "DEFLATE",
    compressionOptions: { level: 6 }
  });
  
  return { blob, isFullExport };
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
        reject(new Error("无效的项目脚本文件"));
      }
    };
    reader.onerror = reject;
    reader.readAsText(file);
  });
};
