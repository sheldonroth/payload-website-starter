import * as migration_20251107_183848_initial from './20251107_183848_initial';
import * as migration_20251216_193419 from './20251216_193419';

export const migrations = [
  {
    up: migration_20251107_183848_initial.up,
    down: migration_20251107_183848_initial.down,
    name: '20251107_183848_initial',
  },
  {
    up: migration_20251216_193419.up,
    down: migration_20251216_193419.down,
    name: '20251216_193419'
  },
];
