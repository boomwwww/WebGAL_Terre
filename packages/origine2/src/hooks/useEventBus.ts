import mitt, { type Handler } from 'mitt';
import { useRef, useCallback, useEffect } from 'react';

// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
type AEvent = {
  'app:set-tab-aside': boolean;
};

// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
type BEvent = {
  'app:set-route-full-path': string;
};
// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
type CEvent = {
  'get-ws-message': string;
  refGame: null;
  'update-scene': string;
};

type Events = AEvent & BEvent & CEvent;

export const bus = mitt<Events>();

export const useEventBus = () => {
  const handlers = useRef(new Map<keyof Events, Set<Handler<Events[keyof Events]>>>());
  /** 订阅事件  */
  const on = useCallback(<K extends keyof Events>(type: K, handler: Handler<Events[K]>): void => {
    const handlerSet = handlers.current.get(type);
    if (!handlerSet) {
      const newHandlerSet = new Set<Handler<Events[keyof Events]>>();
      newHandlerSet.add(handler as Handler<Events[keyof Events]>);
      handlers.current.set(type, newHandlerSet);
    } else {
      handlerSet.add(handler as Handler<Events[keyof Events]>);
    }
    bus.on(type, handler);
  }, []);
  /** 订阅一次性事件 */
  const once = useCallback(<K extends keyof Events>(type: K, handler: Handler<Events[K]>): void => {
    const handlerWrapper = (event: Events[K]): void => {
      try {
        handler(event);
      } finally {
        bus.off(type, handlerWrapper);
      }
    };
    bus.on(type, handlerWrapper);
  }, []);
  /** 发布事件 */
  const emit = useCallback(<K extends keyof Events>(type: K, event: Events[K]): void => {
    bus.emit(type, event);
  }, []);
  /** 发布事件的同时订阅另一个一次性事件 */
  const emitOnce = useCallback(
    <K extends keyof Events, L extends keyof Events>(
      emitType: K,
      emitEvent: Events[K],
      onType: L,
      onHandler: Handler<Events[L]>,
      // eslint-disable-next-line max-params
    ): void => {
      const handlerWrapper = (event: Events[L]): void => {
        try {
          onHandler(event);
        } finally {
          bus.off(onType, handlerWrapper);
        }
      };
      bus.on(onType, handlerWrapper);
      bus.emit(emitType, emitEvent);
    },
    [],
  );
  /** 取消订阅事件 */
  const off = useCallback(<K extends keyof Events>(type: K, handler: Handler<Events[K]>): void => {
    const handlerSet = handlers.current.get(type);
    if (handlerSet) {
      handlerSet.delete(handler as Handler<Events[keyof Events]>);
      if (handlerSet.size === 0) {
        handlers.current.delete(type);
      }
    }
    bus.off(type, handler);
  }, []);

  useEffect(() => {
    /** 自动取消订阅事件 */
    return () => {
      handlers.current.forEach((handlerSet, type) => {
        handlerSet.forEach((handler) => {
          bus.off(type, handler);
        });
      });
      handlers.current.clear();
    };
  }, []);
  return { on, once, emit, emitOnce, off };
};
