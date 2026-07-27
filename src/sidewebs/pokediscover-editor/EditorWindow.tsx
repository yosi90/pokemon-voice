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

const MIN_WIDTH = 360;
const MIN_HEIGHT = 220;

interface EditorWindowBounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

function readCanvasBounds(): EditorWindowBounds {
  const target = document.querySelector<HTMLElement>('.editor-window-bounds');
  const rectangle = target?.getBoundingClientRect();
  if (rectangle?.width && rectangle.height) {
    return {
      left: rectangle.left,
      top: rectangle.top,
      width: rectangle.width,
      height: rectangle.height,
    };
  }
  return { left: 0, top: 94, width: window.innerWidth, height: Math.max(220, window.innerHeight - 119) };
}

function clampGeometry(value: EditorWindowGeometry, bounds: EditorWindowBounds) {
  const minimumWidth = Math.min(MIN_WIDTH, bounds.width);
  const minimumHeight = Math.min(MIN_HEIGHT, bounds.height);
  const width = Math.min(Math.max(minimumWidth, value.width), bounds.width);
  const height = Math.min(
    Math.max(minimumHeight, value.height),
    bounds.height,
  );
  return {
    width,
    height,
    x: Math.min(Math.max(bounds.left, value.x), bounds.left + bounds.width - width),
    y: Math.min(Math.max(bounds.top, value.y), bounds.top + bounds.height - height),
  };
}

function readStoredGeometry(
  id: string,
  fallback: EditorWindowGeometry,
  bounds: EditorWindowBounds,
) {
  try {
    const raw = localStorage.getItem(`pokediscover:window:${id}`);
    if (!raw) return clampGeometry(fallback, bounds);
    const stored = JSON.parse(raw) as StoredEditorWindowGeometry;
    return clampGeometry({
      x: bounds.left + stored.xRatio * bounds.width,
      y: bounds.top + stored.yRatio * bounds.height,
      width: stored.width,
      height: stored.height,
    }, bounds);
  } catch {
    return clampGeometry(fallback, bounds);
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
  const [bounds, setBounds] = useState(readCanvasBounds);
  const [geometry, setGeometry] = useState(() => readStoredGeometry(id, initialGeometry, readCanvasBounds()));
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
        xRatio: bounds.width ? (geometry.x - bounds.left) / bounds.width : 0,
        yRatio: bounds.height ? (geometry.y - bounds.top) / bounds.height : 0,
        width: geometry.width,
        height: geometry.height,
      };
      localStorage.setItem(`pokediscover:window:${id}`, JSON.stringify(value));
    };
    persist();
  }, [bounds, geometry, id]);

  useEffect(() => {
    const keepInsideCanvas = () => {
      const nextBounds = readCanvasBounds();
      setBounds(nextBounds);
      setGeometry(current => clampGeometry(current, nextBounds));
    };
    const restore = () => {
      localStorage.removeItem(`pokediscover:window:${id}`);
      const nextBounds = readCanvasBounds();
      setBounds(nextBounds);
      setGeometry(clampGeometry(initialGeometry, nextBounds));
      setMaximized(false);
      setMinimized(false);
    };
    const applyWindowAction = (event: Event) => {
      const action = (event as CustomEvent<{ action?: 'minimize' | 'recover' }>).detail?.action;
      if (action === 'minimize') setMinimized(true);
      if (action === 'recover') setMinimized(false);
    };
    const resizeObserver = new ResizeObserver(keepInsideCanvas);
    const boundsElement = document.querySelector<HTMLElement>('.editor-window-bounds');
    if (boundsElement) resizeObserver.observe(boundsElement);
    keepInsideCanvas();
    window.addEventListener('resize', keepInsideCanvas);
    window.addEventListener('pokediscover:restore-layout', restore);
    window.addEventListener('pokediscover:window-action', applyWindowAction);
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', keepInsideCanvas);
      window.removeEventListener('pokediscover:restore-layout', restore);
      window.removeEventListener('pokediscover:window-action', applyWindowAction);
    };
  }, [id, initialGeometry]);

  if (!open) return null;
  const displayed = maximized
    ? {
      x: bounds.left,
      y: bounds.top,
      width: bounds.width,
      height: bounds.height,
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
      }, bounds));
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
