import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ManagerBridge, Preview, Result } from '../shared/contracts';
import s from './workbench.module.css';
declare global {
  interface Window {
    manager: ManagerBridge;
  }
}
export function value<T>(r: Result<T>): T {
  if (!r.ok) throw Error(r.error);
  return r.value;
}
export function Modal({
  title,
  close,
  busy = false,
  children,
  wide = false,
}: {
  title: string;
  close: () => void;
  busy?: boolean;
  children: React.ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (!busy) close();
      }
      if (e.key === 'Tab') {
        const nodes = Array.from(
          ref.current?.querySelectorAll<HTMLElement>(
            'button:not(:disabled),input:not(:disabled),select:not(:disabled),[tabindex="0"]',
          ) ?? [],
        );
        if (!nodes.length) {
          e.preventDefault();
          return;
        }
        const first = nodes[0],
          last = nodes[nodes.length - 1];
        if (
          e.shiftKey &&
          (document.activeElement === first || document.activeElement === ref.current)
        ) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', key, true);
    return () => {
      document.removeEventListener('keydown', key, true);
      previous?.focus();
    };
  }, [busy]);
  return createPortal(
    <div className={`${s.app} ${s.overlay}`}>
      <section
        ref={ref}
        tabIndex={-1}
        className={`${s.modal} ${wide ? s.wide : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className={s.modalHeading}>
          <h2>{title}</h2>
          <button disabled={busy} aria-label="關閉彈窗" onClick={close}>
            ×
          </button>
        </div>
        {children}
      </section>
    </div>,
    document.body,
  );
}
export function ImageViewer({ preview, close }: { preview: Preview; close: () => void }) {
  const box = useRef<HTMLDivElement>(null),
    drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null),
    [scale, setScale] = useState<number | null>(null);
  const fit = () => {
    const b = box.current;
    if (b)
      setScale(
        Math.min(1, (b.clientWidth - 32) / preview.width, (b.clientHeight - 32) / preview.height),
      );
  };
  useEffect(() => {
    fit();
  }, [preview]);
  return (
    <Modal title={preview.name} close={close} wide>
      <div className={s.viewerTools}>
        <button onClick={() => setScale((z) => Math.max(0.05, (z ?? 1) / 1.25))}>−</button>
        <span>{Math.round((scale ?? 1) * 100)}%</span>
        <button onClick={() => setScale((z) => Math.min(8, (z ?? 1) * 1.25))}>＋</button>
        <button onClick={() => setScale(1)}>100%</button>
        <button onClick={fit}>適合畫面</button>
        <small>
          {preview.width} × {preview.height} · 拖曳／滾輪縮放
        </small>
      </div>
      <div
        ref={box}
        className={s.viewer}
        onWheel={(e) =>
          setScale((z) => Math.min(8, Math.max(0.05, (z ?? 1) * (e.deltaY > 0 ? 0.9 : 1.1))))
        }
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          const b = box.current!;
          drag.current = { x: e.clientX, y: e.clientY, left: b.scrollLeft, top: b.scrollTop };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (drag.current) {
            box.current!.scrollLeft = drag.current.left - (e.clientX - drag.current.x);
            box.current!.scrollTop = drag.current.top - (e.clientY - drag.current.y);
          }
        }}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
      >
        <img
          draggable={false}
          src={preview.dataUrl}
          alt={preview.name}
          style={{
            width: preview.width * (scale ?? 1),
            height: preview.height * (scale ?? 1),
            maxWidth: 'none',
          }}
        />
      </div>
    </Modal>
  );
}
export function Icon({
  name,
}: {
  name: 'image' | 'folder' | 'upload' | 'home' | 'check' | 'settings';
}) {
  const paths = {
    image: 'M3 3h18v18H3z M3 17l6-6 4 4 3-3 5 5 M8 7h.01',
    folder: 'M3 6h7l2 2h9v12H3z',
    upload: 'M12 16V3 M7 8l5-5 5 5 M4 14v7h16v-7',
    home: 'M3 11l9-8 9 8 M6 9v12h12V9 M10 21v-7h4v7',
    check: 'M4 12l5 5L20 6',
    settings:
      'M12 8a4 4 0 1 0 0 8a4 4 0 0 0 0-8 M12 2v3 M12 19v3 M2 12h3 M19 12h3 M5 5l2 2 M17 17l2 2 M5 19l2-2 M17 7l2-2',
  };
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}
