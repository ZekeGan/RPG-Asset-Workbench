import { t } from '../shared/i18n';
import React, { useState } from 'react';
import type { Asset, Group } from '../shared/contracts';
import { Icon } from './ui';
import s from './workbench.module.css';
export function Sidebar({
  projectId,
  assets,
  groups,
  folder,
  group,
  choose,
  create,
}: {
  projectId: string;
  assets: Asset[];
  groups: Group[];
  folder: string;
  group: string;
  choose: (folder: string, group: string) => void;
  create: () => void;
}) {
  const key = `sidebar:${projectId}`;
  const [closed, setClosed] = useState<string[]>(() => {
    try {
      const v = JSON.parse(localStorage.getItem(key) || '[]');
      return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
    } catch {
      return [];
    }
  });
  const toggle = (id: string) =>
    setClosed((old) => {
      const next = old.includes(id) ? old.filter((x) => x !== id) : [...old, id];
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {}
      return next;
    });
  const folders = [
    ...new Set(
      assets.flatMap((a) => {
        const parts = a.path.split('/').slice(0, -1);
        return parts.map((_, i) => parts.slice(0, i + 1).join('/'));
      }),
    ),
  ].sort();
  return (
    <>
      <button
        className={s.sectionToggle}
        aria-expanded={!closed.includes('originals')}
        onClick={() => toggle('originals')}
      >
        {closed.includes('originals') ? '▸' : '▾'}
        {t('原始資料夾')}
      </button>
      {!closed.includes('originals') && (
        <>
          <button className={!folder && !group ? s.active : ''} onClick={() => choose('', '')}>
            <Icon name="folder" />
            {t('全部素材')}
            <span>{assets.length}</span>
          </button>
          {folders
            .filter(
              (f) =>
                !folders.some((parent) => f.startsWith(parent + '/') && closed.includes(parent)),
            )
            .map((f) => {
              const children = folders.some((x) => x.startsWith(f + '/'));
              return (
                <div
                  className={s.folderBranch}
                  key={f}
                  style={{ paddingLeft: Math.min(3, f.split('/').length - 1) * 10 }}
                >
                  {children ? (
                    <button
                      className={s.treeToggle}
                      aria-label={t('展開收合 {0}', [f])}
                      aria-expanded={!closed.includes(f)}
                      onClick={() => toggle(f)}
                    >
                      {closed.includes(f) ? '▸' : '▾'}
                    </button>
                  ) : (
                    <span className={s.treeSpacer} />
                  )}
                  <button
                    title={f}
                    className={folder === f ? s.active : ''}
                    onClick={() => choose(f, '')}
                  >
                    <Icon name="folder" />
                    <span className={s.folderName}>{f.split('/').pop()}</span>
                    <small>{assets.filter((a) => a.path.startsWith(f + '/')).length}</small>
                  </button>
                </div>
              );
            })}
        </>
      )}
      <hr />
      <button
        className={s.sectionToggle}
        aria-expanded={!closed.includes('groups')}
        onClick={() => toggle('groups')}
      >
        {closed.includes('groups') ? '▸' : '▾'}
        {t('自訂群組')}
      </button>
      {!closed.includes('groups') && (
        <>
          {groups.map((g) => (
            <button
              key={g.id}
              className={group === g.id ? s.active : ''}
              onClick={() => choose('', g.id)}
            >
              ▱ <span className={s.folderName}>{g.name}</span>
              <small>{g.assetIds.length}</small>
            </button>
          ))}
          <button onClick={create}>{t('＋ 建立群組')}</button>
        </>
      )}
    </>
  );
}
