import { join } from 'node:path';
import { Store } from '../../src/main/store';
import { Catalog } from '../../src/main/catalog';
import { Versions } from '../../src/main/versions';
import { Operations } from '../../src/main/operations';
const [data, id, point] = process.argv.slice(2),
  store = new Store(join(data, 'catalog.sqlite')),
  catalog = new Catalog(store, data),
  versions = new Versions(store, catalog, data);
const ops = new Operations(store, catalog, versions, data, (p, i) => {
  if (p === point && (i === 0 || i === -1)) process.exit(77);
});
void ops
  .execute(id, 'apply')
  .then(() => process.exit(0))
  .catch(() => process.exit(2));
