import React, { useCallback, useEffect, useRef, useState } from 'react';
import styles from './multiSplitPane.module.scss';

interface MultiSplitPaneProps {
  direction: 'horizontal' | 'vertical';
  /** 各段尺寸：固定段为像素数值，最后一段必须是 'flex'（自动填充剩余空间） */
  sizes: Array<number | 'flex'>;
  /** 每段的最小尺寸（像素），默认 0 */
  minSizes?: number[];
  /** 受控回调：拖拽后返回各固定段的尺寸（不含 flex 段） */
  onSizesChange?: (sizes: number[]) => void;
  /** 分隔条拖拽热区尺寸（像素），默认 4 */
  dividerSize?: number;
  /** 分隔条线的颜色，默认使用主题变量 var(--primary) */
  dividerColor?: string;
  /** 拖拽时临时禁用 pointer-events 的元素选择器，用于避免 iframe 吞掉 mousemove */
  disablePointerOn?: string;
  children: React.ReactNode[];
}

const DEFAULT_DIVIDER_SIZE = 4;

/** 分隔条自定义样式变量（粗细 + 颜色），通过 CSS 变量控制 */
type MultiSplitPaneDividerVars = React.CSSProperties & {
  '--msp-divider-size': string;
  '--msp-divider-color'?: string;
};

/**
 * 多段分割面板：拖拽分隔条调整各段尺寸
 * - 支持横向/纵向，任意数量面板
 * - 最后一段固定为 'flex'，自动填充剩余空间
 * - 拖拽某个分隔条时，只调整其上方/左侧的固定段尺寸
 * - 受控模式：sizes 由外部传入，拖拽通过 onSizesChange 通知
 */
export default function MultiSplitPane({
  direction,
  sizes,
  minSizes = [],
  onSizesChange,
  dividerSize = DEFAULT_DIVIDER_SIZE,
  dividerColor,
  disablePointerOn,
  children,
}: MultiSplitPaneProps) {
  const isHorizontal = direction === 'horizontal';
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState(0);
  const [activeDividerIndex, setActiveDividerIndex] = useState<number | null>(null);

  // 记录拖拽起始信息
  const dragInfoRef = useRef<{
    index: number; // 被拖拽分隔条对应的固定段索引
    startPos: number;
    startSize: number;
  } | null>(null);

  // 实时监听容器尺寸
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

  // 从 sizes 提取固定段的当前值
  const fixedSizes = sizes.filter((s): s is number => s !== 'flex');

  const handleDividerMouseDown = (index: number) => (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    const pos = isHorizontal ? e.clientX : e.clientY;
    dragInfoRef.current = {
      index,
      startPos: pos,
      startSize: fixedSizes[index],
    };
    setActiveDividerIndex(index);
  };

  // 拖拽时：锁定光标、禁止选区、禁用 iframe 指针
  useEffect(() => {
    if (activeDividerIndex === null || !dragInfoRef.current) return;

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
      const info = dragInfoRef.current;
      if (!info) return;
      const pos = isHorizontal ? e.clientX : e.clientY;
      const delta = pos - info.startPos;
      const min = minSizes[info.index] ?? 0;
      const newSize = Math.max(min, info.startSize + delta);
      // 更新对应的固定段尺寸
      const next = fixedSizes.map((s, i) => (i === info.index ? newSize : s));
      onSizesChange?.(next);
    };

    const upHandler = () => {
      setActiveDividerIndex(null);
      dragInfoRef.current = null;
    };

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
  }, [activeDividerIndex, isHorizontal, minSizes, fixedSizes, onSizesChange, disablePointerOn]);

  const dividerVars: MultiSplitPaneDividerVars = {
    '--msp-divider-size': `${dividerSize}px`,
    ...(dividerColor ? { '--msp-divider-color': dividerColor } : {}),
  };

  // 渲染各段 + 分隔条
  const content = [];
  const dividerCount = children.length - 1;
  for (let i = 0; i < children.length; i++) {
    // 判断该段是否固定尺寸（最后一个或显式 flex）
    const isFlex = sizes[i] === 'flex' || i === children.length - 1;
    const fixedSize = typeof sizes[i] === 'number' ? (sizes[i] as number) : undefined;
    const panelStyle = isFlex
      ? undefined
      : isHorizontal
        ? { width: `${fixedSize}px` }
        : { height: `${fixedSize}px` };

    content.push(
      <div
        key={`panel-${i}`}
        className={`${styles.panel} ${isFlex ? styles.panelFlex : ''}`}
        style={panelStyle}
      >
        {children[i]}
      </div>
    );

    // 段之间插入分隔条
    if (i < dividerCount) {
      content.push(
        <div
          key={`divider-${i}`}
          className={`${styles.divider} ${isHorizontal ? styles.dividerX : styles.dividerY} ${activeDividerIndex === i ? styles.dividerActive : ''}`}
          style={dividerVars}
          onMouseDown={handleDividerMouseDown(i)}
        >
          <div className={styles.dividerLine} />
        </div>
      );
    }
  }

  return (
    <div
      ref={containerRef}
      className={`${styles.multiSplitPane} ${isHorizontal ? styles.horizontal : styles.vertical}`}
    >
      {content}
    </div>
  );
}