import styles from "./editArea.module.scss";
import TextEditor from "../TextEditor/TextEditor";
import ResourceDisplay, {ResourceType} from "../ResourceDisplay/ResourceDisplay";
import GraphicalEditor from "../GraphicalEditor/GraphicalEditor";
import EditorToolbar from "@/pages/editor/MainArea/EditorToolbar";
import EditorDebugger from "@/pages/editor/MainArea/EditorDebugger/EditorDebugger";
import FlowchartEditor from "../FlowchartEditor/FlowchartEditor";
import SplitPane from "@/components/SplitPane/SplitPane";
import { useGameEditorContext } from "@/store/useGameEditorStore";
import { ITag } from "@/types/gameEditor";
import { t } from "@lingui/macro";
import useEditorStore from "@/store/useEditorStore";
import { useMemo, useState } from "react";

const DEBUGGER_HEIGHT_KEY = 'editor-debugger-height';
const DEFAULT_DEBUGGER_HEIGHT = 220;

export default function EditArea() {
  const gameDir = useEditorStore.use.subPage();
  const currentTag = useGameEditorContext((state) => state.currentTag);
  const tags = useGameEditorContext((state) => state.tags);
  const isCodeMode = useGameEditorContext((state) => state.isCodeMode);
  const isShowDebugger = useGameEditorContext((state) => state.isShowDebugger);

  // 调试器高度（记忆值）：初始从 localStorage 读取，展开时使用
  const [debuggerHeight, setDebuggerHeight] = useState(() => {
    const saved = localStorage.getItem(DEBUGGER_HEIGHT_KEY);
    return saved ? parseInt(saved, 10) || DEFAULT_DEBUGGER_HEIGHT : DEFAULT_DEBUGGER_HEIGHT;
  });

  const basePath = useMemo(() => ['games', gameDir, 'game'], [gameDir]);

  // 生成每个 Tag 对应的编辑器主体
  const tag = tags.find(tag => tag.path === currentTag?.path);
  const isScene = tag?.type === "scene";

  const getTagPage = (tag: ITag) => {
    const targetPath = [
      ...basePath,
      tag.path.startsWith(basePath.join('/'))
        ? tag.path.slice(basePath.join('/').length + 1) // 兼容旧版本路径
        : tag.path,
    ].join('/');

    if (tag.type === "scene") {
      if (isCodeMode)
        return <TextEditor isHide={tag.path !== currentTag?.path} key={tag.path}
          targetPath={targetPath}/>;
      else return <GraphicalEditor key={tag.path} targetPath={targetPath} targetName={tag.name}/>;
    } else if (tag.type === "flowchart") {
      return <FlowchartEditor key={tag.path} />;
    } else {
      const fileType = getFileType(tag.name);
      if (!fileType) {
        return <div>{t`该文件类型不支持预览`}</div>;
      }
      return <ResourceDisplay
        isHidden={tag.path !== currentTag?.path}
        resourceType={fileType}
        resourceUrl={targetPath}
      />;
    }
  };

  const tagPage = tag ? getTagPage(tag) : "";

  const mainEditor = (
    <div className={styles.editArea_main}>
      {tag?.path === "" && <div className={styles.none_text}>{t`目前没有打开任何文件`}</div>}
      {tag?.path !== "" && tagPage}
    </div>
  );

  // 参考 VSCode 底部面板：SplitPane 始终存在，调试器通过受控 value 折叠（0）/展开（记忆高度）
  // 仅场景文件可显示调试器；非场景或无调试器开关时折叠
  const canShowDebugger = isScene && isShowDebugger;

  const handleDebuggerResize = (height: number) => {
    setDebuggerHeight(height);
    localStorage.setItem(DEBUGGER_HEIGHT_KEY, height.toString());
  };

  return <>
    <SplitPane
      direction="vertical"
      fixedPanel="second"
      value={canShowDebugger ? debuggerHeight : 0}
      onChange={handleDebuggerResize}
      minSize={96}
      disablePointerOn="#gamePreviewIframe"
    >
      {mainEditor}
      {canShowDebugger ? <EditorDebugger/> : <div/>}
    </SplitPane>
    {isScene && <EditorToolbar/>}
  </>;
}

const imageTypes = ["png", "jpg", "jpeg", "gif", "webp"];
const videoTypes = ["mp4", "webm", "ogg"];
const audioTypes = ["mp3", "wav", "aac", "opus"];
const animationTypes = ["json"];

function getFileType(path: string): ResourceType | null {
  const parts = path.split(/[/\\]/);
  const fileName = parts[parts.length - 1];
  const extension = fileName.split(".")[1]?.toLowerCase();

  if (imageTypes.includes(extension)) {
    return ResourceType.Image;
  } else if (videoTypes.includes(extension)) {
    return ResourceType.Video;
  } else if (audioTypes.includes(extension)) {
    return ResourceType.Audio;
  } else if (animationTypes.includes(extension)) {
    return ResourceType.Animation;
  } else {
    return null;
  }
}