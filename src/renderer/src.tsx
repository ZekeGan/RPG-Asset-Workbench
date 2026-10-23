import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { Bridge, Preview, Snapshot } from '../shared/contracts';
import styles from './style.module.css';
import Workbench from './Workbench';
declare global {
  interface Window {
    poc: Bridge;
  }
}
function App() {
  const [note, setNote] = useState(''),
    [snapshot, setSnapshot] = useState<Snapshot | null>(null),
    [preview, setPreview] = useState<Preview | null>(null),
    [message, setMessage] = useState('載入中…'),
    [busy, setBusy] = useState(false),
    [failed, setFailed] = useState(false);
  async function load() {
    setBusy(true);
    try {
      const r = await window.poc.load();
      if (!r.ok) throw Error(r.error);
      setSnapshot(r.value);
      setNote(r.value.note);
      setFailed(false);
      setMessage('資料已讀取');
    } catch (e) {
      setFailed(true);
      setMessage(String(e));
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  async function save() {
    setBusy(true);
    try {
      const r = await window.poc.save(note);
      if (!r.ok) throw Error(r.error);
      setSnapshot(r.value);
      setFailed(false);
      setMessage('已保存至 SQLite；可關閉並重啟驗證');
    } catch (e) {
      setFailed(true);
      setMessage('保存失敗，請重試：' + String(e));
    } finally {
      setBusy(false);
    }
  }
  async function choose() {
    setBusy(true);
    setPreview(null);
    try {
      const r = await window.poc.choosePng();
      if (!r.ok) throw Error(r.error);
      setPreview(r.value);
      setMessage(r.value ? '靜態 PNG 完整解碼成功；來源檔未修改' : '已取消選檔');
    } catch (e) {
      setMessage('檢查未通過：' + String(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className={styles.app}>
      <header>
        <div>
          <small>RPG IMAGE TOOL · POC-03</small>
          <h1>桌面環境驗證</h1>
        </div>
        <span className={styles.badge}>0.1.0 · 技術測試</span>
      </header>
      <p>驗證本機保存與靜態 PNG。此頁為診斷工具，不是正式素材工作臺。</p>
      <div className={styles.grid}>
        <section>
          <h2>01 / 重啟保存驗證</h2>
          <label htmlFor="note">測試文字（最多 2000 字）</label>
          <textarea
            id="note"
            maxLength={2000}
            value={note}
            disabled={busy || failed}
            onChange={(e) => setNote(e.target.value)}
          />
          <button disabled={busy || !snapshot} onClick={save}>
            {failed ? '重試保存' : '保存測試文字'}
          </button>
          {!snapshot && (
            <button disabled={busy} onClick={load}>
              重試載入
            </button>
          )}
          <p>保存後關閉程式，再開啟確認文字一致。</p>
          {snapshot && (
            <dl>
              <dt>資料庫</dt>
              <dd>{snapshot.database}</dd>
              <dt>最後保存</dt>
              <dd>{snapshot.updatedAt ?? '尚未保存'}</dd>
              <dt>SQLite 設定</dt>
              <dd>
                {snapshot.settings.journal} / FULL={snapshot.settings.synchronous} / FK=
                {snapshot.settings.foreignKeys}
              </dd>
            </dl>
          )}
        </section>
        <section>
          <h2>02 / 圖片解碼驗證</h2>
          <button disabled={busy || failed} onClick={choose}>
            選擇靜態 PNG
          </button>
          <p>PoC 暫定上限：32 MiB、16,777,216 像素。APNG、其他格式及損毀圖片會阻擋。</p>
          <div className={styles.preview}>
            {preview ? (
              <img src={preview.dataUrl} alt={preview.name} />
            ) : (
              <span>選取圖片後在此預覽</span>
            )}
          </div>
          {preview && (
            <dl>
              <dt>檔名 / 尺寸</dt>
              <dd>
                {preview.name} · {preview.width} × {preview.height}
              </dd>
              <dt>透明資訊</dt>
              <dd>{preview.hasAlpha ? '有透明能力' : '無透明通道'}</dd>
              <dt>來源 SHA-256</dt>
              <dd>{preview.sha256}</dd>
            </dl>
          )}
        </section>
      </div>
      <footer role="status">{busy ? '處理中…' : message}</footer>
      <p>尚未提供遊戲掃描、匯入版本、套用或還原。測試文字需按保存；不是正式專案自動儲存功能。</p>
    </main>
  );
}
function Root() {
  const [diagnostics, setDiagnostics] = useState(false);
  return diagnostics ? (
    <>
      <button onClick={() => setDiagnostics(false)}>返回專案首頁</button>
      <App />
    </>
  ) : (
    <Workbench diagnostics={() => setDiagnostics(true)} />
  );
}
createRoot(document.getElementById('root')!).render(<Root />);
