import React, { ReactNode, useRef } from 'react';
import { useGameEditorContext } from '@/store/useGameEditorStore';
import styles from '../topbar.module.scss';
import s from './topbarTab.module.scss';

export default function TopbarTab(props: { children: ReactNode }) {
  const topbarTag = useRef<HTMLDivElement>(null);
  const currentTopbarTab = useGameEditorContext((state) => state.currentTopbarTab);

  const isAddSentenceActive = currentTopbarTab === 'addSentence';

  const handleScroll = (event: React.WheelEvent<HTMLDivElement>) => {
    const deltaY = event.deltaY;
    // console.log(`滚动距离：${deltaY}px`);
    const element = topbarTag.current;
    if (element) {
      const x = element.scrollLeft;
      const toX = x + deltaY;
      element.scrollTo(toX, 0);
    }
  };

  return (
    <div
      className={s.tab + (isAddSentenceActive ? ' ' + styles.topbar_btn_special_active_topbar_tags : '')}
      ref={topbarTag}
      onWheel={handleScroll}
    >
      {props.children}
    </div>
  );
}
