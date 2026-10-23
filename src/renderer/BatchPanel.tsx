import React, { useEffect, useRef, useState } from 'react';
import type { Asset, BatchFile, ImportDraft } from '../shared/contracts';
import { value } from './ui';
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
      setError(String(e));
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
      setError(String(e));
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
        if (busy) return;
        const dropped = Array.from(e.dataTransfer.files);
        setBusy(true);
        setError('');
        void window.manager
          .dropBatch(projectId, dropped)
          .then((r) => acceptRows(value(r)))
          .catch((e) => setError(String(e)))
          .finally(() => setBusy(false));
      }}
    >
      <h1>批量匯入與配對</h1>
      <p>
        拖入圖片，或選擇圖片資料夾。完整相對路徑優先，其次全專案唯一檔名；多個候選請手動指定。只接受靜態
        PNG。
      </p>
      <div className={s.dropZone}>
        <p>拖曳圖片到此處，或選擇圖片資料夾</p>
        <button className={s.primary} disabled={busy} onClick={() => void load()}>
          選擇圖片資料夾
        </button>
      </div>
      <div className={s.batchTable}>
        <div className={s.batchRow}>
          <strong>匯入圖片</strong>
          <strong>配對原圖</strong>
          <strong>檢查結果</strong>
          <strong>操作</strong>
        </div>
        {files.map((f) => (
          <div key={f.token} className={s.batchRow}>
            <div>
              {checks[f.token] && (
                <img width="100" src={checks[f.token].preview.dataUrl} alt={'匯入 ' + f.name} />
              )}
              <strong>{f.path}</strong>
            </div>
            <div className={s.batchTarget}>
              {f.assetId && <BatchOriginal id={f.assetId} />}
              <select
                aria-label={'配對 ' + f.path}
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
                <option value="">略過／手動指定</option>
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
                {f.error ||
                  (checks[f.token]
                    ? checks[f.token].differences.join('；') || '圖片規格一致'
                    : f.candidates.length > 1
                      ? '多個候選，請手動指定'
                      : '未配對')}
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
                接受差異
              </label>
            )}
          </div>
        ))}
      </div>
      {duplicate && <p className={s.warning}>同一素材被配對多次，請修正。</p>}
      <p role="status">{error}</p>
      <div className={s.modalActions}>
        <span>
          {selected.length} 張待匯入 · {files.length - selected.length} 張略過
        </span>
        <button
          disabled={busy}
          onClick={() => {
            void window.manager.discardBatch();
            close();
          }}
        >
          返回工作臺
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
              .catch((e) => setError(String(e)))
              .finally(() => setBusy(false));
          }}
        >
          確認整批匯入
        </button>
      </div>
    </section>
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
  return src ? <img width="100" src={src} alt="配對原圖" /> : <span>載入原圖…</span>;
}
