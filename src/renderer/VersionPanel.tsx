import React, { useEffect, useState } from 'react';
import type { Asset, ImportDraft, Preview, VersionBridge, VersionState } from '../shared/contracts';
import { ImageViewer, Modal, value } from './ui';
import s from './workbench.module.css';
declare global {
  interface Window {
    versions: VersionBridge;
  }
}
export function VersionPanel({ asset, changed }: { asset: Asset; changed: () => void }) {
  const [state, setState] = useState<VersionState | null>(null),
    [original, setOriginal] = useState<Preview | null>(null),
    [current, setCurrent] = useState<Preview | null>(null),
    [draft, setDraft] = useState<ImportDraft | null>(null),
    [accepted, setAccepted] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [large, setLarge] = useState<Preview | null>(null),
    [action, setAction] = useState<{ kind: 'select' | 'remove'; id: string | null } | null>(null);
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    let alive = true;
    void Promise.all([window.versions.state(asset.id), window.versions.preview(asset.id, null)])
      .then(([st, p]) => {
        if (alive) {
          setState(value(st));
          setOriginal(value(p));
        }
      })
      .catch((e) => {
        if (alive) setError(String(e));
      });
    return () => {
      alive = false;
    };
  }, [asset.id]);
  useEffect(() => {
    let alive = true;
    setCurrent(null);
    if (state?.active)
      void window.versions
        .preview(asset.id, state.active)
        .then((r) => {
          if (alive) setCurrent(value(r));
        })
        .catch((e) => {
          if (alive) setError(String(e));
        });
    return () => {
      alive = false;
    };
  }, [state?.active, asset.id]);
  const active = state?.versions.find((v) => v.id === state.active),
    deployed = state?.versions.find((v) => v.id === state.deployed);
  const show = (id: string | null) =>
    void run(async () => setLarge(value(await window.manager.fullPreview(asset.id, id))));
  return (
    <div>
      <div className={s.pageHeading}>
        <h1>{asset.path.split('/').pop()}</h1>
        <small>
          {asset.width} × {asset.height} · PNG
        </small>
      </div>
      <p className={s.path}>{asset.path}</p>
      <div className={s.compare}>
        <section className={s.previewCard}>
          <h3>原始圖片 · 固定基準</h3>
          <button
            className={s.previewButton}
            disabled={busy || !original}
            onClick={() => show(null)}
          >
            {original ? <img src={original.dataUrl} alt="固定原始圖片" /> : '載入中…'}
          </button>
          <button
            disabled={busy}
            onClick={() =>
              void run(async () => {
                const r = value(await window.versions.export([asset.id], 'original'));
                if (r)
                  setError(
                    `匯出 ${r.completed.length}；略過 ${r.skipped.length}；失敗 ${r.failed.length} ${r.failed.map((x) => x.error).join('；')}`,
                  );
              })
            }
          >
            ⇩ 匯出原圖
          </button>
        </section>
        <section className={s.previewCard}>
          <h3>目前替換圖片</h3>
          <div className={s.currentLayout}>
            <button
              className={s.previewButton}
              disabled={busy || !active}
              onClick={() => show(active!.id)}
            >
              {current ? (
                <img src={current.dataUrl} alt="目前選用圖片" />
              ) : (
                <span>尚未選用替換圖</span>
              )}
            </button>
            <div>
              <strong className={active?.id === state?.deployed ? s.success : s.warning}>
                {active
                  ? `V${active.number} · ${active.id === state?.deployed ? '已套用' : '待套用'}`
                  : '尚未選用'}
              </strong>
              <p>遊戲：{deployed ? 'V' + deployed.number : '尚無工具部署紀錄'}</p>
              <p>{state?.versions.length ?? 0} 筆上傳紀錄</p>
              <button
                className={s.primary}
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    setAccepted(false);
                    setDraft(value(await window.versions.choose(asset.id)));
                  })
                }
              >
                ↥ 上傳替換圖片
              </button>
              <button
                disabled={busy || !state?.active}
                onClick={() => setAction({ kind: 'select', id: null })}
              >
                取消目前替換
              </button>
              <button
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    const r = value(await window.versions.export([asset.id], 'active'));
                    if (r)
                      setError(
                        `匯出 ${r.completed.length}；略過 ${r.skipped.length}；失敗 ${r.failed.length} ${r.failed.map((x) => x.error).join('；')}`,
                      );
                  })
                }
              >
                匯出目前版本
              </button>
              <small>無選用時匯出原圖</small>
            </div>
          </div>
        </section>
      </div>
      <section className={s.history}>
        <h3>上傳歷史</h3>
        {state?.versions.map((v) => (
          <article key={v.id} className={s.historyRow}>
            <strong className={s.success}>V{v.number}</strong>
            <small>{new Date(v.created).toLocaleString()}</small>
            <div>
              <strong>{v.name}</strong>
              <small>
                {v.width} × {v.height}
                {v.id === state.active ? ' · 目前選用' : ''}
                {v.id === state.deployed ? ' · 已部署' : ''}
              </small>
            </div>
            <button disabled={busy} onClick={() => show(v.id)}>
              ◉ 預覽
            </button>
            <button
              disabled={busy || v.id === state.active}
              onClick={() => setAction({ kind: 'select', id: v.id })}
            >
              ✓ 使用此版本
            </button>
            <button
              disabled={busy || v.id === state.active || v.id === state.deployed}
              onClick={() => setAction({ kind: 'remove', id: v.id })}
            >
              刪除紀錄
            </button>
          </article>
        ))}
        {!state?.versions.length && <p className={s.blank}>尚無歷史版本</p>}
      </section>
      <p role="status" className={s.warning}>
        {busy ? '處理中…' : error}
      </p>
      {large && <ImageViewer preview={large} close={() => setLarge(null)} />}
      {draft && (
        <Modal
          title="上傳替換圖片"
          busy={busy}
          close={() =>
            void run(async () => {
              value(await window.versions.discard(draft.token));
              setDraft(null);
            })
          }
        >
          <div className={s.image}>
            <img src={draft.preview.dataUrl} alt="待匯入圖片" />
          </div>
          <p>
            {draft.preview.name} · {draft.preview.width} × {draft.preview.height}
          </p>
          {draft.differences.length ? (
            <>
              <h3 className={s.warning}>圖片規格與原圖不同</h3>
              {draft.differences.map((d) => (
                <p key={d}>{d}</p>
              ))}
              <label className={s.checkLabel}>
                <input
                  type="checkbox"
                  checked={accepted}
                  disabled={busy}
                  onChange={(e) => setAccepted(e.target.checked)}
                />
                我接受以上差異
              </label>
            </>
          ) : (
            <p className={s.success}>✓ 圖片規格一致</p>
          )}
          <p>保存為新版本並選用，不會直接寫入遊戲。</p>
          <div className={s.modalActions}>
            <button
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  value(await window.versions.discard(draft.token));
                  setDraft(null);
                })
              }
            >
              取消
            </button>
            <button
              className={s.primary}
              disabled={busy || (!!draft.differences.length && !accepted)}
              onClick={() =>
                void run(async () => {
                  setState(value(await window.versions.commit(draft.token, accepted)));
                  setDraft(null);
                  changed();
                })
              }
            >
              確認匯入
            </button>
          </div>
          <p>{error}</p>
        </Modal>
      )}
      {action && (
        <Modal
          title={
            action.kind === 'remove'
              ? '永久刪除此歷史版本？'
              : action.id
                ? '選用此歷史版本？'
                : '取消目前替換？'
          }
          busy={busy}
          close={() => setAction(null)}
        >
          <p>
            {action.kind === 'remove' ? '只刪除此歷史版本。' : '保留歷史與已部署版本。'}
            此操作不會修改遊戲檔案。
          </p>
          <div className={s.modalActions}>
            <button disabled={busy} onClick={() => setAction(null)}>
              取消
            </button>
            <button
              className={s.primary}
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  setState(
                    value(
                      action.kind === 'remove'
                        ? await window.versions.remove(asset.id, action.id!)
                        : await window.versions.select(asset.id, action.id),
                    ),
                  );
                  setAction(null);
                  changed();
                })
              }
            >
              確認
            </button>
          </div>
          <p>{error}</p>
        </Modal>
      )}
    </div>
  );
}
