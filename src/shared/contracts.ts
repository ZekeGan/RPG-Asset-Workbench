export type Result<T> = { ok: true; value: T } | { ok: false; error: string };
export interface Snapshot {
  note: string;
  updatedAt: string | null;
  database: string;
  settings: { journal: string; synchronous: number; foreignKeys: number };
}
export interface Preview {
  name: string;
  width: number;
  height: number;
  hasAlpha: boolean;
  sha256: string;
  dataUrl: string;
}
export interface Bridge {
  load: () => Promise<Result<Snapshot>>;
  save: (note: string) => Promise<Result<Snapshot>>;
  choosePng: () => Promise<Result<Preview | null>>;
}

export interface Project {
  id: string;
  name: string;
  root: string;
  engine: 'MV' | 'MZ';
  status: string;
  created: string;
}
export interface Asset {
  id: string;
  projectId: string;
  path: string;
  hash: string | null;
  width: number | null;
  height: number | null;
  alpha: number | null;
  error: string | null;
}
export interface ScanProgress {
  running: boolean;
  processed: number;
  errors: number;
  current: string;
}
export interface ProjectDraft {
  token: string;
  root: string;
  name: string;
  engine: 'MV' | 'MZ';
  encrypted: boolean;
}
export interface CatalogBridge {
  availability: (id: string) => Promise<Result<{ online: boolean; error: string | null }>>;
  scanPlan: (id: string) => Promise<Result<ScanPlan>>;
  scanCommit: (id: string, token: string) => Promise<Result<Project>>;
  choose: () => Promise<Result<ProjectDraft | null>>;
  projects: () => Promise<Result<Project[]>>;
  create: (token: string, name: string, confirmed: boolean) => Promise<Result<Project | null>>;
  assets: (id: string) => Promise<Result<Asset[]>>;
  preview: (id: string) => Promise<Result<Preview>>;
  progress: () => Promise<Result<ScanProgress>>;
  cancel: () => Promise<Result<void>>;
}
export interface ScanPlan {
  token: string;
  added: string[];
  changed: string[];
  missing: string[];
}
export interface Version {
  id: string;
  assetId: string;
  number: number;
  hash: string;
  width: number;
  height: number;
  alpha: number;
  name: string;
  created: string;
  differences: string;
}
export interface VersionState {
  active: string | null;
  deployed: string | null;
  versions: Version[];
}
export interface ImportDraft {
  token: string;
  preview: Preview;
  differences: string[];
}
export interface VersionBridge {
  drop: (id: string, files: File[]) => Promise<Result<ImportDraft>>;
  state: (id: string) => Promise<Result<VersionState>>;
  choose: (id: string) => Promise<Result<ImportDraft | null>>;
  commit: (token: string, accepted: boolean) => Promise<Result<VersionState>>;
  discard: (token: string) => Promise<Result<void>>;
  preview: (id: string, version: string | null) => Promise<Result<Preview>>;
  select: (id: string, version: string | null) => Promise<Result<VersionState>>;
  remove: (id: string, version: string) => Promise<Result<VersionState>>;
  export: (ids: string[], source: 'original' | 'active') => Promise<Result<ExportResult | null>>;
}
export interface ExportResult {
  completed: string[];
  skipped: string[];
  failed: { path: string; error: string }[];
}

export interface OperationRecord {
  id: string;
  projectId: string;
  kind: 'apply' | 'restore';
  status: string;
  items: {
    assetId: string;
    path: string;
    before: string;
    after: string;
    previous: string | null;
    next: string | null;
  }[];
  error: string | null;
}
export interface OperationBridge {
  list: (projectId: string) => Promise<Result<OperationRecord[]>>;
  execute: (
    projectId: string,
    kind: 'apply' | 'restore',
    ids: string[],
    confirmed: boolean,
  ) => Promise<Result<OperationRecord>>;
  recover: (projectId: string, id: string, confirmed: boolean) => Promise<Result<OperationRecord>>;
}
export interface Group {
  id: string;
  projectId: string;
  name: string;
  assetIds: string[];
}
export interface BatchFile {
  candidates: string[];
  token: string;
  path: string;
  name: string;
  assetId: string | null;
  error: string | null;
}
export interface ManagerBridge {
  dropBatch: (projectId: string, files: File[]) => Promise<Result<BatchFile[]>>;
  storage: () => Promise<Result<{ blocked: boolean; error: string | null }>>;
  retryStorage: () => Promise<Result<{ blocked: boolean; error: string | null }>>;
  groups: (projectId: string) => Promise<Result<Group[]>>;
  createGroup: (projectId: string, name: string) => Promise<Result<Group[]>>;
  changeGroup: (
    projectId: string,
    id: string,
    action: 'add' | 'remove' | 'delete',
    ids: string[],
  ) => Promise<Result<Group[]>>;
  states: (projectId: string) => Promise<Result<Record<string, VersionState>>>;
  chooseBatch: (projectId: string) => Promise<Result<BatchFile[] | null>>;
  inspectBatch: (token: string, assetId: string) => Promise<Result<ImportDraft>>;
  commitBatch: (
    projectId: string,
    items: { token: string; assetId: string; accepted: boolean }[],
  ) => Promise<Result<void>>;
  discardBatch: () => Promise<Result<void>>;
  relink: (projectId: string) => Promise<Result<Project | null>>;
  fullPreview: (assetId: string, versionId: string | null) => Promise<Result<Preview>>;
}
