import React, { useState } from 'react';
import { getLocale, isLocale, t } from '../shared/i18n';
import { Icon, value } from './ui';
import s from './workbench.module.css';
export function LocaleSelect() {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  return (
    <div>
      <label className={s.localeSelect} title={t('語言')}>
        <Icon name="language" />
        <select
          aria-label="Language"
          disabled={busy}
          value={getLocale()}
          onChange={(e) => {
            const next = e.target.value;
            if (!isLocale(next)) return;
            setBusy(true);
            void window.manager
              .setLocale(next)
              .then((r) => {
                value(r);
                localStorage.setItem('raw-locale', next);
                location.reload();
              })
              .catch((e) => {
                setError(t(String(e)));
                setBusy(false);
              });
          }}
        >
          <option value="zh-Hant">繁體中文</option>
          <option value="zh-Hans">简体中文</option>
          <option value="en">English</option>
          <option value="ja">日本語</option>
        </select>
      </label>
      <small role="alert">{error}</small>
    </div>
  );
}
