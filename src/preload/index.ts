import { contextBridge, ipcRenderer, webUtils } from 'electron';
import type { Bridge, CatalogBridge } from '../shared/contracts';
const api: Bridge = {
  load: () => ipcRenderer.invoke('poc:load'),
  save: (note) => ipcRenderer.invoke('poc:save', note),
  choosePng: () => ipcRenderer.invoke('poc:png'),
};
contextBridge.exposeInMainWorld('poc', Object.freeze(api));

const catalog: CatalogBridge = {
  availability: (id) => ipcRenderer.invoke('catalog:availability', id),
  scanPlan: (id) => ipcRenderer.invoke('catalog:scan-plan', id),
  scanCommit: (id, token) => ipcRenderer.invoke('catalog:scan-commit', id, token),
  projects: () => ipcRenderer.invoke('catalog:projects'),
  choose: () => ipcRenderer.invoke('catalog:choose'),
  create: (token, name, confirmed) => ipcRenderer.invoke('catalog:create', token, name, confirmed),
  assets: (id) => ipcRenderer.invoke('catalog:assets', id),
  preview: (id) => ipcRenderer.invoke('catalog:preview', id),
  progress: () => ipcRenderer.invoke('catalog:progress'),
  cancel: () => ipcRenderer.invoke('catalog:cancel'),
};
contextBridge.exposeInMainWorld('catalog', Object.freeze(catalog));

import type { VersionBridge } from '../shared/contracts';
const versions: VersionBridge = {
  drop: (id, files) =>
    ipcRenderer.invoke(
      'version:drop',
      id,
      files.map((f) => webUtils.getPathForFile(f)),
    ),
  state: (id) => ipcRenderer.invoke('version:state', id),
  choose: (id) => ipcRenderer.invoke('version:choose', id),
  commit: (token, accepted) => ipcRenderer.invoke('version:commit', token, accepted),
  discard: (token) => ipcRenderer.invoke('version:discard', token),
  preview: (id, version) => ipcRenderer.invoke('version:preview', id, version),
  select: (id, version) => ipcRenderer.invoke('version:select', id, version),
  remove: (id, version, cancelActive = false) =>
    ipcRenderer.invoke('version:remove', id, version, cancelActive),
  export: (ids, source) => ipcRenderer.invoke('version:export', ids, source),
};
contextBridge.exposeInMainWorld('versions', Object.freeze(versions));

import type { OperationBridge } from '../shared/contracts';
const operations: OperationBridge = {
  list: (id) => ipcRenderer.invoke('operation:list', id),
  execute: (id, kind, ids, confirmed) =>
    ipcRenderer.invoke('operation:execute', id, kind, ids, confirmed),
  recover: (id, operationId, confirmed) =>
    ipcRenderer.invoke('operation:recover', id, operationId, confirmed),
};
contextBridge.exposeInMainWorld('operations', Object.freeze(operations));

import type { ManagerBridge } from '../shared/contracts';
const manager: ManagerBridge = {
  setLocale: (locale) => ipcRenderer.invoke('manager:locale', locale),
  previewBatch: (token, full = false) => ipcRenderer.invoke('manager:batch-preview', token, full),
  cover: (id) => ipcRenderer.invoke('manager:cover', id),
  chooseCover: (id) => ipcRenderer.invoke('manager:cover-choose', id),
  discardCover: () => ipcRenderer.invoke('manager:cover-discard'),
  saveProject: (id, name, cover) => ipcRenderer.invoke('manager:project-save', id, name, cover),
  deleteProject: (id, confirmed, abandonRecovery) =>
    ipcRenderer.invoke('manager:project-delete', id, confirmed, abandonRecovery),
  dropBatch: (id, files) =>
    ipcRenderer.invoke(
      'manager:batch-drop',
      id,
      files.map((f) => webUtils.getPathForFile(f)),
    ),
  storage: () => ipcRenderer.invoke('manager:storage'),
  retryStorage: () => ipcRenderer.invoke('manager:retry'),
  groups: (id) => ipcRenderer.invoke('manager:groups', id),
  createGroup: (id, name) => ipcRenderer.invoke('manager:group-create', id, name),
  changeGroup: (project, id, action, ids) =>
    ipcRenderer.invoke('manager:group-change', project, id, action, ids),
  states: (id) => ipcRenderer.invoke('manager:states', id),
  chooseBatch: (id) => ipcRenderer.invoke('manager:batch-choose', id),
  inspectBatch: (token, id) => ipcRenderer.invoke('manager:batch-inspect', token, id),
  commitBatch: (id, items) => ipcRenderer.invoke('manager:batch-commit', id, items),
  discardBatch: () => ipcRenderer.invoke('manager:batch-discard'),
  relink: (id) => ipcRenderer.invoke('manager:relink', id),
  fullPreview: (id, version) => ipcRenderer.invoke('manager:full-preview', id, version),
};
contextBridge.exposeInMainWorld('manager', Object.freeze(manager));
