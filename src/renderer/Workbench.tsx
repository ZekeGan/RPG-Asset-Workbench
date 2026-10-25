import { t } from '../shared/i18n';
import React, { useEffect, useRef, useState } from 'react';
import type {
  Asset,
  BatchFile,
  CatalogBridge,
  Group,
  Project,
  ProjectDraft,
  ScanProgress,
  ScanPlan,
  VersionState,
  ImportDraft,
  Preview,
} from '../shared/contracts';
import s from './workbench.module.css';
import { VersionPanel } from './VersionPanel';
import { OperationPanel } from './OperationPanel';
import { BatchPanel } from './BatchPanel';
import { Icon, Modal, ImageViewer, value } from './ui';
import { UploadDialog } from './UploadDialog';
import { LocaleSelect } from './LocaleSelect';
import { version as appVersion } from '../../package.json';
import { Thumbnail } from './Thumbnail';
import { AssetPicker, ProjectSettings, DeleteProject } from './ProjectDialogs';
import { Sidebar } from './Sidebar';
declare global {
  interface Window {
    catalog: CatalogBridge;
  }
}
function ProjectCover({ project }: { project: Project }) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    let alive = true;
    void (async () => {
      const preview = value(await window.manager.cover(project.id));
      if (alive) setSrc(preview?.dataUrl || '');
    })().catch(() => {});
    return () => {
      alive = false;
    };
  }, [project]);
  return (
    <div className={s.cover}>
      {src ? <img src={src} alt={project.name + t(' 專案封面')} /> : <Icon name="image" />}
      <span>{project.engine}</span>
    </div>
  );
}
const labels: Record<string, string> = {
  deleting: t('清理未完成，請重試刪除'),
  ready: t('掃描完成'),
  warnings: t('有注意事項'),
  cancelled: t('掃描已取消'),
  interrupted: t('掃描曾中斷'),
  failed: t('掃描失敗'),
  scanning: t('掃描中'),
};
export default function Workbench() {
  const [large, setLarge] = useState<Preview | null>(null),
    [upload, setUpload] = useState<{ asset: Asset; draft: ImportDraft } | null>(null);
  const [deleting, setDeleting] = useState<Project | null>(null),
    [addingAssets, setAddingAssets] = useState(false),
    [quick, setQuick] = useState<{
      asset: Asset;
      kind: 'cancel' | 'remove';
      version: string | null;
    } | null>(null);
  const [storage, setStorage] = useState<{ blocked: boolean; error: string | null }>({
    blocked: false,
    error: null,
  });
  useEffect(() => {
    let alive = true;
    const check = () =>
      void window.manager
        .storage()
        .then((r) => {
          if (alive && r.ok) setStorage(r.value);
        })
        .catch(() => {});
    check();
    const timer = setInterval(check, 1500);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);
  const [projects, setProjects] = useState<Project[]>([]),
    [project, setProject] = useState<Project | null>(null),
    [assets, setAssets] = useState<Asset[]>([]),
    [states, setStates] = useState<Record<string, VersionState>>({}),
    [groups, setGroups] = useState<Group[]>([]),
    [message, setMessage] = useState(t('載入專案…')),
    [busy, setBusy] = useState(false),
    [progress, setProgress] = useState<ScanProgress | null>(null);
  const [candidate, setCandidate] = useState<ProjectDraft | null>(null);
  const [batchFiles, setBatchFiles] = useState<BatchFile[] | null>(null);
  const [batchBusy, setBatchBusy] = useState(false);
  const [childBusy, setChildBusy] = useState(false);
  const [availability, setAvailability] = useState<{ online: boolean; error: string | null }>({
    online: false,
    error: null,
  });
  const [scanPlan, setScanPlan] = useState<ScanPlan | null>(null);
  useEffect(() => {
    if (!project) return;
    let alive = true;
    const check = () =>
      void window.catalog
        .availability(project.id)
        .then((r) => {
          if (alive && r.ok) setAvailability(r.value);
        })
        .catch(() => {
          if (alive) setAvailability({ online: false, error: t('無法檢查遊戲位置') });
        });
    check();
    const timer = setInterval(check, 5000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [project?.id, project?.root]);
  const [creating, setCreating] = useState(false),
    [name, setName] = useState(''),
    [confirmed, setConfirmed] = useState(false),
    [search, setSearch] = useState(''),
    [folder, setFolder] = useState(''),
    [group, setGroup] = useState(''),
    [status, setStatus] = useState('all'),
    [background, setBackground] = useState('checker'),
    [color, setColor] = useState('#657080'),
    [page, setPage] = useState(0),
    [detail, setDetail] = useState<Asset | null>(null),
    [operation, setOperation] = useState<'apply' | 'restore' | null>(null),
    [selected, setSelected] = useState<string[]>([]),
    [collapsed, setCollapsed] = useState(false);
  const [exporting, setExporting] = useState(false),
    [exportScope, setExportScope] = useState('current'),
    [exportSource, setExportSource] = useState<'original' | 'active'>('original'),
    [batch, setBatch] = useState(false),
    [settings, setSettings] = useState(false),
    [groupAction, setGroupAction] = useState<
      'create' | 'rename' | 'add' | 'remove' | 'delete' | null
    >(null),
    [groupName, setGroupName] = useState(''),
    [targetGroup, setTargetGroup] = useState('');
  const request = useRef(0),
    list = useRef<HTMLDivElement>(null),
    scroll = useRef(0);
  async function refresh() {
    setProjects(value(await window.catalog.projects()));
  }
  async function refreshData(id = project?.id) {
    if (!id) return;
    const [a, g, v] = await Promise.all([
      window.catalog.assets(id),
      window.manager.groups(id),
      window.manager.states(id),
    ]);
    setAssets(value(a));
    setGroups(value(g));
    setStates(value(v));
  }
  useEffect(() => {
    void refresh()
      .then(() => setMessage(t('專案清單已讀取')))
      .catch((e) => setMessage(t(String(e))));
  }, []);
  useEffect(() => {
    if (!busy) return;
    const timer = setInterval(() => {
      void window.catalog.progress().then((r) => {
        if (r.ok) setProgress(r.value);
      });
    }, 400);
    return () => clearInterval(timer);
  }, [busy]);
  useEffect(() => {
    setPage(0);
    setSelected([]);
    scroll.current = 0;
  }, [search, folder, group, status, project?.id]);
  useEffect(() => {
    if (!detail && !operation && list.current) list.current.scrollTop = scroll.current;
  }, [detail, operation, batch]);
  async function openProject(p: Project) {
    const n = ++request.current;
    setBusy(true);
    setDetail(null);
    setOperation(null);
    setProject(p);
    setAvailability({ online: false, error: null });
    setScanPlan(null);
    setAssets([]);
    setStates({});
    setGroups([]);
    setFolder('');
    setGroup('');
    setSearch('');
    setStatus('all');
    try {
      await refreshData(p.id);
      if (n === request.current) {
        const records = value(await window.operations.list(p.id));
        if (records.some((o) => !['committed', 'recovered', 'cancelled'].includes(o.status))) {
          setOperation('apply');
          setMessage(t('發現未完成操作，請確認恢復'));
        } else setMessage(t('專案資料已讀取'));
      }
    } catch (e) {
      setMessage(t(String(e)));
    } finally {
      setBusy(false);
    }
  }
  async function create() {
    if (!candidate) return;
    setBusy(true);
    setMessage(t('建立原始備份…'));
    try {
      const p = value(await window.catalog.create(candidate.token, name, confirmed));
      await refresh();
      if (p) {
        setCreating(false);
        await openProject(p);
        setMessage(labels[p.status] + t(' · 原始基準已保存'));
      } else setMessage(t('已取消選擇資料夾'));
    } catch (e) {
      setCandidate(null);
      setMessage(t(String(e)));
      await refresh();
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }
  const currentGroup = groups.find((g) => g.id === group);
  const filtered = assets.filter((a) => {
    const st = states[a.id],
      active = st?.versions.find((v) => v.id === st.active),
      warning = !!a.error || (!!active && active.differences !== '[]');
    return (
      (!folder || a.path.startsWith(folder + '/')) &&
      (!group || currentGroup?.assetIds.includes(a.id)) &&
      a.path.toLowerCase().includes(search.toLowerCase()) &&
      (status === 'all' ||
        (status === 'pending' && !!st && st.active !== st.deployed) ||
        (status === 'warnings' && warning) ||
        (status === 'empty' && !st?.active) ||
        (status === 'deployed' && !!st?.deployed))
    );
  });
  const shown = filtered.slice(page * 30, page * 30 + 30),
    eligible = filtered.filter((a) => !a.error),
    allSelected = eligible.length > 0 && eligible.every((a) => selected.includes(a.id));
  const remember = () => {
    scroll.current = list.current?.scrollTop ?? scroll.current;
  };
  const locked =
    busy ||
    childBusy ||
    !!operation ||
    batch ||
    batchBusy ||
    !!upload ||
    !!large ||
    storage.blocked;
  async function openImage(asset: Asset, version: string | null) {
    setBusy(true);
    try {
      const p = value(await window.manager.fullPreview(asset.id, version));
      const state = states[asset.id],
        v = state?.versions.find((v) => v.id === version);
      setLarge({
        ...p,
        name: `${asset.path} · ${v ? `V${v.number}` : t('原圖')} · ${state?.deployed === version ? t('遊戲目前版本') : t('預覽版本')}`,
      });
    } catch (e) {
      setMessage(t(String(e)));
    } finally {
      setBusy(false);
    }
  }
  function dropReplacement(e: React.DragEvent, asset: Asset) {
    const files = Array.from(e.dataTransfer.files);
    if (files.length !== 1) return; // Multiple files bubble to the batch workflow.
    e.preventDefault();
    e.stopPropagation();
    if (locked || settings || groupAction || addingAssets || quick || asset.error) return;
    setBusy(true);
    void window.versions
      .drop(asset.id, files)
      .then((r) => setUpload({ asset, draft: value(r) }))
      .catch((e) => setMessage(t(String(e))))
      .finally(() => setBusy(false));
  }
  async function prepareScan() {
    if (!project) return;
    setBusy(true);
    try {
      setScanPlan(value(await window.catalog.scanPlan(project.id)));
    } catch (e) {
      setMessage(t(String(e)));
    } finally {
      setBusy(false);
    }
  }
  async function groupSubmit() {
    if (!project) return;
    setBusy(true);
    try {
      if (groupAction === 'create') {
        setGroups(value(await window.manager.createGroup(project.id, groupName)));
      } else if (groupAction === 'rename') {
        setGroups(value(await window.manager.renameGroup(project.id, group, groupName)));
      } else {
        const id = groupAction === 'add' ? targetGroup : group;
        if (!id) throw Error(t('請選擇群組'));
        setGroups(value(await window.manager.changeGroup(project.id, id, groupAction!, selected)));
        if (groupAction === 'delete') setGroup('');
      }
      setGroupAction(null);
      setMessage(t('群組變更已保存'));
    } catch (e) {
      setMessage(t(String(e)));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div
      className={s.app}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        if (
          !project ||
          detail ||
          operation ||
          batch ||
          settings ||
          groupAction ||
          addingAssets ||
          quick ||
          upload ||
          large ||
          busy ||
          storage.blocked
        )
          return;
        const files = Array.from(e.dataTransfer.files);
        if (!files.length) return;
        if (files.length === 1) {
          setMessage(t('請將單張圖片拖到目標素材的目前替換圖片欄'));
          return;
        }
        setBusy(true);
        void window.manager
          .dropBatch(project.id, files)
          .then((r) => {
            setBatchFiles(value(r));
            remember();
            setBatch(true);
          })
          .catch((e) => setMessage(t(String(e))))
          .finally(() => setBusy(false));
      }}
    >
      <header className={s.top}>
        <div className={s.brand} title="RPG Asset Workbench">
          <img
            src={new URL('../../resources/icon.png', import.meta.url).href}
            width="28"
            height="28"
            alt=""
          />
          <strong>R-aW</strong>
        </div>
        {project && (
          <>
            <button
              disabled={busy || childBusy || batch || batchBusy || storage.blocked}
              onClick={() => {
                setProject(null);
                setDetail(null);
                setOperation(null);
              }}
            >
              {t('← 專案首頁')}
            </button>
            <span className={s.projectName} title={project.name}>
              {project.name}
            </span>
          </>
        )}{' '}
        <span className={s.version}>{appVersion}</span>
        <div className={s.topActions}>
          {!project && !creating && <LocaleSelect />}
          <span className={s.saveState}>{busy ? t('處理中…') : t('本機專案')}</span>
          {project ? (
            <>
              <button disabled={locked || !availability.online} onClick={() => void prepareScan()}>
                {['ready', 'warnings'].includes(project.status)
                  ? t('重新掃描新增素材')
                  : t('繼續掃描')}
              </button>
              <button disabled={locked} onClick={() => setSettings(true)}>
                <Icon name="settings" />
                {t('專案設定')}
              </button>
              <button
                disabled={locked || !availability.online}
                onClick={() => {
                  remember();
                  setDetail(null);
                  setOperation('restore');
                }}
              >
                {t('↶ 還原遊戲')}
              </button>
              <button
                className={s.primary}
                disabled={
                  locked || !availability.online || !['ready', 'warnings'].includes(project.status)
                }
                onClick={() => {
                  remember();
                  setDetail(null);
                  setOperation('apply');
                }}
              >
                <Icon name="upload" />
                {t('套用到遊戲')}
              </button>
            </>
          ) : null}
        </div>
      </header>
      {storage.blocked && (
        <div className={s.storageError} role="alert">
          <strong>{t('儲存失敗，修改已鎖定')}</strong>
          <span>{storage.error && t(storage.error)}</span>
          <button
            disabled={busy}
            onClick={() =>
              void (async () => {
                setBusy(true);
                try {
                  setStorage(value(await window.manager.retryStorage()));
                  setMessage(t('儲存檢查已通過'));
                } catch (e) {
                  setMessage(t(String(e)));
                } finally {
                  setBusy(false);
                }
              })()
            }
          >
            {t('重試儲存檢查')}
          </button>
        </div>
      )}
      {creating ? (
        <main className={s.home}>
          <button className={s.back} disabled={busy} onClick={() => setCreating(false)}>
            {t('← 返回專案清單')}
          </button>
          <div className={s.createPage}>
            <h1>{t('建立新遊戲專案')}</h1>
            <p>{t('選擇遊戲資料夾，將圖片保存為固定原始基準。')}</p>
            <section className={s.createCard}>
              <label>
                {t('專案名稱')}
                <input
                  aria-label={t('專案名稱')}
                  maxLength={100}
                  disabled={busy}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('留空則使用遊戲名稱')}
                />
              </label>
              <label>{t('遊戲資料夾')}</label>
              <div className={s.folderPicker}>
                <span className={s.path}>{candidate?.root || t('尚未選擇遊戲資料夾')}</span>
                <button
                  disabled={busy || storage.blocked}
                  onClick={() =>
                    void (async () => {
                      setBusy(true);
                      setCandidate(null);
                      setConfirmed(false);
                      try {
                        const result = value(await window.catalog.choose());
                        setCandidate(result);
                        setMessage(
                          result ? t('遊戲辨識完成，請確認來源後建立專案') : t('已取消選擇資料夾'),
                        );
                      } catch (e) {
                        setMessage(t(String(e)));
                      } finally {
                        setBusy(false);
                      }
                    })()
                  }
                >
                  {t('選擇資料夾')}
                </button>
              </div>
              {candidate && (
                <div className={s.detected}>
                  <strong>
                    {t('✓ 已辨識 RPG Maker')}
                    {candidate.engine}
                  </strong>
                  <p>
                    {candidate.name} · {candidate.encrypted ? t('標準加密圖片') : t('未加密圖片')}
                  </p>
                </div>
              )}
              <div className={s.notice}>
                {t(
                  '建立後會保存原始圖片備份。請使用乾淨的遊戲測試副本；原始基準不會因後續替換而更新。',
                )}
              </div>
              <label style={{ display: 'flex', gap: '8px', justifyItems: 'center' }}>
                <input
                  type="checkbox"
                  checked={confirmed}
                  disabled={busy || !candidate}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />

                {t('我確認這是未修改的遊戲來源')}
              </label>
              <div className={s.modalActions}>
                <button disabled={busy} onClick={() => setCreating(false)}>
                  {t('取消')}
                </button>
                <button
                  className={s.primary}
                  disabled={busy || storage.blocked || !candidate || !confirmed}
                  onClick={() => void create()}
                >
                  {t('建立專案')}
                </button>
              </div>
              {busy && progress?.running && (
                <p>
                  {t('掃描中…')}
                  {progress.processed}
                  {t('筆')}{' '}
                  <button onClick={() => void window.catalog.cancel()}>{t('取消掃描')}</button>
                </p>
              )}
              <p role="status">{message}</p>
            </section>
          </div>
        </main>
      ) : !project ? (
        <main className={s.home}>
          <div className={s.pageHeading}>
            <div>
              <h1>{t('遊戲專案')}</h1>
              <p>{t('RPG Asset Workbench · RPG Maker 圖片素材管理工具')}</p>
            </div>
            <button
              className={s.primary}
              disabled={busy}
              onClick={() => {
                setName('');
                setConfirmed(false);
                setCandidate(null);
                setMessage(t('選擇遊戲資料夾以辨識引擎'));
                setCreating(true);
              }}
            >
              {t('＋ 建立專案')}
            </button>
          </div>
          <div className={s.cards}>
            {projects.map((p) => (
              <section className={s.card} key={p.id}>
                <ProjectCover project={p} />
                <h2>{p.name}</h2>
                <p title={p.root}>
                  <Icon name="folder" />
                  {p.root}
                </p>
                <small>{labels[p.status]}</small>
                <div className={s.cardActions}>
                  <button
                    className={s.primary}
                    disabled={busy || p.status === 'deleting'}
                    onClick={() => void openProject(p)}
                  >
                    {t('開啟專案 →')}
                  </button>
                  <button
                    className={s.danger}
                    disabled={busy || storage.blocked}
                    onClick={() => setDeleting(p)}
                  >
                    {p.status === 'deleting' ? t('重試刪除') : t('刪除專案')}
                  </button>
                </div>
              </section>
            ))}
          </div>
          {!projects.length && (
            <div className={s.blank}>{t('尚無遊戲專案。建立專案後即可管理素材。')}</div>
          )}
        </main>
      ) : operation ? (
        <OperationPanel
          onBusy={setChildBusy}
          key={project.id + operation}
          project={project}
          assets={assets}
          kind={operation}
          online={availability.online}
          back={() => {
            setOperation(null);
            void refreshData();
          }}
        />
      ) : detail ? (
        <main className={s.home}>
          <button
            className={s.back}
            disabled={childBusy}
            onClick={() => {
              setDetail(null);
              void refreshData();
            }}
          >
            {t('← 返回列表')}
          </button>
          {detail.error ? (
            <>
              <h1>{detail.path}</h1>
              <p className={s.warning}>{t(detail.error)}</p>
            </>
          ) : (
            <VersionPanel
              key={detail.id}
              asset={detail}
              onBusy={setChildBusy}
              changed={() => void refreshData()}
            />
          )}
        </main>
      ) : (
        <div className={s.shell}>
          <aside className={s.sidebar}>
            <Sidebar
              key={project.id}
              projectId={project.id}
              assets={assets}
              groups={groups}
              folder={folder}
              group={group}
              choose={(f, g) => {
                setFolder(f);
                setGroup(g);
              }}
              create={() => {
                setGroupName('');
                setGroupAction('create');
              }}
            />{' '}
            <div className={s.sideBottom}>
              <small>
                {project.engine} · {labels[project.status]}
              </small>
            </div>
          </aside>
          {batch ? (
            <BatchPanel
              projectId={project.id}
              assets={assets}
              initialFiles={batchFiles}
              onBusy={setBatchBusy}
              close={() => {
                setBatch(false);
                setBatchBusy(false);
                setBatchFiles(null);
              }}
              done={() => void refreshData()}
            />
          ) : (
            <main className={s.work}>
              <div style={{ marginBottom: '8px' }}>
                {!availability.online && (
                  <section role="alert" className={s.warning}>
                    <p>
                      {availability.error ? t(availability.error) : t('正在檢查遊戲位置…')}
                      {t('工具內已保存的圖片仍可查看。')}
                    </p>
                    <button disabled={busy} onClick={() => setSettings(true)}>
                      {t('重新連結遊戲位置')}
                    </button>
                  </section>
                )}
                {!['ready', 'warnings'].includes(project.status) && (
                  <section role="status" className={s.warning}>
                    {t('已保留掃描結果，可稍後繼續；目前尚無法套用到遊戲。')}
                  </section>
                )}
              </div>
              <div className={s.workHeading}>
                <div>
                  <small>
                    {t('素材工作臺 ／')}
                    {group ? t('自訂群組') : t('原始資料夾')}
                  </small>
                  <h1>
                    {currentGroup?.name || folder.replace(/^img\//, '') || t('全部素材')}{' '}
                    <span>{t('{0} 張素材', [filtered.length])}</span>
                  </h1>
                </div>
                <div className={s.headingActions}>
                  {group && (
                    <>
                      <button
                        disabled={busy || storage.blocked}
                        onClick={() => setAddingAssets(true)}
                      >
                        {t('＋ 新增素材')}
                      </button>
                      <button
                        disabled={busy || storage.blocked}
                        onClick={() => {
                          setGroupName(currentGroup?.name || '');
                          setGroupAction('rename');
                        }}
                      >
                        {t('重新命名群組')}
                      </button>
                      <button onClick={() => setGroupAction('delete')}>
                        {t('群組選單 · 刪除')}
                      </button>
                    </>
                  )}
                  <button
                    aria-expanded={!collapsed}
                    aria-controls="workbench-toolbar"
                    onClick={() => setCollapsed((c) => !c)}
                  >
                    {collapsed ? t('⌄ 展開工具列') : t('⌃ 收合工具列')}
                  </button>
                </div>
              </div>
              {!collapsed && (
                <div id="workbench-toolbar" className={s.toolbar}>
                  <input
                    aria-label={t('搜尋檔名')}
                    placeholder={t('⌕  搜尋檔名…')}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  <select
                    aria-label={t('狀態篩選')}
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                  >
                    <option value="all">{t('全部狀態')}</option>
                    <option value="pending">{t('待套用')}</option>
                    <option value="warnings">{t('有注意事項')}</option>
                    <option value="empty">{t('尚未替換')}</option>
                    <option value="deployed">{t('已套用')}</option>
                  </select>
                  <select
                    aria-label={t('預覽背景')}
                    value={background}
                    onChange={(e) => setBackground(e.target.value)}
                  >
                    <option value="checker">{t('棋盤格')}</option>
                    <option value="white">{t('白色')}</option>
                    <option value="black">{t('黑色')}</option>
                    <option value="custom">{t('自訂')}</option>
                  </select>
                  {background === 'custom' && (
                    <input
                      type="color"
                      aria-label={t('自訂背景色')}
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                    />
                  )}
                  <div className={s.toolbarRight}>
                    <button className={s.primary} onClick={() => setBatch(true)}>
                      <Icon name="upload" />
                      {t('批量匯入圖片')}
                    </button>
                    <button
                      onClick={() => {
                        setExportScope(selected.length ? 'selected' : 'current');
                        setExporting(true);
                      }}
                    >
                      {t('⇩ 匯出')}
                    </button>
                  </div>
                </div>
              )}
              <div className={s.selectionBar}>
                <label>
                  <input
                    type="checkbox"
                    aria-label={t('全選目前篩選結果')}
                    checked={allSelected}
                    onChange={(e) => setSelected(e.target.checked ? eligible.map((a) => a.id) : [])}
                  />
                  {t('已選 {0} 張', [selected.length])}
                </label>
                <div>
                  <button
                    disabled={!selected.length || !groups.length}
                    onClick={() => {
                      setTargetGroup(group || groups[0]?.id || '');
                      setGroupAction('add');
                    }}
                  >
                    {t('加入群組')}
                  </button>
                  {group && (
                    <button disabled={!selected.length} onClick={() => setGroupAction('remove')}>
                      {t('從目前群組移除')}
                    </button>
                  )}
                  {collapsed && (
                    <button
                      onClick={() => {
                        setExportScope(selected.length ? 'selected' : 'current');
                        setExporting(true);
                      }}
                    >
                      {t('匯出')}
                    </button>
                  )}
                </div>
              </div>
              <div className={s.tableHeader}>
                <span />
                <span>{t('原始圖片 · 固定基準')}</span>
                <span>{t('目前替換圖片')}</span>
                <span>{t('操作')}</span>
              </div>
              <div
                ref={list}
                className={s.list}
                data-testid="asset-list"
                data-bg={background}
                style={{ '--preview-color': color } as React.CSSProperties}
              >
                {shown.map((a) => {
                  const st = states[a.id],
                    v = st?.versions.find((v) => v.id === st.active),
                    deployed = st?.versions.find((v) => v.id === st.deployed);
                  return (
                    <article key={a.id} className={s.row}>
                      <input
                        type="checkbox"
                        aria-label={t('選取 ') + a.path}
                        disabled={!!a.error}
                        checked={selected.includes(a.id)}
                        onChange={(e) =>
                          setSelected((ids) =>
                            e.target.checked ? [...ids, a.id] : ids.filter((id) => id !== a.id),
                          )
                        }
                      />
                      <div className={s.assetCell}>
                        <Thumbnail asset={a} onOpen={() => void openImage(a, null)} />
                        <div>
                          <strong>{a.path.split('/').pop()}</strong>
                          <small>{a.error ? t(a.error) : `${a.width} × ${a.height} · PNG`}</small>
                          <small className={s.assetPath}>{a.path}</small>
                        </div>
                      </div>
                      <div
                        className={s.replacementDrop}
                        data-drop-asset={a.id}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => dropReplacement(e, a)}
                      >
                        {v ? (
                          <div className={s.assetCell}>
                            <Thumbnail
                              asset={a}
                              version={v.id}
                              onOpen={() => void openImage(a, v.id)}
                            />
                            <div>
                              <strong className={v.id === st.deployed ? s.success : s.warning}>
                                V{v.number} · {v.id === st.deployed ? t('已套用') : t('待套用')}
                              </strong>
                              <small className={v.differences === '[]' ? s.success : s.warning}>
                                {v.differences === '[]'
                                  ? t('✓ 圖片規格一致')
                                  : t('⚠ 已接受圖片差異')}
                              </small>
                              <small>
                                {t('遊戲')}
                                {deployed ? 'V' + deployed.number : t('原圖')}
                                {t('→ 選用 V')}
                                {v.number}
                              </small>
                              <small>{t('{0} 筆上傳紀錄', [st.versions.length])}</small>
                            </div>
                          </div>
                        ) : deployed ? (
                          <div className={s.assetCell}>
                            <Thumbnail asset={a} onOpen={() => void openImage(a, null)} />
                            <div>
                              <strong className={s.warning}>{t('原圖 · 待套用')}</strong>
                              <small>
                                {t('遊戲 V')}
                                {deployed.number}
                                {t('→ 原圖')}
                              </small>
                            </div>
                          </div>
                        ) : (
                          <div className={s.empty}>
                            <Icon name="image" />
                            <span>{t('尚未選用')}</span>
                            <small>{t('無替換版本')}</small>
                          </div>
                        )}
                      </div>
                      <div className={s.rowActions}>
                        <button
                          onClick={() => {
                            remember();
                            setDetail(a);
                          }}
                        >
                          {t('詳細內容 →')}
                        </button>
                        {st && st.active !== st.deployed && (
                          <>
                            <button
                              disabled={busy || storage.blocked}
                              onClick={() =>
                                setQuick({ asset: a, kind: 'cancel', version: st.deployed })
                              }
                            >
                              {t('取消待套用')}
                            </button>
                            {v && (
                              <button
                                className={s.danger}
                                disabled={busy || storage.blocked}
                                onClick={() =>
                                  setQuick({ asset: a, kind: 'remove', version: v.id })
                                }
                              >
                                {t('刪除版本')}
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </article>
                  );
                })}
                {!shown.length && <div className={s.blank}>{t('目前範圍沒有素材')}</div>}
              </div>
              <div className={s.pager}>
                <span>{t('顯示 {0} / {1} 張素材', [shown.length, filtered.length])}</span>
                <div>
                  <button
                    disabled={page === 0}
                    onClick={() => {
                      setPage((p) => p - 1);
                      list.current?.scrollTo(0, 0);
                    }}
                  >
                    {t('上一頁')}
                  </button>
                  <span>
                    {page + 1} / {Math.max(1, Math.ceil(filtered.length / 30))}
                  </span>
                  <button
                    disabled={(page + 1) * 30 >= filtered.length}
                    onClick={() => {
                      setPage((p) => p + 1);
                      list.current?.scrollTo(0, 0);
                    }}
                  >
                    {t('下一頁')}
                  </button>
                </div>
              </div>
            </main>
          )}
        </div>
      )}
      <footer className={s.statusBar} role="status">
        {busy && progress?.running
          ? t('處理 {0} 筆 · 注意 {1} 筆 · {2}', [
              progress.processed,
              progress.errors,
              progress.current,
            ])
          : message}
        {busy && progress?.running && (
          <button onClick={() => void window.catalog.cancel()}>{t('取消掃描')}</button>
        )}
      </footer>
      {large && <ImageViewer preview={large} close={() => setLarge(null)} />}
      {upload && (
        <UploadDialog
          asset={upload.asset}
          draft={upload.draft}
          close={() => setUpload(null)}
          done={refreshData}
          onBusy={setChildBusy}
        />
      )}
      {scanPlan && project && (
        <Modal title={t('確認掃描差異')} busy={busy} close={() => setScanPlan(null)}>
          <p>{t('只保存下列新增路徑。既有變更不覆寫基準，來源缺失不刪除工具資料。')}</p>
          <div
            style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '0 0 8px 8px' }}
          >
            {(['added', 'changed', 'missing'] as const).map((kind) => (
              <details key={kind} open>
                <summary>
                  {
                    {
                      added: t('新增'),
                      changed: t('既有變更／無可用基準'),
                      missing: t('來源缺失'),
                    }[kind]
                  }
                  （{scanPlan[kind].length}）
                </summary>
                <ul>
                  {scanPlan[kind].map((path) => (
                    <li key={path}>{path}</li>
                  ))}
                </ul>
              </details>
            ))}
          </div>
          {busy && (
            <div className={s.scanFeedback} role="status" aria-live="polite">
              <span className={s.spinner} aria-hidden="true" />
              <div>
                <strong>{t('掃描中…')}</strong>
                <small>{t('處理中，請勿關閉')}</small>
                {progress?.running && (
                  <small>
                    {t('處理 {0} 筆 · 注意 {1} 筆 · {2}', [
                      progress.processed,
                      progress.errors,
                      progress.current,
                    ])}
                  </small>
                )}
              </div>
            </div>
          )}
          <div style={{ display: 'flex', gap: 5 }}>
            <button disabled={busy} onClick={() => setScanPlan(null)}>
              {t('取消')}
            </button>

            <button
              disabled={busy}
              onClick={() => {
                if (busy) return;
                setProgress(null);
                setBusy(true);
                void window.catalog
                  .scanCommit(project.id, scanPlan.token)
                  .then(async (r) => {
                    const updated = value(r);
                    setProject(updated);
                    setScanPlan(null);
                    await refresh();
                    await refreshData(updated.id);
                    setMessage(
                      updated.status === 'cancelled'
                        ? t('已保留掃描結果，可稍後繼續；目前尚無法套用到遊戲。')
                        : t('掃描結果已保存'),
                    );
                  })
                  .catch((e) => {
                    setMessage(t(String(e)));
                    setScanPlan(null);
                  })
                  .finally(() => {
                    setBusy(false);
                    setProgress(null);
                  });
              }}
            >
              {busy ? t('掃描中…') : t('確認新增／繼續掃描')}
            </button>
          </div>
        </Modal>
      )}
      {exporting && (
        <Modal title={t('匯出圖片')} close={() => setExporting(false)} busy={busy}>
          <label>
            {t('範圍')}
            <select value={exportScope} onChange={(e) => setExportScope(e.target.value)}>
              <option value="selected">
                {t('勾選的素材（')}
                {selected.length}）
              </option>
              <option value="current">{t('目前篩選範圍')}</option>
              <option value="project">{t('整個專案')}</option>
            </select>
          </label>
          <label>
            {t('來源')}
            <select
              value={exportSource}
              onChange={(e) => setExportSource(e.target.value as 'original' | 'active')}
            >
              <option value="original">{t('固定原圖')}</option>
              <option value="active">{t('目前選用版本（無選用則原圖）')}</option>
            </select>
          </label>
          <p>{t('保留原始相對路徑，不可讀取的素材不列入匯出。')}</p>
          <div className={s.modalActions}>
            <button disabled={busy} onClick={() => setExporting(false)}>
              {t('取消')}
            </button>
            <button
              className={s.primary}
              disabled={busy || (exportScope === 'selected' && !selected.length)}
              onClick={() =>
                void (async () => {
                  setBusy(true);
                  try {
                    const rows =
                      exportScope === 'project'
                        ? assets
                        : exportScope === 'selected'
                          ? assets.filter((a) => selected.includes(a.id))
                          : filtered;
                    const r = value(
                      await window.versions.export(
                        rows.filter((a) => !a.error).map((a) => a.id),
                        exportSource,
                      ),
                    );
                    if (r)
                      setMessage(
                        t('匯出 {0}；略過 {1}；失敗 {2} {3}', [
                          r.completed.length,
                          r.skipped.length,
                          r.failed.length,
                          r.failed.map((f) => f.path + ': ' + f.error).join('；'),
                        ]),
                      );
                    setExporting(false);
                  } catch (e) {
                    setMessage(t(String(e)));
                  } finally {
                    setBusy(false);
                  }
                })()
              }
            >
              {t('選擇目的地並匯出')}
            </button>
          </div>
          <p>{message}</p>
        </Modal>
      )}
      {groupAction && (
        <Modal
          title={
            {
              create: t('建立群組'),
              rename: t('重新命名群組'),
              add: t('加入群組'),
              remove: t('從群組移除素材'),
              delete: t('刪除群組'),
            }[groupAction]
          }
          busy={busy}
          close={() => setGroupAction(null)}
        >
          {groupAction === 'create' || groupAction === 'rename' ? (
            <label>
              {t('群組名稱')}
              <input
                value={groupName}
                maxLength={80}
                onChange={(e) => setGroupName(e.target.value)}
              />
            </label>
          ) : groupAction === 'add' ? (
            <select
              aria-label={t('目標群組')}
              value={targetGroup}
              onChange={(e) => setTargetGroup(e.target.value)}
            >
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          ) : (
            <p>{t('只移除群組關聯，不會刪除圖片、歷史或遊戲檔案。')}</p>
          )}
          <div className={s.modalActions}>
            <button disabled={busy} onClick={() => setGroupAction(null)}>
              {t('取消')}
            </button>
            <button
              className={s.primary}
              disabled={
                busy ||
                ((groupAction === 'create' || groupAction === 'rename') && !groupName.trim())
              }
              onClick={() => void groupSubmit()}
            >
              {t('確認')}
            </button>
          </div>
          <p>{message}</p>
        </Modal>
      )}
      {settings && project && (
        <ProjectSettings
          project={project}
          assets={assets}
          close={() => setSettings(false)}
          saved={(p) => {
            setProject(p);
            void refresh();
          }}
        />
      )}
      {deleting && (
        <DeleteProject
          project={deleting}
          close={() => {
            setDeleting(null);
            void refresh();
          }}
          deleted={() => {
            setDeleting(null);
            void refresh();
            setMessage(t('專案及工具保存的相關資料已刪除；遊戲維持現狀'));
          }}
        />
      )}
      {addingAssets && currentGroup && (
        <AssetPicker
          title={t('新增素材至群組「{0}」', [currentGroup.name])}
          assets={assets}
          excluded={currentGroup.assetIds}
          close={() => setAddingAssets(false)}
          submit={async (ids) => {
            setGroups(
              value(await window.manager.changeGroup(project!.id, currentGroup.id, 'add', ids)),
            );
            setAddingAssets(false);
            setMessage(t('素材已加入群組'));
          }}
        />
      )}
      {quick && (
        <Modal
          title={quick.kind === 'remove' ? t('永久刪除待套用版本？') : t('取消待套用？')}
          busy={busy}
          close={() => setQuick(null)}
        >
          <p>{quick.asset.path}</p>
          <p>
            {quick.kind === 'remove'
              ? t('刪除此版本圖片與上傳紀錄，且無法復原。選用將回到遊戲目前版本。')
              : t('選用回到遊戲目前版本，保留所有上傳歷史。')}
            {t('此操作不寫入遊戲。')}
          </p>
          <div className={s.modalActions}>
            <button disabled={busy} onClick={() => setQuick(null)}>
              {t('返回')}
            </button>
            <button
              className={quick.kind === 'remove' ? s.danger : s.primary}
              disabled={busy}
              onClick={() => {
                setBusy(true);
                void (
                  quick.kind === 'remove'
                    ? window.versions.remove(quick.asset.id, quick.version!, true)
                    : window.versions.select(quick.asset.id, quick.version)
                )
                  .then((r) => {
                    value(r);
                    setQuick(null);
                    return refreshData();
                  })
                  .catch((e) => setMessage(t(String(e))))
                  .finally(() => setBusy(false));
              }}
            >
              {quick.kind === 'remove' ? t('永久刪除版本') : t('確認取消待套用')}
            </button>
          </div>
          <p role="alert">{message}</p>
        </Modal>
      )}{' '}
    </div>
  );
}
