import * as migration_20251107_183848_initial from './20251107_183848_initial';
import * as migration_20251216_193419 from './20251216_193419';
import * as migration_20251216_203933 from './20251216_203933';
import * as migration_20251217_025119 from './20251217_025119';
import * as migration_20251222_182129_add_is_admin from './20251222_182129_add_is_admin';
import * as migration_20251226_151328 from './20251226_151328';
import * as migration_20251226_185357 from './20251226_185357';
import * as migration_20251226_215114 from './20251226_215114';
import * as migration_20251227_030959 from './20251227_030959';
import * as migration_20251228_170104_add_user_role from './20251228_170104_add_user_role';
import * as migration_20251228_192023 from './20251228_192023';
import * as migration_20251230_221025_audit_and_smart_automation from './20251230_221025_audit_and_smart_automation';
import * as migration_20251230_fix_typos from './20251230_fix_typos';
import * as migration_20251230_222500_add_conflicts from './20251230_222500_add_conflicts';
import * as migration_20251230_223100_add_category_arrays from './20251230_223100_add_category_arrays';
import * as migration_20251230_224500_fix_missing_unmatched_ingredients from './20251230_224500_fix_missing_unmatched_ingredients';

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
    name: '20251226_185357',
  },
  {
    up: migration_20251226_215114.up,
    down: migration_20251226_215114.down,
    name: '20251226_215114',
  },
  {
    up: migration_20251227_030959.up,
    down: migration_20251227_030959.down,
    name: '20251227_030959',
  },
  {
    up: migration_20251228_170104_add_user_role.up,
    down: migration_20251228_170104_add_user_role.down,
    name: '20251228_170104_add_user_role',
  },
  {
    up: migration_20251228_192023.up,
    down: migration_20251228_192023.down,
    name: '20251228_192023',
  },
  {
    up: migration_20251230_221025_audit_and_smart_automation.up,
    down: migration_20251230_221025_audit_and_smart_automation.down,
    name: '20251230_221025_audit_and_smart_automation',
  },
  {
    up: migration_20251230_fix_typos.up,
    down: migration_20251230_fix_typos.down,
    name: '20251230_fix_typos'
  },
  {
    up: migration_20251230_222500_add_conflicts.up,
    down: migration_20251230_222500_add_conflicts.down,
    name: '20251230_222500_add_conflicts'
  },
  {
    up: migration_20251230_223100_add_category_arrays.up,
    down: migration_20251230_223100_add_category_arrays.down,
    name: '20251230_223100_add_category_arrays'
  },
  {
    up: migration_20251230_224500_fix_missing_unmatched_ingredients.up,
    down: migration_20251230_224500_fix_missing_unmatched_ingredients.down,
    name: '20251230_224500_fix_missing_unmatched_ingredients'
  },
];
