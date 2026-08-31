import React, { useCallback, useEffect, useRef, useState } from 'react';
import styles from './splitPane.module.scss';

interface SplitPaneProps {
  direction: 'horizontal' | 'vertical';
  defaultSize?: number;
  minSize?: number;
  maxSize?: number;
  persistKey?: string;
  /** 受控模式：由外部控制固定面板尺寸（传入 value 时启用，此时默认忽略 defaultSize/persistKey） */
  value?: number;
  /** 受控模式下拖拽尺寸变化回调 */
  onChange?: (size: number) => void;
  /** 固定尺寸的面板：first（第一个，默认）/ second（第二个） */
  fixedPanel?: 'first' | 'second';
  /** 分隔条拖拽热区尺寸（像素），默认 4 */
  dividerSize?: number;
  /** 分隔条线的颜色，默认使用主题变量 var(--primary) */
  dividerColor?: string;
  /** 拖拽时临时禁用 pointer-events 的元素选择器，用于避免 iframe 吞掉 mousemove */
  disablePointerOn?: string;
  /** 拖拽结束后的回调（用于调试/显示当前尺寸） */
  onResize?: (size: number) => void;
  children: [React.ReactNode, React.ReactNode];
}

const DEFAULT_DIVIDER_SIZE = 4;

/** 分隔条自定义样式变量（粗细 + 颜色），通过 CSS 变量控制 */
type DividerVars = React.CSSProperties & {
  '--splitpane-divider-size': string;
  '--splitpane-divider-color'?: string;
};

/**
 * 轻量分割面板：拖拽分隔条调整两个面板大小
 * - 支持横向(horizontal)/纵向(vertical)
 * - 支持像素级 min/max 约束，且始终不超过容器尺寸
 * - 非受控模式：persistKey 提供 localStorage 持久化
 * - 受控模式：传入 value/onChange，由外部控制尺寸（适用于跨组件共享尺寸的场景）
 * - fixedPanel 指定固定尺寸的面板（默认第一个），另一个 flex 填充
 * - dividerSize / dividerColor 可单独定制分隔条外观
 * - disablePointerOn 在拖拽时禁用 iframe 指针，避免拖拽穿透
 */
export default function SplitPane({
  direction,
  defaultSize = 300,
  minSize = 100,
  maxSize = Infinity,
  persistKey,
  value,
  onChange,
  disablePointerOn,
  onResize,
  fixedPanel = 'first',
  dividerSize = DEFAULT_DIVIDER_SIZE,
  dividerColor,
  children,
}: SplitPaneProps) {
  const isHorizontal = direction === 'horizontal';
  const isControlled = value !== undefined;
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState(0);
  const didRestoreRef = useRef(false);

  // 实际可用的最大尺寸 = min(用户 maxSize, 容器尺寸 - 分隔条)
  const effectiveMax = Math.max(minSize, Math.min(maxSize, containerSize - dividerSize));

  // 实时监听容器尺寸，用于把面板大小钳制在容器范围内
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => {
      const size = isHorizontal ? el.clientWidth : el.clientHeight;
      setContainerSize(size);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [isHorizontal]);

  // 非受控模式：内部维护尺寸 + 可选持久化
  const [size, setSize] = useState(defaultSize);

  // 非受控：首次容器尺寸就绪后，从 localStorage 恢复持久化值，并钳制到有效范围
  useEffect(() => {
    if (isControlled || containerSize === 0 || didRestoreRef.current) return;
    didRestoreRef.current = true;
    let target = defaultSize;
    if (persistKey) {
      const saved = localStorage.getItem(persistKey);
      // 不能用 `parseInt(saved, 10) || defaultSize`：折叠状态（尺寸 0）会被 `0 || ...` 误判为无效值而丢失
      if (saved !== null) {
        const parsed = parseInt(saved, 10);
        if (!Number.isNaN(parsed)) target = parsed;
      }
    }
    setSize(Math.max(minSize, Math.min(target, effectiveMax)));
  }, [isControlled, containerSize, effectiveMax, minSize, persistKey, defaultSize]);

  // 非受控：容器尺寸后续变化时，只钳制当前值，不重新恢复
  useEffect(() => {
    if (isControlled || !didRestoreRef.current) return;
    setSize((prev) => Math.max(minSize, Math.min(prev, effectiveMax)));
  }, [isControlled, effectiveMax, minSize]);

  // 当前生效的尺寸：受控时用 value，非受控时用内部 size
  const currentSize = isControlled ? value : size;
  // 折叠状态：固定面板尺寸为 0 时，隐藏分隔条（用于可折叠面板，如调试器）
  const isCollapsed = currentSize === 0;

  const [isDragging, setIsDragging] = useState(false);
  const startPosRef = useRef(0);
  const startSizeRef = useRef(currentSize);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    startPosRef.current = isHorizontal ? e.clientX : e.clientY;
    startSizeRef.current = currentSize;
    setIsDragging(true);
  }, [isHorizontal, currentSize]);

  // 拖拽时：锁定光标、禁止选区、禁用 iframe 指针（防拖拽穿透到 iframe 内容）
  useEffect(() => {
    if (!isDragging) return;

    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.cursor = isHorizontal ? 'col-resize' : 'row-resize';
    document.body.style.userSelect = 'none';

    // 用元素引用保存原始值，避免用 id/className 作 key 时多个元素互相覆盖
    const previousPointerEvents = new Map<HTMLElement, string>();
    if (disablePointerOn) {
      document.querySelectorAll<HTMLElement>(disablePointerOn).forEach((el) => {
        previousPointerEvents.set(el, el.style.pointerEvents);
        el.style.pointerEvents = 'none';
      });
    }

    const moveHandler = (e: MouseEvent) => {
      const pos = isHorizontal ? e.clientX : e.clientY;
      const delta = pos - startPosRef.current;
      // 固定第二个面板时，拖拽方向与尺寸变化相反（分隔条下移 → 第二个面板变小）
      const sizedDelta = fixedPanel === 'second' ? -delta : delta;
      const newSize = Math.min(Math.max(startSizeRef.current + sizedDelta, minSize), effectiveMax);
      if (isControlled) {
        onChange?.(newSize);
      } else {
        setSize(newSize);
        if (persistKey) localStorage.setItem(persistKey, newSize.toString());
      }
    };
    const upHandler = () => setIsDragging(false);

    document.addEventListener('mousemove', moveHandler);
    document.addEventListener('mouseup', upHandler);

    return () => {
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
      if (disablePointerOn) {
        previousPointerEvents.forEach((value, el) => {
          el.style.pointerEvents = value;
        });
      }
      document.removeEventListener('mousemove', moveHandler);
      document.removeEventListener('mouseup', upHandler);
    };
  }, [isDragging, isHorizontal, minSize, effectiveMax, persistKey, disablePointerOn, isControlled, onChange, fixedPanel]);

  // 拖拽结束时通知外部当前尺寸（用于调试/显示当前尺寸）：仅在拖拽刚结束时触发，挂载和普通尺寸变化不触发
  const wasDraggingRef = useRef(false);
  useEffect(() => {
    if (wasDraggingRef.current && !isDragging) {
      onResize?.(currentSize);
    }
    wasDraggingRef.current = isDragging;
  }, [isDragging, currentSize, onResize]);

  const fixedStyle = isHorizontal ? { width: `${currentSize}px` } : { height: `${currentSize}px` };
  const isFirstFixed = fixedPanel === 'first';

  // 分隔条自定义样式（粗细 + 颜色），通过 CSS 变量传入；未指定颜色时不设置，由 SCSS 兜底 var(--primary)
  const dividerVars: DividerVars = {
    '--splitpane-divider-size': `${dividerSize}px`,
    ...(dividerColor ? { '--splitpane-divider-color': dividerColor } : {}),
  };

  return (
    <div
      ref={containerRef}
      className={`${styles.splitPane} ${isHorizontal ? styles.horizontal : styles.vertical}`}
    >
      <div className={`${styles.panel} ${isFirstFixed ? '' : styles.panelFlex}`} style={isFirstFixed ? fixedStyle : undefined}>
        {children[0]}
      </div>
      {!isCollapsed && (
        <div
          className={`${styles.divider} ${isHorizontal ? styles.dividerX : styles.dividerY} ${isDragging ? styles.dividerActive : ''}`}
          style={dividerVars}
          onMouseDown={handleMouseDown}
        >
          <div className={styles.dividerLine} />
        </div>
      )}
      <div className={`${styles.panel} ${isFirstFixed ? styles.panelFlex : ''}`} style={isFirstFixed ? undefined : fixedStyle}>
        {children[1]}
      </div>
    </div>
  );
}
