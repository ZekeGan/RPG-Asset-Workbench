import React, { useEffect, useRef, useState } from 'react';
import type {
  Asset,
  CatalogBridge,
  Group,
  Project,
  ProjectDraft,
  ScanProgress,
  VersionState,
} from '../shared/contracts';
import s from './workbench.module.css';
import { VersionPanel } from './VersionPanel';
import { OperationPanel } from './OperationPanel';
import { BatchPanel } from './BatchPanel';
import { Icon, Modal, value } from './ui';
declare global {
  interface Window {
    catalog: CatalogBridge;
  }
}
function Thumbnail({ asset, version = null }: { asset: Asset; version?: string | null }) {
  const ref = useRef<HTMLDivElement>(null),
    [src, setSrc] = useState(''),
    [error, setError] = useState('');
  useEffect(() => {
    let alive = true,
      started = false;
    setSrc('');
    setError('');
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting) || started || asset.error) return;
        started = true;
        void window.versions
          .preview(asset.id, version)
          .then((r) => {
            if (alive) {
              if (r.ok) setSrc(r.value.dataUrl);
              else setError(r.error);
            }
          })
          .catch((e) => {
            if (alive) setError(String(e));
          });
      },
      { rootMargin: '100px' },
    );
    if (ref.current) observer.observe(ref.current);
    return () => {
      alive = false;
      observer.disconnect();
    };
  }, [asset.id, version]);
  return (
    <div ref={ref} className={s.image}>
      {src ? (
        <img src={src} alt={asset.path} />
      ) : (
        <span>{asset.error ? '無法預覽' : error || <Icon name="image" />}</span>
      )}
    </div>
  );
}
function ProjectCover({ project }: { project: Project }) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    let alive = true;
    void (async () => {
      const assets = value(await window.catalog.assets(project.id)).filter((a) => !a.error);
      const asset =
        assets.find((a) => a.path.startsWith('img/titles1/')) ||
        assets.find((a) => a.path.startsWith('img/pictures/')) ||
        assets[0];
      if (asset) {
        const preview = value(await window.catalog.preview(asset.id));
        if (alive) setSrc(preview.dataUrl);
      }
    })().catch(() => {});
    return () => {
      alive = false;
    };
  }, [project.id]);
  return (
    <div className={s.cover}>
      {src ? <img src={src} alt={project.name + ' 原始素材封面'} /> : <Icon name="image" />}
      <span>{project.engine}</span>
    </div>
  );
}
const labels: Record<string, string> = {
  ready: '掃描完成',
  warnings: '有注意事項',
  cancelled: '掃描已取消',
  interrupted: '掃描曾中斷',
  failed: '掃描失敗',
  scanning: '掃描中',
};
export default function Workbench({ diagnostics }: { diagnostics: () => void }) {
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
    [message, setMessage] = useState('載入專案…'),
    [busy, setBusy] = useState(false),
    [progress, setProgress] = useState<ScanProgress | null>(null);
  const [candidate, setCandidate] = useState<ProjectDraft | null>(null);
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
    [groupAction, setGroupAction] = useState<'create' | 'add' | 'remove' | 'delete' | null>(null),
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
      .then(() => setMessage('專案清單已讀取'))
      .catch((e) => setMessage(String(e)));
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
  }, [detail, operation]);
  async function openProject(p: Project) {
    const n = ++request.current;
    setBusy(true);
    setDetail(null);
    setOperation(null);
    setProject(p);
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
          setMessage('發現未完成操作，請確認恢復');
        } else setMessage('專案資料已讀取');
      }
    } catch (e) {
      setMessage(String(e));
    } finally {
      setBusy(false);
    }
  }
  async function create() {
    if (!candidate) return;
    setBusy(true);
    setMessage('建立原始備份…');
    try {
      const p = value(await window.catalog.create(candidate.token, name, confirmed));
      await refresh();
      if (p) {
        setCreating(false);
        await openProject(p);
        setMessage(labels[p.status] + ' · 原始基準已保存');
      } else setMessage('已取消選擇資料夾');
    } catch (e) {
      setCandidate(null);
      setMessage(String(e));
      await refresh();
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }
  const folders = [...new Set(assets.map((a) => a.path.split('/').slice(0, -1).join('/')))].sort(),
    currentGroup = groups.find((g) => g.id === group);
  const filtered = assets.filter((a) => {
    const st = states[a.id],
      active = st?.versions.find((v) => v.id === st.active),
      warning = !!a.error || (!!active && active.differences !== '[]');
    return (
      (!folder || a.path.startsWith(folder + '/')) &&
      (!group || currentGroup?.assetIds.includes(a.id)) &&
      a.path.toLowerCase().includes(search.toLowerCase()) &&
      (status === 'all' ||
        (status === 'pending' && !!st?.active && st.active !== st.deployed) ||
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
  const locked = busy || !!operation || storage.blocked;
  async function groupSubmit() {
    if (!project) return;
    setBusy(true);
    try {
      if (groupAction === 'create') {
        setGroups(value(await window.manager.createGroup(project.id, groupName)));
      } else {
        const id = groupAction === 'add' ? targetGroup : group;
        if (!id) throw Error('請選擇群組');
        setGroups(value(await window.manager.changeGroup(project.id, id, groupAction!, selected)));
        if (groupAction === 'delete') setGroup('');
      }
      setGroupAction(null);
      setMessage('群組變更已保存');
    } catch (e) {
      setMessage(String(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className={s.app}>
      <header className={s.top}>
        <button
          className={s.brand}
          disabled={locked}
          onClick={() => {
            setCreating(false);
            setProject(null);
            setDetail(null);
            setOperation(null);
          }}
        >
          <Icon name="image" />
          <strong>RPG 圖片管理器</strong>
        </button>
        {project && (
          <select
            aria-label="切換專案"
            value={project.id}
            disabled={locked}
            onChange={(e) => {
              const p = projects.find((p) => p.id === e.target.value);
              if (p) void openProject(p);
            }}
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        )}
        <span className={s.version}>0.4.0</span>
        <div className={s.topActions}>
          <span className={s.saveState}>{busy ? '處理中…' : '本機專案'}</span>
          {project ? (
            <>
              <button disabled={locked} onClick={() => setSettings(true)}>
                <Icon name="settings" />
                專案設定
              </button>
              <button
                disabled={locked}
                onClick={() => {
                  remember();
                  setDetail(null);
                  setOperation('restore');
                }}
              >
                ↶ 還原遊戲
              </button>
              <button
                className={s.primary}
                disabled={locked}
                onClick={() => {
                  remember();
                  setDetail(null);
                  setOperation('apply');
                }}
              >
                <Icon name="upload" />
                套用到遊戲
              </button>
            </>
          ) : (
            <>
              <button disabled={busy} onClick={diagnostics}>
                環境檢查
              </button>
              <button
                className={s.primary}
                disabled={busy}
                onClick={() => {
                  setName('');
                  setConfirmed(false);
                  setCandidate(null);
                  setMessage('選擇遊戲資料夾以辨識引擎');
                  setCreating(true);
                }}
              >
                ＋ 建立專案
              </button>
            </>
          )}
        </div>
      </header>
      {storage.blocked && (
        <div className={s.storageError} role="alert">
          <strong>儲存失敗，修改已鎖定</strong>
          <span>{storage.error}</span>
          <button
            disabled={busy}
            onClick={() =>
              void (async () => {
                setBusy(true);
                try {
                  setStorage(value(await window.manager.retryStorage()));
                  setMessage('儲存檢查已通過');
                } catch (e) {
                  setMessage(String(e));
                } finally {
                  setBusy(false);
                }
              })()
            }
          >
            重試儲存檢查
          </button>
        </div>
      )}
      {creating ? (
        <main className={s.home}>
          <button className={s.back} disabled={busy} onClick={() => setCreating(false)}>
            ← 返回專案清單
          </button>
          <div className={s.createPage}>
            <h1>建立新遊戲專案</h1>
            <p>選擇遊戲資料夾，將圖片保存為固定原始基準。</p>
            <section className={s.createCard}>
              <label>
                專案名稱
                <input
                  aria-label="專案名稱"
                  maxLength={100}
                  disabled={busy}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="留空則使用遊戲名稱"
                />
              </label>
              <label>遊戲資料夾</label>
              <div className={s.folderPicker}>
                <span className={s.path}>{candidate?.root || '尚未選擇遊戲資料夾'}</span>
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
                          result ? '遊戲辨識完成，請確認來源後建立專案' : '已取消選擇資料夾',
                        );
                      } catch (e) {
                        setMessage(String(e));
                      } finally {
                        setBusy(false);
                      }
                    })()
                  }
                >
                  選擇資料夾
                </button>
              </div>
              {candidate && (
                <div className={s.detected}>
                  <strong>✓ 已辨識 RPG Maker {candidate.engine}</strong>
                  <p>
                    {candidate.name} · {candidate.encrypted ? '標準加密圖片' : '未加密圖片'}
                  </p>
                </div>
              )}
              <div className={s.notice}>
                建立後會保存原始圖片備份。請使用乾淨的遊戲測試副本；原始基準不會因後續替換而更新。
              </div>
              <label className={s.checkLabel}>
                <input
                  type="checkbox"
                  checked={confirmed}
                  disabled={busy || !candidate}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />
                我確認這是未修改的遊戲來源
              </label>
              <div className={s.modalActions}>
                <button disabled={busy} onClick={() => setCreating(false)}>
                  取消
                </button>
                <button
                  className={s.primary}
                  disabled={busy || storage.blocked || !candidate || !confirmed}
                  onClick={() => void create()}
                >
                  建立專案
                </button>
              </div>
              {busy && progress?.running && (
                <p>
                  掃描中… {progress.processed} 筆{' '}
                  <button onClick={() => void window.catalog.cancel()}>取消掃描</button>
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
              <h1>遊戲專案</h1>
              <p>管理多個 RPG Maker 遊戲專案的圖片素材</p>
            </div>
            <button
              className={s.primary}
              disabled={busy}
              onClick={() => {
                setName('');
                setConfirmed(false);
                setCandidate(null);
                setMessage('選擇遊戲資料夾以辨識引擎');
                setCreating(true);
              }}
            >
              ＋ 建立專案
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
                <button className={s.primary} disabled={busy} onClick={() => void openProject(p)}>
                  開啟專案 →
                </button>
              </section>
            ))}
          </div>
          {!projects.length && (
            <div className={s.blank}>尚無遊戲專案。建立專案後即可管理素材。</div>
          )}
        </main>
      ) : operation ? (
        <OperationPanel
          key={project.id + operation}
          project={project}
          assets={assets}
          kind={operation}
          back={() => {
            setOperation(null);
            void refreshData();
          }}
        />
      ) : detail ? (
        <main className={s.home}>
          <button
            className={s.back}
            onClick={() => {
              setDetail(null);
              void refreshData();
            }}
          >
            ← 返回列表
          </button>
          {detail.error ? (
            <>
              <h1>{detail.path}</h1>
              <p className={s.warning}>{detail.error}</p>
            </>
          ) : (
            <VersionPanel key={detail.id} asset={detail} changed={() => void refreshData()} />
          )}
        </main>
      ) : (
        <div className={s.shell}>
          <aside className={s.sidebar}>
            <h3>原始資料夾</h3>
            <button
              className={!folder && !group ? s.active : ''}
              onClick={() => {
                setFolder('');
                setGroup('');
              }}
            >
              <Icon name="folder" />
              全部素材 <span>{assets.length}</span>
            </button>
            {folders.map((f) => (
              <button
                className={folder === f ? s.active : ''}
                key={f}
                onClick={() => {
                  setFolder(f);
                  setGroup('');
                }}
              >
                <Icon name="folder" />
                <span className={s.folderName}>{f.replace(/^img\//, '')}</span>
                <small>{assets.filter((a) => a.path.startsWith(f + '/')).length}</small>
              </button>
            ))}
            <hr />
            <h3>自訂群組</h3>
            {groups.map((g) => (
              <button
                key={g.id}
                className={group === g.id ? s.active : ''}
                onClick={() => {
                  setGroup(g.id);
                  setFolder('');
                }}
              >
                ▱ {g.name}
                <span>{g.assetIds.length}</span>
              </button>
            ))}
            <button
              onClick={() => {
                setGroupName('');
                setGroupAction('create');
              }}
            >
              ＋ 建立群組
            </button>
            <div className={s.sideBottom}>
              <small>
                {project.engine} · {labels[project.status]}
              </small>
            </div>
          </aside>
          <main className={s.work}>
            <div className={s.workHeading}>
              <div>
                <small>素材工作臺 ／ {group ? '自訂群組' : '原始資料夾'}</small>
                <h1>
                  {currentGroup?.name || folder.replace(/^img\//, '') || '全部素材'}{' '}
                  <span>{filtered.length} 張素材</span>
                </h1>
              </div>
              <div className={s.headingActions}>
                {group && <button onClick={() => setGroupAction('delete')}>群組選單 · 刪除</button>}
                <button
                  aria-expanded={!collapsed}
                  aria-controls="workbench-toolbar"
                  onClick={() => setCollapsed((c) => !c)}
                >
                  {collapsed ? '⌄ 展開工具列' : '⌃ 收合工具列'}
                </button>
              </div>
            </div>
            {!collapsed && (
              <div id="workbench-toolbar" className={s.toolbar}>
                <input
                  aria-label="搜尋檔名"
                  placeholder="⌕  搜尋檔名…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <select
                  aria-label="狀態篩選"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="all">全部狀態</option>
                  <option value="pending">待套用</option>
                  <option value="warnings">有注意事項</option>
                  <option value="empty">尚未替換</option>
                  <option value="deployed">已套用</option>
                </select>
                <select
                  aria-label="預覽背景"
                  value={background}
                  onChange={(e) => setBackground(e.target.value)}
                >
                  <option value="checker">棋盤格</option>
                  <option value="white">白色</option>
                  <option value="black">黑色</option>
                  <option value="custom">自訂</option>
                </select>
                {background === 'custom' && (
                  <input
                    type="color"
                    aria-label="自訂背景色"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                  />
                )}
                <div className={s.toolbarRight}>
                  <button className={s.primary} onClick={() => setBatch(true)}>
                    <Icon name="upload" />
                    批量匯入圖片
                  </button>
                  <button
                    onClick={() => {
                      setExportScope(selected.length ? 'selected' : 'current');
                      setExporting(true);
                    }}
                  >
                    ⇩ 匯出
                  </button>
                </div>
              </div>
            )}
            <div className={s.selectionBar}>
              <label>
                <input
                  type="checkbox"
                  aria-label="全選目前篩選結果"
                  checked={allSelected}
                  onChange={(e) => setSelected(e.target.checked ? eligible.map((a) => a.id) : [])}
                />
                已選取 {selected.length} 張
              </label>
              <div>
                <button
                  disabled={!selected.length || !groups.length}
                  onClick={() => {
                    setTargetGroup(group || groups[0]?.id || '');
                    setGroupAction('add');
                  }}
                >
                  加入群組
                </button>
                {group && (
                  <button disabled={!selected.length} onClick={() => setGroupAction('remove')}>
                    從目前群組移除
                  </button>
                )}
                {collapsed && (
                  <button
                    onClick={() => {
                      setExportScope(selected.length ? 'selected' : 'current');
                      setExporting(true);
                    }}
                  >
                    匯出
                  </button>
                )}
              </div>
            </div>
            <div className={s.tableHeader}>
              <span />
              <span>原始圖片 · 固定基準</span>
              <span>目前替換圖片</span>
              <span>操作</span>
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
                      aria-label={'選取 ' + a.path}
                      disabled={!!a.error}
                      checked={selected.includes(a.id)}
                      onChange={(e) =>
                        setSelected((ids) =>
                          e.target.checked ? [...ids, a.id] : ids.filter((id) => id !== a.id),
                        )
                      }
                    />
                    <div className={s.assetCell}>
                      <Thumbnail asset={a} />
                      <div>
                        <strong>{a.path.split('/').pop()}</strong>
                        <small>{a.error || `${a.width} × ${a.height} · PNG`}</small>
                        <small className={s.assetPath}>{a.path}</small>
                      </div>
                    </div>
                    {v ? (
                      <div className={s.assetCell}>
                        <Thumbnail asset={a} version={v.id} />
                        <div>
                          <strong className={v.id === st.deployed ? s.success : s.warning}>
                            V{v.number} · {v.id === st.deployed ? '已套用' : '待套用'}
                          </strong>
                          <small className={v.differences === '[]' ? s.success : s.warning}>
                            {v.differences === '[]' ? '✓ 圖片規格一致' : '⚠ 已接受圖片差異'}
                          </small>
                          <small>
                            遊戲 {deployed ? 'V' + deployed.number : '原圖'} → 選用 V{v.number}
                          </small>
                          <small>{st.versions.length} 筆上傳紀錄</small>
                        </div>
                      </div>
                    ) : (
                      <div className={s.empty}>
                        <Icon name="image" />
                        <span>尚未選用</span>
                        <small>{deployed ? '遊戲仍為 V' + deployed.number : '無替換版本'}</small>
                      </div>
                    )}
                    <button
                      onClick={() => {
                        remember();
                        setDetail(a);
                      }}
                    >
                      詳細內容 →
                    </button>
                  </article>
                );
              })}
              {!shown.length && <div className={s.blank}>目前範圍沒有素材</div>}
            </div>
            <div className={s.pager}>
              <span>
                顯示 {shown.length} / {filtered.length} 張素材
              </span>
              <div>
                <button
                  disabled={page === 0}
                  onClick={() => {
                    setPage((p) => p - 1);
                    list.current?.scrollTo(0, 0);
                  }}
                >
                  上一頁
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
                  下一頁
                </button>
              </div>
            </div>
          </main>
        </div>
      )}
      <footer className={s.statusBar} role="status">
        {busy && progress?.running
          ? `處理 ${progress.processed} 筆 · 注意 ${progress.errors} 筆 · ${progress.current}`
          : message}
        {busy && progress?.running && (
          <button onClick={() => void window.catalog.cancel()}>取消掃描</button>
        )}
      </footer>
      {exporting && (
        <Modal title="匯出圖片" close={() => setExporting(false)} busy={busy}>
          <label>
            範圍
            <select value={exportScope} onChange={(e) => setExportScope(e.target.value)}>
              <option value="selected">勾選的素材（{selected.length}）</option>
              <option value="current">目前篩選範圍</option>
              <option value="project">整個專案</option>
            </select>
          </label>
          <label>
            來源
            <select
              value={exportSource}
              onChange={(e) => setExportSource(e.target.value as 'original' | 'active')}
            >
              <option value="original">固定原圖</option>
              <option value="active">目前選用版本（無選用則原圖）</option>
            </select>
          </label>
          <p>保留原始相對路徑，不可讀取的素材不列入匯出。</p>
          <div className={s.modalActions}>
            <button disabled={busy} onClick={() => setExporting(false)}>
              取消
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
                        `匯出 ${r.completed.length}；略過 ${r.skipped.length}；失敗 ${r.failed.length} ${r.failed.map((f) => f.path + ': ' + f.error).join('；')}`,
                      );
                    setExporting(false);
                  } catch (e) {
                    setMessage(String(e));
                  } finally {
                    setBusy(false);
                  }
                })()
              }
            >
              選擇目的地並匯出
            </button>
          </div>
          <p>{message}</p>
        </Modal>
      )}
      {project && batch && (
        <BatchPanel
          projectId={project.id}
          assets={assets}
          close={() => setBatch(false)}
          done={() => {
            void refreshData();
            setMessage('批量匯入已保存，尚未寫入遊戲');
          }}
        />
      )}
      {groupAction && (
        <Modal
          title={
            { create: '建立群組', add: '加入群組', remove: '從群組移除素材', delete: '刪除群組' }[
              groupAction
            ]
          }
          busy={busy}
          close={() => setGroupAction(null)}
        >
          {groupAction === 'create' ? (
            <label>
              群組名稱
              <input
                value={groupName}
                maxLength={80}
                onChange={(e) => setGroupName(e.target.value)}
              />
            </label>
          ) : groupAction === 'add' ? (
            <select
              aria-label="目標群組"
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
            <p>只移除群組關聯，不會刪除圖片、歷史或遊戲檔案。</p>
          )}
          <div className={s.modalActions}>
            <button disabled={busy} onClick={() => setGroupAction(null)}>
              取消
            </button>
            <button
              className={s.primary}
              disabled={busy || (groupAction === 'create' && !groupName.trim())}
              onClick={() => void groupSubmit()}
            >
              確認
            </button>
          </div>
          <p>{message}</p>
        </Modal>
      )}
      {settings && project && (
        <Modal title="專案設定" busy={busy} close={() => setSettings(false)}>
          <h3>{project.name}</h3>
          <p className={s.path}>{project.root}</p>
          <p>重新連結會核對引擎、素材清單與最後部署內容，不會重設原始備份。</p>
          <button
            disabled={busy}
            onClick={() =>
              void (async () => {
                setBusy(true);
                try {
                  const p = value(await window.manager.relink(project.id));
                  if (p) {
                    setProject(p);
                    await refresh();
                    setMessage('遊戲位置已重新連結');
                    setSettings(false);
                  }
                } catch (e) {
                  setMessage(String(e));
                } finally {
                  setBusy(false);
                }
              })()
            }
          >
            重新連結遊戲位置
          </button>
          <p>{message}</p>
        </Modal>
      )}
    </div>
  );
}
