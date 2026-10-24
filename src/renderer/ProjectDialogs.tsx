import { t } from '../shared/i18n';
import React, { useEffect, useState } from 'react';
import type { Asset, CoverChoice, Preview, Project } from '../shared/contracts';
import { Modal, value } from './ui';
import { Thumbnail } from './Thumbnail';
import s from './workbench.module.css';

export function AssetPicker({
  assets,
  excluded = [],
  multiple = true,
  title,
  close,
  submit,
}: {
  assets: Asset[];
  excluded?: string[];
  multiple?: boolean;
  title: string;
  close: () => void;
  submit: (ids: string[]) => Promise<void>;
}) {
  const [search, setSearch] = useState(''),
    [folder, setFolder] = useState(''),
    [selected, setSelected] = useState<string[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const folders = [...new Set(assets.map((a) => a.path.split('/').slice(0, -1).join('/')))];
  const shown = assets.filter(
    (a) =>
      (!folder || a.path.startsWith(folder + '/')) &&
      a.path.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <Modal title={title} close={close} busy={busy}>
      <div className={s.pickerFilters}>
        <input
          aria-label={t('搜尋素材')}
          placeholder={t('搜尋檔名或路徑')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          aria-label={t('原始資料夾')}
          value={folder}
          onChange={(e) => setFolder(e.target.value)}
        >
          <option value="">{t('全部原始資料夾')}</option>
          {folders.map((f) => (
            <option key={f}>{f}</option>
          ))}
        </select>
      </div>
      <div className={s.pickerList}>
        {shown.map((a) => (
          <label className={s.pickerRow} key={a.id}>
            <div style={{display: 'flex', gap: 10}}>

            
            <input
              type={multiple ? 'checkbox' : 'radio'}
              name="asset-picker"
              disabled={busy || !!a.error || excluded.includes(a.id)}
              checked={selected.includes(a.id)}
              onChange={(e) =>
                setSelected((ids) =>
                  !multiple
                    ? [a.id]
                    : e.target.checked
                      ? [...ids, a.id]
                      : ids.filter((id) => id !== a.id),
                )
              }
            />
            <Thumbnail asset={a} />
            <span>
              {a.path}
              <small>
                {excluded.includes(a.id)
                  ? t('已加入群組')
                  : a.error
                    ? t(a.error)
                    : `${a.width} × ${a.height} · PNG`}
              </small>
            </span>
            </div>
          </label>
        ))}
      </div>
      {!shown.length && <p>{t('沒有符合條件的素材')}</p>}
      <p role="alert">{error}</p>
      <div className={s.modalActions}>
        <span>{t('已選 {0} 張', [selected.length])}</span>
        <button disabled={busy} onClick={close}>
          {t('取消')}
        </button>
        <button
          className={s.primary}
          disabled={busy || !selected.length}
          onClick={() => {
            setBusy(true);
            void submit(selected)
              .catch((e) => setError(t(String(e))))
              .finally(() => setBusy(false));
          }}
        >
          {multiple ? t('加入素材') : t('選擇封面')}
        </button>
      </div>
    </Modal>
  );
}

export function ProjectSettings({
  project,
  assets,
  close,
  saved,
}: {
  project: Project;
  assets: Asset[];
  close: () => void;
  saved: (p: Project) => void;
}) {
  const [name, setName] = useState(project.name),
    [cover, setCover] = useState<CoverChoice>({ kind: 'keep' }),
    [preview, setPreview] = useState<Preview | null>(null),
    [picker, setPicker] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  useEffect(() => {
    let alive = true;
    void window.manager
      .cover(project.id)
      .then((r) => {
        if (alive) setPreview(value(r));
      })
      .catch((e) => {
        if (alive) setError(t(String(e)));
      });
    return () => {
      alive = false;
      void window.manager.discardCover();
    };
  }, [project.id]);
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError(t(String(e)));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Modal title={t('專案設定')} busy={busy || picker} close={close}>
        <label>
          {t('專案名稱')}
          <input
            aria-label={t('專案名稱')}
            maxLength={80}
            value={name}
            disabled={busy}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <h3>{t('專案封面')}</h3>
        <div className={s.coverPreview}>
          {preview ? (
            <img src={preview.dataUrl} alt={t('專案封面預覽')} />
          ) : (
            <span>{cover.kind === 'reset' ? t('儲存後使用預設素材封面') : t('尚無封面')}</span>
          )}
        </div>
        <div className={s.pickerFilters}>
          <button disabled={busy} onClick={() => setPicker(true)}>
            {t('從專案素材選擇')}
          </button>
          <button
            disabled={busy}
            onClick={() =>
              void run(async () => {
                const d = value(await window.manager.chooseCover(project.id));
                if (d) {
                  setCover({ kind: 'import', token: d.token });
                  setPreview(d.preview);
                }
              })
            }
          >
            {t('匯入封面圖片')}
          </button>
          <button
            disabled={busy}
            onClick={() => {
              setCover({ kind: 'reset' });
              setPreview(null);
            }}
          >
            {t('恢復預設封面')}
          </button>
        </div>
        <p>{t('封面另存副本，不改動遊戲圖片。支援靜態 PNG。')}</p>
        <h3>{t('遊戲位置')}</h3>
        <p className={s.path}>{project.root}</p>
        <button
          disabled={busy}
          onClick={() =>
            void run(async () => {
              const p = value(await window.manager.relink(project.id));
              if (p) {
                saved(p);
                setError(t('遊戲位置已重新連結並保存'));
              }
            })
          }
        >
          {t('重新連結遊戲位置')}
        </button>
        <p>{t('重新連結會立即保存位置並核對引擎與部署內容，保留原始備份。')}</p>
        <p role="status">{error}</p>
        <div className={s.modalActions}>
          <button disabled={busy} onClick={close}>
            {t('取消')}
          </button>
          <button
            className={s.primary}
            disabled={busy || !name.trim()}
            onClick={() =>
              void run(async () => {
                saved(value(await window.manager.saveProject(project.id, name, cover)));
                close();
              })
            }
          >
            {t('儲存變更')}
          </button>
        </div>
      </Modal>
      {picker && (
        <AssetPicker
          title={t('選擇專案封面')}
          assets={assets}
          multiple={false}
          close={() => setPicker(false)}
          submit={async (ids) => {
            setPreview(value(await window.versions.preview(ids[0], null)));
            setCover({ kind: 'asset', id: ids[0] });
            setPicker(false);
          }}
        />
      )}
    </>
  );
}

export function DeleteProject({
  project,
  close,
  deleted,
}: {
  project: Project;
  close: () => void;
  deleted: () => void;
}) {
  const [confirmed, setConfirmed] = useState(false),
    [abandon, setAbandon] = useState(false),
    [pending, setPending] = useState<boolean | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  useEffect(() => {
    void window.operations
      .list(project.id)
      .then((r) =>
        setPending(
          value(r).some((o) => !['committed', 'recovered', 'cancelled'].includes(o.status)),
        ),
      )
      .catch((e) => setError(t(String(e))));
  }, [project.id]);
  return (
    <Modal title={t('永久刪除專案「{0}」？', [project.name])} close={close} busy={busy}>
      <p className={s.path}>
        {t('遊戲位置：')}
        {project.root}
      </p>
      <p>{t('將刪除此工具保存的原圖備份、替換版本、封面、群組與操作歷史，且無法復原。')}</p>
      <p>
        {t(
          '遊戲資料夾不會被刪除，已套用的圖片將維持現狀。刪除後，無法再透過本專案還原原圖。尚未套用的變更將一併刪除。',
        )}
      </p>
      <label className={s.checkLabel}>
        <input
          type="checkbox"
          checked={confirmed}
          disabled={busy}
          onChange={(e) => setConfirmed(e.target.checked)}
        />
        {t('我了解將失去原圖備份與還原能力')}
      </label>
      {pending && (
        <label className={`${s.checkLabel} ${s.warning}`}>
          <input
            type="checkbox"
            disabled={busy}
            checked={abandon}
            onChange={(e) => setAbandon(e.target.checked)}
          />
          {t('此專案有未完成恢復；我確認放棄恢復，遊戲可能處於部分套用狀態')}
        </label>
      )}
      <p role="alert">{error}</p>
      <div className={s.modalActions}>
        <button disabled={busy} onClick={close}>
          {t('取消')}
        </button>
        <button
          className={s.danger}
          disabled={busy || pending === null || !confirmed || (!!pending && !abandon)}
          onClick={() => {
            setBusy(true);
            void window.manager
              .deleteProject(project.id, confirmed, abandon)
              .then((r) => {
                value(r);
                try {
                  localStorage.removeItem(`sidebar:${project.id}`);
                } catch {}
                deleted();
              })
              .catch((e) => setError(t('清理未完成，可重試：{0}', [String(e)])))
              .finally(() => setBusy(false));
          }}
        >
          {busy ? t('清理中…') : t('永久刪除')}
        </button>
      </div>
    </Modal>
  );
}
