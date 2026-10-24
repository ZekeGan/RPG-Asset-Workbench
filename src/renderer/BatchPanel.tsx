import { t } from '../shared/i18n';
import React, { useEffect, useRef, useState } from 'react';
import type { Asset, BatchFile, ImportDraft, Preview } from '../shared/contracts';
import { value, ImageViewer } from './ui';
import s from './workbench.module.css';
export function BatchPanel({
  projectId,
  assets,
  close,
  done,
  initialFiles,
  onBusy,
}: {
  projectId: string;
  assets: Asset[];
  close: () => void;
  done: () => void;
  initialFiles: BatchFile[] | null;
  onBusy: (busy: boolean) => void;
}) {
  const [large, setLarge] = useState<Preview | null>(null);
  const [files, setFiles] = useState<BatchFile[]>([]),
    [checks, setChecks] = useState<Record<string, ImportDraft>>({}),
    [accepted, setAccepted] = useState<Record<string, boolean>>({}),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const initialized = useRef(false);
  useEffect(() => {
    onBusy(busy);
  }, [busy]);
  useEffect(() => {
    if (initialized.current || !initialFiles) return;
    initialized.current = true;
    setBusy(true);
    void acceptRows(initialFiles).finally(() => setBusy(false));
  }, [initialFiles]);
  async function acceptRows(rows: BatchFile[]) {
    setFiles(rows);
    setChecks({});
    setAccepted({});
    for (const f of rows) if (f.assetId && !f.error) await inspect(f, f.assetId);
  }
  async function inspect(f: BatchFile, id: string | null) {
    setAccepted((a) => ({ ...a, [f.token]: false }));
    setChecks((c) => {
      const next = { ...c };
      delete next[f.token];
      return next;
    });
    if (!id) return;
    try {
      const c = value(await window.manager.inspectBatch(f.token, id));
      setChecks((x) => ({ ...x, [f.token]: c }));
    } catch (e) {
      setError(t(String(e)));
    }
  }
  async function load() {
    setBusy(true);
    setError('');
    try {
      const rows = value(await window.manager.chooseBatch(projectId));
      if (rows) {
        setFiles(rows);
        setChecks({});
        setAccepted({});
        for (const f of rows) if (f.assetId && !f.error) await inspect(f, f.assetId);
      }
    } catch (e) {
      setError(t(String(e)));
    } finally {
      setBusy(false);
    }
  }
  const selected = files.filter((f) => f.assetId),
    duplicate = new Set(selected.map((f) => f.assetId)).size !== selected.length,
    invalid = selected.some(
      (f) =>
        f.error || !checks[f.token] || (checks[f.token].differences.length && !accepted[f.token]),
    );
  return (
    <section
      className={s.batchPage}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (busy || large) return;
        const dropped = Array.from(e.dataTransfer.files);
        setBusy(true);
        setError('');
        void window.manager
          .dropBatch(projectId, dropped)
          .then((r) => acceptRows(value(r)))
          .catch((e) => setError(t(String(e))))
          .finally(() => setBusy(false));
      }}
    >
      <h1>{t('批量匯入與配對')}</h1>
      <p>
        {t(
          '拖入圖片，或選擇圖片資料夾。完整相對路徑優先，其次全專案唯一檔名；多個候選請手動指定。只接受靜態 PNG。',
        )}
      </p>
      <div className={s.dropZone}>
        <p>{t('拖曳圖片到此處，或選擇圖片資料夾')}</p>
        <button className={s.primary} disabled={busy} onClick={() => void load()}>
          {t('選擇圖片資料夾')}
        </button>
      </div>
      <div className={s.batchTable}>
        <div className={s.batchRow}>
          <strong>{t('匯入圖片')}</strong>
          <strong>{t('配對原圖')}</strong>
          <strong>{t('檢查結果')}</strong>
          <strong>{t('操作')}</strong>
        </div>
        {files.map((f) => (
          <div key={f.token} className={s.batchRow}>
            <div>
              {!f.error && <BatchSource file={f} open={setLarge} />}
              {f.error && <small className={s.warning}>{t(f.error)}</small>}
              <strong>{f.path}</strong>
            </div>
            <div className={s.batchTarget}>
              {f.assetId && <BatchOriginal id={f.assetId} />}
              <select
                aria-label={t('配對 ') + f.path}
                disabled={busy || !!f.error}
                value={f.assetId ?? ''}
                onChange={(e) => {
                  const id = e.target.value || null;
                  setFiles((rows) =>
                    rows.map((r) => (r.token === f.token ? { ...r, assetId: id } : r)),
                  );
                  setBusy(true);
                  void inspect(f, id).finally(() => setBusy(false));
                }}
              >
                <option value="">{t('略過／手動指定')}</option>
                {assets
                  .filter((a) => !a.error)
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.path}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <small>
                {f.error
                  ? t(f.error)
                  : checks[f.token]
                    ? checks[f.token].differences.map((d) => t(d)).join('；') || t('圖片規格一致')
                    : f.candidates.length > 1
                      ? t('多個候選，請手動指定')
                      : t('未配對')}
              </small>
            </div>
            {!!checks[f.token]?.differences.length && (
              <label>
                <input
                  type="checkbox"
                  checked={!!accepted[f.token]}
                  disabled={busy}
                  onChange={(e) => setAccepted((a) => ({ ...a, [f.token]: e.target.checked }))}
                />
                {t('接受差異')}
              </label>
            )}
          </div>
        ))}
      </div>
      {large && <ImageViewer preview={large} close={() => setLarge(null)} />}
      {duplicate && <p className={s.warning}>{t('同一素材被配對多次，請修正。')}</p>}
      <p role="status">{error}</p>
      <div className={s.modalActions}>
        <span>
          {t('{0} 張待匯入 · {1} 張略過', [selected.length, files.length - selected.length])}
        </span>
        <button
          disabled={busy}
          onClick={() => {
            void window.manager.discardBatch();
            close();
          }}
        >
          {t('返回工作臺')}
        </button>
        <button
          className={s.primary}
          disabled={busy || !selected.length || duplicate || invalid}
          onClick={() => {
            setBusy(true);
            setError('');
            void window.manager
              .commitBatch(
                projectId,
                selected.map((f) => ({
                  token: f.token,
                  assetId: f.assetId!,
                  accepted: !!accepted[f.token],
                })),
              )
              .then((r) => {
                value(r);
                done();
                close();
              })
              .catch((e) => setError(t(String(e))))
              .finally(() => setBusy(false));
          }}
        >
          {t('確認整批匯入')}
        </button>
      </div>
    </section>
  );
}
function BatchSource({ file, open }: { file: BatchFile; open: (p: Preview) => void }) {
  const ref = useRef<HTMLDivElement>(null),
    [preview, setPreview] = useState<Preview | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let alive = true,
      started = false;
    const observer = new IntersectionObserver(
      (entries) => {
        if (started || !entries.some((e) => e.isIntersecting)) return;
        started = true;
        void window.manager
          .previewBatch(file.token)
          .then((r) => {
            if (alive) setPreview(value(r));
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
  }, [file.token]);
  return (
    <div ref={ref}>
      {preview ? (
        <button
          className={s.batchPreview}
          disabled={busy}
          aria-label={t('放大匯入圖片 ') + file.name}
          onClick={() => {
            setBusy(true);
            void window.manager
              .previewBatch(file.token, true)
              .then((r) => open(value(r)))
              .catch((e) => setError(t(String(e))))
              .finally(() => setBusy(false));
          }}
        >
          <img width="100" src={preview.dataUrl} alt={file.name} />
        </button>
      ) : (
        <small>{t('載入圖片…')}</small>
      )}
      <small role="status">{error}</small>
    </div>
  );
}
function BatchOriginal({ id }: { id: string }) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    let alive = true;
    setSrc('');
    void window.versions
      .preview(id, null)
      .then((r) => {
        if (alive && r.ok) setSrc(r.value.dataUrl);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [id]);
  return src ? <img width="100" src={src} alt={t('配對原圖')} /> : <span>{t('載入原圖…')}</span>;
}
