import * as migration_20251107_183848_initial from './20251107_183848_initial';
import * as migration_20251216_193419 from './20251216_193419';
import * as migration_20251216_203933 from './20251216_203933';
import * as migration_20251217_025119 from './20251217_025119';
import * as migration_20251222_182129_add_is_admin from './20251222_182129_add_is_admin';
import * as migration_20251226_151328 from './20251226_151328';
import * as migration_20251226_185357 from './20251226_185357';

export const migrations = [
  {
    up: migration_20251107_183848_initial.up,
    down: migration_20251107_183848_initial.down,
    name: '20251107_183848_initial',
  },
  {
    up: migration_20251216_193419.up,
    down: migration_20251216_193419.down,
    name: '20251216_193419',
  },
  {
    up: migration_20251216_203933.up,
    down: migration_20251216_203933.down,
    name: '20251216_203933',
  },
  {
    up: migration_20251217_025119.up,
    down: migration_20251217_025119.down,
    name: '20251217_025119',
  },
  {
    up: migration_20251222_182129_add_is_admin.up,
    down: migration_20251222_182129_add_is_admin.down,
    name: '20251222_182129_add_is_admin',
  },
  {
    up: migration_20251226_151328.up,
    down: migration_20251226_151328.down,
    name: '20251226_151328',
  },
  {
    up: migration_20251226_185357.up,
    down: migration_20251226_185357.down,
    name: '20251226_185357'
  },
];
