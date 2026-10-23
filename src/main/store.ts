import Database from 'better-sqlite3';
import type { Snapshot } from '../shared/contracts';
export class Store {
  readonly db: Database.Database;
  constructor(private readonly path: string) {
    this.db = new Database(path);
    try {
      this.db.pragma('journal_mode = WAL');
      this.db.pragma('synchronous = FULL');
      this.db.pragma('foreign_keys = ON');
      const s = this.settings();
      if (s.journal !== 'wal' || s.synchronous !== 2 || s.foreignKeys !== 1)
        throw new Error('SQLite 設定驗證失敗');
      const version = this.db.pragma('user_version', { simple: true }) as number;
      if (version > 1) throw new Error('資料庫版本較新，請使用相符版本的工具');
      if (version === 0)
        this.db.transaction(() => {
          this.db.exec(
            'CREATE TABLE poc_note(id INTEGER PRIMARY KEY CHECK(id=1), note TEXT NOT NULL, updated_at TEXT NOT NULL); PRAGMA user_version=1',
          );
        })();
    } catch (e) {
      this.db.close();
      throw e;
    }
  }
  settings() {
    return {
      journal: this.db.pragma('journal_mode', { simple: true }) as string,
      synchronous: this.db.pragma('synchronous', { simple: true }) as number,
      foreignKeys: this.db.pragma('foreign_keys', { simple: true }) as number,
    };
  }
  load(): Snapshot {
    const row = this.db.prepare('SELECT note, updated_at FROM poc_note WHERE id=1').get() as
      { note: string; updated_at: string } | undefined;
    return {
      note: row?.note ?? '',
      updatedAt: row?.updated_at ?? null,
      database: this.path,
      settings: this.settings(),
    };
  }
  save(note: unknown): Snapshot {
    if (typeof note !== 'string' || note.length > 2000) throw new Error('測試文字最多 2000 字');
    this.db.transaction(() => {
      this.db
        .prepare(
          'INSERT INTO poc_note VALUES(1,?,?) ON CONFLICT(id) DO UPDATE SET note=excluded.note,updated_at=excluded.updated_at',
        )
        .run(note, new Date().toISOString());
    })();
    return this.load();
  }
  close() {
    this.db.close();
  }
}
