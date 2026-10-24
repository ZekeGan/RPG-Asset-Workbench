import React from 'react';
import './global.css';
import { createRoot } from 'react-dom/client';
import Workbench from './Workbench';
import { getLocale, t } from '../shared/i18n';
const root = createRoot(document.getElementById('root')!);
document.documentElement.lang = getLocale();
void window.manager
  .setLocale(getLocale())
  .then((result) => {
    if (!result.ok) throw Error(result.error);
    root.render(<Workbench />);
  })
  .catch((error) =>
    root.render(
      <p role="alert">
        {t('操作失敗')}：{t(String(error))}
      </p>,
    ),
  );
