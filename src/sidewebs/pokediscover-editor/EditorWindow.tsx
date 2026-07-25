import { useEffect, useRef, useState, type ReactNode } from 'react';

export interface EditorWindowGeometry {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface StoredEditorWindowGeometry {
  xRatio: number;
  yRatio: number;
  width: number;
  height: number;
}

const DESKTOP_TOP = 62;
const DESKTOP_BOTTOM = 28;
const MIN_WIDTH = 360;
const MIN_HEIGHT = 220;

function clampGeometry(value: EditorWindowGeometry) {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const width = Math.min(Math.max(MIN_WIDTH, value.width), Math.max(MIN_WIDTH, viewportWidth - 24));
  const height = Math.min(
    Math.max(MIN_HEIGHT, value.height),
    Math.max(MIN_HEIGHT, viewportHeight - DESKTOP_TOP - DESKTOP_BOTTOM - 12),
  );
  return {
    width,
    height,
    x: Math.min(Math.max(12, value.x), Math.max(12, viewportWidth - width - 12)),
    y: Math.min(
      Math.max(DESKTOP_TOP, value.y),
      Math.max(DESKTOP_TOP, viewportHeight - DESKTOP_BOTTOM - height - 8),
    ),
  };
}

function readStoredGeometry(id: string, fallback: EditorWindowGeometry) {
  try {
    const raw = localStorage.getItem(`pokediscover:window:${id}`);
    if (!raw) return clampGeometry(fallback);
    const stored = JSON.parse(raw) as StoredEditorWindowGeometry;
    return clampGeometry({
      x: stored.xRatio * window.innerWidth,
      y: stored.yRatio * window.innerHeight,
      width: stored.width,
      height: stored.height,
    });
  } catch {
    return clampGeometry(fallback);
  }
}

export function EditorWindow({
  id,
  title,
  open,
  initialGeometry,
  zIndex,
  onClose,
  onFocus,
  children,
}: {
  id: string;
  title: string;
  open: boolean;
  initialGeometry: EditorWindowGeometry;
  zIndex: number;
  onClose: () => void;
  onFocus: () => void;
  children: ReactNode;
}) {
  const [geometry, setGeometry] = useState(() => readStoredGeometry(id, initialGeometry));
  const [minimized, setMinimized] = useState(false);
  const [maximized, setMaximized] = useState(false);
  const dragRef = useRef<{
    kind: 'move' | 'resize';
    x: number;
    y: number;
    start: EditorWindowGeometry;
  } | undefined>(undefined);

  useEffect(() => {
    const persist = () => {
      const value: StoredEditorWindowGeometry = {
        xRatio: geometry.x / window.innerWidth,
        yRatio: geometry.y / window.innerHeight,
        width: geometry.width,
        height: geometry.height,
      };
      localStorage.setItem(`pokediscover:window:${id}`, JSON.stringify(value));
    };
    persist();
  }, [geometry, id]);

  useEffect(() => {
    const keepInsideViewport = () => setGeometry(current => clampGeometry(current));
    const restore = () => {
      localStorage.removeItem(`pokediscover:window:${id}`);
      setGeometry(clampGeometry(initialGeometry));
      setMaximized(false);
      setMinimized(false);
    };
    const applyWindowAction = (event: Event) => {
      const action = (event as CustomEvent<{ action?: 'minimize' | 'recover' }>).detail?.action;
      if (action === 'minimize') setMinimized(true);
      if (action === 'recover') setMinimized(false);
    };
    window.addEventListener('resize', keepInsideViewport);
    window.addEventListener('pokediscover:restore-layout', restore);
    window.addEventListener('pokediscover:window-action', applyWindowAction);
    return () => {
      window.removeEventListener('resize', keepInsideViewport);
      window.removeEventListener('pokediscover:restore-layout', restore);
      window.removeEventListener('pokediscover:window-action', applyWindowAction);
    };
  }, [id, initialGeometry]);

  if (!open) return null;
  const displayed = maximized
    ? {
      x: 12,
      y: DESKTOP_TOP,
      width: window.innerWidth - 24,
      height: window.innerHeight - DESKTOP_TOP - DESKTOP_BOTTOM - 8,
    }
    : geometry;

  const beginPointerAction = (
    kind: 'move' | 'resize',
    event: React.PointerEvent<HTMLElement>,
  ) => {
    if (maximized) return;
    onFocus();
    dragRef.current = {
      kind,
      x: event.clientX,
      y: event.clientY,
      start: geometry,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const continuePointerAction = (event: React.PointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    setGeometry(clampGeometry(drag.kind === 'move'
      ? { ...drag.start, x: drag.start.x + dx, y: drag.start.y + dy }
      : {
        ...drag.start,
        width: drag.start.width + dx,
        height: drag.start.height + dy,
      }));
  };

  return (
    <section
      className={`editor-window${minimized ? ' is-minimized' : ''}${maximized ? ' is-maximized' : ''}`}
      aria-label={title}
      style={{
        left: displayed.x,
        top: displayed.y,
        width: displayed.width,
        height: minimized ? 42 : displayed.height,
        zIndex,
      }}
      onPointerDown={onFocus}
    >
      <header
        className="editor-window__titlebar"
        onPointerDown={event => beginPointerAction('move', event)}
        onPointerMove={continuePointerAction}
        onPointerUp={() => { dragRef.current = undefined; }}
        onDoubleClick={() => {
          setMaximized(value => !value);
          setMinimized(false);
        }}
      >
        <strong>{title}</strong>
        <div>
          <button
            type="button"
            aria-label={`Minimizar ${title}`}
            title="Minimizar"
            onPointerDown={event => event.stopPropagation()}
            onClick={() => setMinimized(value => !value)}
          >—</button>
          <button
            type="button"
            aria-label={`${maximized ? 'Restaurar' : 'Maximizar'} ${title}`}
            title={maximized ? 'Restaurar' : 'Maximizar'}
            onPointerDown={event => event.stopPropagation()}
            onClick={() => {
              setMaximized(value => !value);
              setMinimized(false);
            }}
          >{maximized ? '❐' : '□'}</button>
          <button
            type="button"
            aria-label={`Cerrar ${title}`}
            title="Cerrar"
            onPointerDown={event => event.stopPropagation()}
            onClick={onClose}
          >×</button>
        </div>
      </header>
      {!minimized ? <div className="editor-window__content">{children}</div> : null}
      {!minimized && !maximized ? (
        <div
          className="editor-window__resize"
          aria-hidden="true"
          onPointerDown={event => beginPointerAction('resize', event)}
          onPointerMove={continuePointerAction}
          onPointerUp={() => { dragRef.current = undefined; }}
        />
      ) : null}
    </section>
  );
}
