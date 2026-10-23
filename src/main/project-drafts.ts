import { randomUUID } from 'node:crypto';
import { detectGame } from './catalog';
import type { ProjectDraft } from '../shared/contracts';

/** Only paths selected by the native dialog can become creation candidates. */
export class ProjectDrafts {
  private draft: { token: string; game: Awaited<ReturnType<typeof detectGame>> } | null = null;
  clear() {
    this.draft = null;
  }
  async choose(path: string): Promise<ProjectDraft> {
    this.clear();
    const game = await detectGame(path),
      token = randomUUID();
    this.draft = { token, game };
    return {
      token,
      root: game.root,
      name: game.name,
      engine: game.engine,
      encrypted: !!game.encryptionKey,
    };
  }
  async consume(token: string) {
    const draft = this.draft;
    this.clear();
    if (!draft || draft.token !== token) throw Error('遊戲辨識已過期，請重新選擇資料夾');
    const current = await detectGame(draft.game.root);
    if (JSON.stringify(current) !== JSON.stringify(draft.game))
      throw Error('遊戲設定已變更，請重新選擇資料夾');
    return current.root;
  }
}
