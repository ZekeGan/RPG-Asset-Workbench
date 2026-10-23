import React, { useState } from 'react';
import type { Asset, BatchFile, ImportDraft } from '../shared/contracts';
import { Modal, value } from './ui';
import s from './workbench.module.css';
export function BatchPanel({
  projectId,
  assets,
  close,
  done,
}: {
  projectId: string;
  assets: Asset[];
  close: () => void;
  done: () => void;
}) {
  const [files, setFiles] = useState<BatchFile[]>([]),
    [checks, setChecks] = useState<Record<string, ImportDraft>>({}),
    [accepted, setAccepted] = useState<Record<string, boolean>>({}),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
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
    <Modal
      title="批量配對匯入"
      wide
      busy={busy}
      close={() => {
        void window.manager.discardBatch();
        close();
      }}
    >
      <p>選擇含有 img 相對路徑的資料夾可自動配對；其他檔案請手動指定或略過。只接受靜態 PNG。</p>
      <button className={s.primary} disabled={busy} onClick={() => void load()}>
        選擇圖片資料夾
      </button>
      <div className={s.batchTable}>
        {files.map((f) => (
          <div key={f.token} className={s.batchRow}>
            <div>
              <strong>{f.path}</strong>
              <small>{f.error || checks[f.token]?.differences.join('；') || '等待配對檢查'}</small>
            </div>
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
              <option value="">略過</option>
              {assets
                .filter((a) => !a.error)
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.path}
                  </option>
                ))}
            </select>
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
          取消
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
    </Modal>
  );
}
