import { t } from '../shared/i18n';
import React, { useEffect, useState } from 'react';
import type {
  Asset,
  Project,
  VersionState,
  OperationBridge,
  OperationRecord,
  Result,
} from '../shared/contracts';
import s from './workbench.module.css';
import { Icon } from './ui';
declare global {
  interface Window {
    operations: OperationBridge;
  }
}
const unwrap = <T,>(r: Result<T>): T => {
  if (!r.ok) throw Error(r.error);
  return r.value;
};
const labels: Record<string, string> = {
  committed: t('操作完成'),
  recovered: t('已恢復至操作前'),
  cancelled: t('寫入前取消'),
  preparing: t('準備曾中斷'),
  prepared: t('備份完成，操作未結束'),
  applying: t('寫入曾中斷'),
  recovering: t('恢復曾中斷'),
  recovery_failed: t('恢復未完成'),
};
export function OperationPanel({
  project,
  assets,
  kind,
  back,
  online,
  onBusy,
}: {
  project: Project;
  assets: Asset[];
  kind: 'apply' | 'restore';
  back: () => void;
  online: boolean;
  onBusy?: (busy: boolean) => void;
}) {
  const [states, setStates] = useState<Record<string, VersionState>>({}),
    [records, setRecords] = useState<OperationRecord[]>([]),
    [selected, setSelected] = useState<string[]>([]),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    [confirmed, setConfirmed] = useState(false);
  async function reload() {
    const entries = [];
    for (const a of assets.filter((a) => !a.error))
      entries.push([a.id, unwrap(await window.versions.state(a.id))]);
    setStates(Object.fromEntries(entries));
    setRecords(unwrap(await window.operations.list(project.id)));
  }
  useEffect(() => {
    void reload().catch((e) => setMessage(t(String(e))));
  }, [project.id]);
  const unfinished = records.filter(
      (o) => !['committed', 'recovered', 'cancelled'].includes(o.status),
    ),
    rows = assets.filter(
      (a) =>
        states[a.id] &&
        (kind === 'apply' ? states[a.id].active !== states[a.id].deployed : states[a.id].deployed),
    );
  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    onBusy?.(true);
    setMessage(t('檢查備份、外部變更與檔案完整性…'));
    try {
      await fn();
      setMessage(t('操作已完成並保存紀錄'));
    } catch (e) {
      setMessage(t(String(e)));
    } finally {
      await reload().catch((e) => setMessage(t(String(e))));
      setConfirmed(false);
      setBusy(false);
      onBusy?.(false);
    }
  }
  return (
    <main className={`${s.home} ${s.operationPage}`}>
      <button className={s.back} disabled={busy} onClick={back}>
        {t('← 返回工作臺')}
      </button>
      <h1>{kind === 'apply' ? t('套用到遊戲') : t('還原遊戲圖片')}</h1>
      {!online && (
        <p role="alert" className={s.warning}>
          {t('遊戲位置無法驗證，請返回工作臺重新連結。套用／還原已停用。')}
        </p>
      )}
      <p>
        {kind === 'apply'
          ? t('將全部待套用圖片寫入指定遊戲，保留原始備份。')
          : t('將選取的圖片還原為固定原圖，保留替換版本與歷史紀錄。')}
      </p>
      <section className={s.targetCard}>
        <Icon name="image" />
        <div>
          <strong>
            {t('目標遊戲')}
            {project.name}
          </strong>
          <p className={s.path}>
            {t('遊戲位置')}
            {project.root}
          </p>
          <small>{t('請先關閉遊戲與其他修改工具；確認後會檢查備份與外部變更。')}</small>
        </div>
      </section>
      {unfinished.map((o) => (
        <section key={o.id} className={s.recoveryCard}>
          <h2 className={s.warning}>{labels[o.status] || o.status}</h2>
          <p>
            {o.error ? t(o.error) : t('發現未完成操作。確認恢復後，回到該次操作開始前的版本。')}
          </p>
          <button
            className={s.primary}
            disabled={busy || !confirmed || !online}
            onClick={() =>
              void run(async () => unwrap(await window.operations.recover(project.id, o.id, true)))
            }
          >
            {t('確認恢復操作前狀態')}
          </button>
        </section>
      ))}
      <div className={s.pageHeading}>
        <h3>
          {t(kind === 'apply' ? '套用以下 {0} 張圖片' : '還原以下 {0} 張圖片', [rows.length])}
        </h3>
        {kind === 'restore' && (
          <button disabled={busy} onClick={() => setSelected(rows.map((a) => a.id))}>
            {t('全選已部署素材')}
          </button>
        )}
      </div>
      <div className={s.operationTable}>
        <div className={s.operationHead}>
          <span>{t('選取')}</span>
          <span>{t('目前遊戲版本')}</span>
          <span>{kind === 'apply' ? t('目前替換圖片') : t('還原至原圖')}</span>
          <span>{t('版本／狀態')}</span>
        </div>
        {rows.map((a) => {
          const st = states[a.id],
            active = st.versions.find((v) => v.id === st.active),
            deployed = st.versions.find((v) => v.id === st.deployed);
          return (
            <div className={s.operationRow} key={a.id}>
              <input
                type="checkbox"
                aria-label={t('操作 ') + a.path}
                disabled={busy || kind === 'apply'}
                checked={kind === 'apply' || selected.includes(a.id)}
                onChange={(e) =>
                  setSelected((x) =>
                    e.target.checked ? [...x, a.id] : x.filter((id) => id !== a.id),
                  )
                }
              />
              <OperationImage asset={a} version={st.deployed} />
              <OperationImage asset={a} version={kind === 'apply' ? st.active : null} />
              <div>
                <strong className={s.warning}>
                  {deployed ? `V${deployed.number}` : t('原圖')} →{' '}
                  {kind === 'apply' && active ? `V${active.number}` : t('原圖')}
                </strong>
                <small>{t('確認後執行完整性檢查')}</small>
              </div>
            </div>
          );
        })}
        {!rows.length && (
          <p className={s.blank}>
            {t(kind === 'apply' ? '目前沒有待套用素材。' : '目前沒有已部署素材。')}
          </p>
        )}
      </div>
      <div className={s.operationActions}>
        <label className={s.checkLabel}>
          <input
            type="checkbox"
            disabled={busy}
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
          />
          {t('我已確認目標遊戲、圖片差異與寫入範圍')}
        </label>

        
        <button disabled={busy} onClick={back}>
          {t('返回工作臺')}
        </button>
        <button
          className={s.primary}
          disabled={
            busy ||
            !online ||
            (kind === 'apply' && !['ready', 'warnings'].includes(project.status)) ||
            !confirmed ||
            !!unfinished.length ||
            !rows.length ||
            (kind === 'restore' && !selected.length)
          }
          onClick={() =>
            void run(async () =>
              unwrap(await window.operations.execute(project.id, kind, selected, true)),
            )
          }
        >
          {busy
            ? t('處理中，請勿關閉')
            : kind === 'apply'
              ? t('↥ 套用全部待套用圖片')
              : t('↶ 還原選取圖片')}
        </button>
      </div>
      <p role="status">{message}</p>
      <details className={s.operationLog}>
        <summary>{t('操作紀錄（{0}）', [records.length])}</summary>
        {records.map((o) => (
          <p key={o.id}>
            {o.kind === 'apply' ? t('套用') : t('還原')} · {labels[o.status] || o.status} ·{' '}
            {o.items.length}
            {t('張')}
            {o.error && t(o.error)}
          </p>
        ))}
      </details>
    </main>
  );
}
function OperationImage({ asset, version }: { asset: Asset; version: string | null }) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    let alive = true;
    setSrc('');
    void window.versions
      .preview(asset.id, version)
      .then((r) => {
        if (alive && r.ok) setSrc(r.value.dataUrl);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [asset.id, version]);
  return (
    <div className={s.assetCell}>
      <div className={s.image}>
        {src ? <img src={src} alt={asset.path} /> : <Icon name="image" />}
      </div>
      <div>
        <strong>{asset.path.split('/').pop()}</strong>
        <small>
          {asset.width} × {asset.height}
        </small>
      </div>
    </div>
  );
}
