import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { open, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { Store } from './store';
export interface StorageHealth {
  blocked: boolean;
  error: string | null;
}
export class WriteGuard {
  private failure: string | null = null;
  private marker: string;
  constructor(private root: string) {
    this.marker = join(root, 'storage-failure.json');
    if (existsSync(this.marker)) {
      try {
        this.failure = JSON.parse(readFileSync(this.marker, 'utf8')).error || '上次儲存失敗';
      } catch {
        this.failure = '儲存故障紀錄無法讀取';
      }
    }
  }
  status(): StorageHealth {
    return { blocked: this.failure !== null, error: this.failure };
  }
  assertWritable() {
    if (this.failure) throw Error('儲存故障：請先重試儲存檢查。' + this.failure);
  }
  record(error: unknown) {
    const code = (error as NodeJS.ErrnoException)?.code;
    if (
      typeof code !== 'string' ||
      !/^(SQLITE_(IOERR|FULL|CORRUPT|NOTADB|READONLY|CANTOPEN)|ENOSPC|EIO|EROFS|EACCES|EPERM)/.test(
        code,
      )
    )
      return;
    this.failure = error instanceof Error ? error.message : String(error);
    try {
      writeFileSync(this.marker, JSON.stringify({ error: this.failure }), { flush: true });
    } catch {
      /* In-memory lock remains when storage itself cannot persist the marker. */
    }
  }
  async retry(store: Store) {
    const path = join(this.root, '.storage-probe-' + randomUUID());
    try {
      if (store.db.pragma('quick_check', { simple: true }) !== 'ok')
        throw Error('資料庫完整性檢查失敗');
      store.db.exec('CREATE TABLE IF NOT EXISTS storage_probe(id INTEGER PRIMARY KEY,value TEXT)');
      store.db.transaction(() =>
        store.db
          .prepare(
            'INSERT INTO storage_probe VALUES(1,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value',
          )
          .run(randomUUID()),
      )();
      const f = await open(path, 'wx');
      try {
        await f.writeFile('probe');
        await f.sync();
      } finally {
        await f.close();
      }
      await unlink(path);
      if (existsSync(this.marker)) unlinkSync(this.marker);
      this.failure = null;
      return this.status();
    } catch (e) {
      this.failure = e instanceof Error ? e.message : String(e);
      throw e;
    } finally {
      await unlink(path).catch(() => {});
    }
  }
}
