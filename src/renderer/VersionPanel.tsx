import { t, getLocale } from '../shared/i18n';
import React, { useEffect, useState } from 'react';
import type { Asset, ImportDraft, Preview, VersionBridge, VersionState } from '../shared/contracts';
import { ImageViewer, Modal, value } from './ui';
import { Thumbnail } from './Thumbnail';
import s from './workbench.module.css';
declare global {
  interface Window {
    versions: VersionBridge;
  }
}
export function VersionPanel({
  asset,
  changed,
  onBusy,
}: {
  asset: Asset;
  changed: () => void;
  onBusy?: (busy: boolean) => void;
}) {
  const [state, setState] = useState<VersionState | null>(null),
    [original, setOriginal] = useState<Preview | null>(null),
    [current, setCurrent] = useState<Preview | null>(null),
    [draft, setDraft] = useState<ImportDraft | null>(null),
    [accepted, setAccepted] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [large, setLarge] = useState<Preview | null>(null),
    [action, setAction] = useState<{
      kind: 'select' | 'remove' | 'cancel';
      id: string | null;
    } | null>(null);
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    onBusy?.(true);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError(t(String(e)));
    } finally {
      setBusy(false);
      onBusy?.(false);
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
        if (alive) setError(t(String(e)));
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
          if (alive) setError(t(String(e)));
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
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (busy || draft || action || large) return;
        const files = Array.from(e.dataTransfer.files);
        if (files.length !== 1) {
          setError(t('詳細頁只接受一張圖片，批量匯入請返回工作臺。'));
          return;
        }
        void run(async () => {
          setAccepted(false);
          setDraft(value(await window.versions.drop(asset.id, files)));
        });
      }}
    >
      <div className={s.pageHeading}>
        <h1>{asset.path.split('/').pop()}</h1>
        <small>
          {asset.width} × {asset.height} · PNG
        </small>
      </div>
      <p className={s.path}>{asset.path}</p>
      <div className={s.compare}>
        <section className={s.previewCard}>
          <h3>{t('原始圖片 · 固定基準')}</h3>
          <button
            className={s.previewButton}
            disabled={busy || !original}
            onClick={() => show(null)}
          >
            {original ? <img src={original.dataUrl} alt={t('固定原始圖片')} /> : t('載入中…')}
          </button>
          <button
            disabled={busy}
            onClick={() =>
              void run(async () => {
                const r = value(await window.versions.export([asset.id], 'original'));
                if (r)
                  setError(
                    t('匯出 {0}；略過 {1}；失敗 {2} {3}', [
                      r.completed.length,
                      r.skipped.length,
                      r.failed.length,
                      r.failed.map((x) => x.error).join('；'),
                    ]),
                  );
              })
            }
          >
            {t('⇩ 匯出原圖')}
          </button>
        </section>
        <section className={s.previewCard}>
          <h3>{t('目前替換圖片')}</h3>
          <div className={s.currentLayout}>
            <button
              className={s.previewButton}
              disabled={busy || (!active && !state?.deployed)}
              onClick={() => show(active?.id ?? null)}
            >
              {current ? (
                <img src={current.dataUrl} alt={t('目前選用圖片')} />
              ) : state?.deployed && !state.active && original ? (
                <img src={original.dataUrl} alt={t('待套用原圖')} />
              ) : (
                <span>{t('尚未選用替換圖')}</span>
              )}
            </button>
            <div>
              <strong className={active?.id === state?.deployed ? s.success : s.warning}>
                {active
                  ? `V${active.number} · ${active.id === state?.deployed ? t('已套用') : t('待套用')}`
                  : state?.deployed
                    ? t('原圖 · 待套用')
                    : t('尚未選用')}
              </strong>
              <p>
                {t('遊戲：')}
                {deployed ? 'V' + deployed.number : t('尚無工具部署紀錄')}
              </p>
              <p>{t('{0} 筆上傳紀錄', [state?.versions.length ?? 0])}</p>
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
                {t('↥ 上傳替換圖片')}
              </button>
              <button
                disabled={busy || !state?.active}
                onClick={() => setAction({ kind: 'select', id: null })}
              >
                {t('選回原圖')}
              </button>
              {state && state.active !== state.deployed && (
                <button
                  disabled={busy}
                  onClick={() => setAction({ kind: 'cancel', id: state.deployed })}
                >
                  {t('取消待套用')}
                </button>
              )}
              <button
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    const r = value(await window.versions.export([asset.id], 'active'));
                    if (r)
                      setError(
                        t('匯出 {0}；略過 {1}；失敗 {2} {3}', [
                          r.completed.length,
                          r.skipped.length,
                          r.failed.length,
                          r.failed.map((x) => x.error).join('；'),
                        ]),
                      );
                  })
                }
              >
                {t('匯出目前版本')}
              </button>
              <small>{t('無選用時匯出原圖')}</small>
            </div>
          </div>
        </section>
      </div>
      <section className={s.history}>
        <h3>{t('上傳歷史')}</h3>
        {state?.versions.map((v) => (
          <article key={v.id} className={s.historyRow}>
            <strong className={s.success}>V{v.number}</strong>
            <small>{new Date(v.created).toLocaleString(getLocale())}</small>
            <div>
              <strong>{v.name}</strong>
              <small>
                {v.width} × {v.height}
                {v.id === state.active ? t(' · 目前選用') : ''}
                {v.id === state.deployed ? t(' · 已部署') : ''}
              </small>
            </div>
            <button
              className={s.historyThumb}
              aria-label={t('預覽 V{0}', [v.number])}
              disabled={busy}
              onClick={() => show(v.id)}
            >
              <Thumbnail asset={asset} version={v.id} />
            </button>
            <button
              disabled={busy || v.id === state.active}
              onClick={() => setAction({ kind: 'select', id: v.id })}
            >
              {t('✓ 使用此版本')}
            </button>
            <button
              disabled={busy || v.id === state.deployed}
              onClick={() => setAction({ kind: 'remove', id: v.id })}
            >
              {t('刪除紀錄')}
            </button>
          </article>
        ))}
        {!state?.versions.length && <p className={s.blank}>{t('尚無歷史版本')}</p>}
      </section>
      <p role="status" className={s.warning}>
        {busy ? t('處理中…') : error}
      </p>
      {large && <ImageViewer preview={large} close={() => setLarge(null)} />}
      {draft && (
        <Modal
          title={t('上傳替換圖片')}
          busy={busy}
          close={() =>
            void run(async () => {
              value(await window.versions.discard(draft.token));
              setDraft(null);
            })
          }
        >
          <div className={s.image}>
            <img src={draft.preview.dataUrl} alt={t('待匯入圖片')} />
          </div>
          <p>
            {draft.preview.name} · {draft.preview.width} × {draft.preview.height}
          </p>
          {draft.differences.length ? (
            <>
              <h3 className={s.warning}>{t('圖片規格與原圖不同')}</h3>
              {draft.differences.map((d) => (
                <p key={d}>{t(d)}</p>
              ))}
              <label className={s.checkLabel}>
                <input
                  type="checkbox"
                  checked={accepted}
                  disabled={busy}
                  onChange={(e) => setAccepted(e.target.checked)}
                />
                {t('我接受以上差異')}
              </label>
            </>
          ) : (
            <p className={s.success}>{t('✓ 圖片規格一致')}</p>
          )}
          <p>{t('保存為新版本並選用，不會直接寫入遊戲。')}</p>
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
              {t('取消')}
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
              {t('確認匯入')}
            </button>
          </div>
          <p>{error}</p>
        </Modal>
      )}
      {action && (
        <Modal
          title={
            action.kind === 'remove'
              ? t('永久刪除此歷史版本？')
              : action.kind === 'cancel'
                ? t('取消待套用？')
                : action.id
                  ? t('選用此歷史版本？')
                  : t('選回原圖？確認套用前不會修改遊戲')
          }
          busy={busy}
          close={() => setAction(null)}
        >
          <p>
            {action.kind === 'remove'
              ? t('永久刪除此版本圖片與歷史。若目前選用此版本，選用將回到遊戲目前版本。')
              : action.kind === 'cancel'
                ? t('選用回到遊戲目前版本，保留上傳歷史。')
                : t('保留歷史與已部署版本。')}
            {t('此操作不會修改遊戲檔案。')}
          </p>
          <div className={s.modalActions}>
            <button disabled={busy} onClick={() => setAction(null)}>
              {t('取消')}
            </button>
            <button
              className={s.primary}
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  setState(
                    value(
                      action.kind === 'remove'
                        ? await window.versions.remove(asset.id, action.id!, true)
                        : await window.versions.select(asset.id, action.id),
                    ),
                  );
                  setAction(null);
                  changed();
                })
              }
            >
              {t('確認')}
            </button>
          </div>
          <p>{error}</p>
        </Modal>
      )}
    </div>
  );
}
