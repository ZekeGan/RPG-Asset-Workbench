import { t } from '../shared/i18n';
import React, { useEffect, useRef, useState } from 'react';
import type { Asset } from '../shared/contracts';
import { Icon } from './ui';
import s from './workbench.module.css';
export function Thumbnail({
  asset,
  version = null,
  onOpen,
}: {
  asset: Asset;
  version?: string | null;
  onOpen?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null),
    [src, setSrc] = useState(''),
    [error, setError] = useState('');
  useEffect(() => {
    let alive = true,
      started = false;
    setSrc('');
    setError('');
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting) || started || asset.error) return;
        started = true;
        void window.versions
          .preview(asset.id, version)
          .then((r) => {
            if (alive) {
              if (r.ok) setSrc(r.value.dataUrl);
              else setError(r.error);
            }
          })
          .catch((e) => {
            if (alive) setError(t(String(e)));
          });
      },
      { rootMargin: '100px' },
    );
    if (ref.current) observer.observe(ref.current);
    return () => {
      alive = false;
      observer.disconnect();
    };
  }, [asset.id, version]);
  const content = (
    <div ref={ref} className={s.image}>
      {src ? (
        <img src={src} alt={asset.path} />
      ) : (
        <span>{asset.error ? t('無法預覽') : error || <Icon name="image" />}</span>
      )}
    </div>
  );
  return onOpen ? (
    <button
      className={s.thumbnailButton}
      disabled={!!asset.error || !src}
      onClick={onOpen}
      aria-label={t('放大圖片 ') + asset.path}
    >
      {content}
    </button>
  ) : (
    content
  );
}
