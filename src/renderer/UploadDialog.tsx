import { t } from '../shared/i18n';
import React, { useState } from 'react';
import type { Asset, ImportDraft } from '../shared/contracts';
import { Modal, value } from './ui';
import s from './workbench.module.css';
export function UploadDialog({
  asset,
  draft,
  close,
  done,
  onBusy,
}: {
  asset: Asset;
  draft: ImportDraft;
  close: () => void;
  done: () => Promise<void>;
  onBusy: (busy: boolean) => void;
}) {
  const [accepted, setAccepted] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  async function run(commit: boolean) {
    setBusy(true);
    onBusy(true);
    setError('');
    try {
      if (commit) {
        value(await window.versions.commit(draft.token, accepted));
        await done();
      } else value(await window.versions.discard(draft.token));
      close();
    } catch (e) {
      setError(t(String(e)));
    } finally {
      setBusy(false);
      onBusy(false);
    }
  }
  return (
    <Modal title={t('上傳替換圖片')} busy={busy} close={() => void run(false)}>
      <p className={s.path}>{asset.path}</p>
      <div className={s.image}>
        <img src={draft.preview.dataUrl} alt={t('待匯入圖片')} />
      </div>
      <p>
        {draft.preview.name} · {draft.preview.width} × {draft.preview.height}
      </p>
      {!!draft.differences.length && (
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
      )}
      <p>{t('保存為新版本並選用，不會直接寫入遊戲。')}</p>
      <p role="alert">{error}</p>
      <div className={s.modalActions}>
        <button disabled={busy} onClick={() => void run(false)}>
          {t('取消')}
        </button>
        <button
          className={s.primary}
          disabled={busy || (!!draft.differences.length && !accepted)}
          onClick={() => void run(true)}
        >
          {t('確認匯入')}
        </button>
      </div>
    </Modal>
  );
}
