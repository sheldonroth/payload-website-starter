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
import * as migration_20251230_225500_fix_locked_documents_rels from './20251230_225500_fix_locked_documents_rels';
import * as migration_20251231_000000_add_missing_ai_columns from './20251231_000000_add_missing_ai_columns';
import * as migration_20251231_010000_fix_locked_documents_global_slug from './20251231_010000_fix_locked_documents_global_slug';
import * as migration_20251231_203700_add_price_history_id from './20251231_203700_add_price_history_id';
import * as migration_20251231_204500_add_video_type from './20251231_204500_add_video_type';
import * as migration_20251231_205500_emergency_column_fix from './20251231_205500_emergency_column_fix';
import * as migration_20251231_210000_create_brands_user_submissions from './20251231_210000_create_brands_user_submissions';
import * as migration_20251231_220000_product_slug_unique from './20251231_220000_product_slug_unique';
import * as migration_20251231_230000_add_pages_blocks_stats from './20251231_230000_add_pages_blocks_stats';
import * as migration_20250101_000000_add_amazon_asin from './20250101_000000_add_amazon_asin';
import * as migration_20250101_000100_add_voting_to_user_submissions from './20250101_000100_add_voting_to_user_submissions';
import * as migration_20250101_000200_add_ingredient_watchlist from './20250101_000200_add_ingredient_watchlist';
import * as migration_20251231_240000_add_background_removed from './20251231_240000_add_background_removed';
import * as migration_20260101_000000_add_product_badges from './20260101_000000_add_product_badges';
import * as migration_20260101_000100_add_featured_product from './20260101_000100_add_featured_product';
import * as migration_20260101_010000_one_shot_engine from './20260101_010000_one_shot_engine';
import * as migration_20260101_020000_add_video_url from './20260101_020000_add_video_url';
import * as migration_20260101_030000_add_featured_product from './20260101_030000_add_featured_product';

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
  {
    up: migration_20251230_225500_fix_locked_documents_rels.up,
    down: migration_20251230_225500_fix_locked_documents_rels.down,
    name: '20251230_225500_fix_locked_documents_rels'
  },
  {
    up: migration_20251231_000000_add_missing_ai_columns.up,
    down: migration_20251231_000000_add_missing_ai_columns.down,
    name: '20251231_000000_add_missing_ai_columns'
  },
  {
    up: migration_20251231_010000_fix_locked_documents_global_slug.up,
    down: migration_20251231_010000_fix_locked_documents_global_slug.down,
    name: '20251231_010000_fix_locked_documents_global_slug'
  },
  {
    up: migration_20251231_203700_add_price_history_id.up,
    down: migration_20251231_203700_add_price_history_id.down,
    name: '20251231_203700_add_price_history_id'
  },
  {
    up: migration_20251231_204500_add_video_type.up,
    down: migration_20251231_204500_add_video_type.down,
    name: '20251231_204500_add_video_type'
  },
  {
    up: migration_20251231_205500_emergency_column_fix.up,
    down: migration_20251231_205500_emergency_column_fix.down,
    name: '20251231_205500_emergency_column_fix'
  },
  {
    up: migration_20251231_210000_create_brands_user_submissions.up,
    down: migration_20251231_210000_create_brands_user_submissions.down,
    name: '20251231_210000_create_brands_user_submissions'
  },
  {
    up: migration_20251231_220000_product_slug_unique.up,
    down: migration_20251231_220000_product_slug_unique.down,
    name: '20251231_220000_product_slug_unique'
  },
  {
    up: migration_20251231_230000_add_pages_blocks_stats.up,
    down: migration_20251231_230000_add_pages_blocks_stats.down,
    name: '20251231_230000_add_pages_blocks_stats'
  },
  {
    up: migration_20250101_000000_add_amazon_asin.up,
    down: migration_20250101_000000_add_amazon_asin.down,
    name: '20250101_000000_add_amazon_asin'
  },
  {
    up: migration_20250101_000100_add_voting_to_user_submissions.up,
    down: migration_20250101_000100_add_voting_to_user_submissions.down,
    name: '20250101_000100_add_voting_to_user_submissions'
  },
  {
    up: migration_20250101_000200_add_ingredient_watchlist.up,
    down: migration_20250101_000200_add_ingredient_watchlist.down,
    name: '20250101_000200_add_ingredient_watchlist'
  },
  {
    up: migration_20251231_240000_add_background_removed.up,
    down: migration_20251231_240000_add_background_removed.down,
    name: '20251231_240000_add_background_removed'
  },
  {
    up: migration_20260101_000000_add_product_badges.up,
    down: migration_20260101_000000_add_product_badges.down,
    name: '20260101_000000_add_product_badges'
  },
  {
    up: migration_20260101_000100_add_featured_product.up,
    down: migration_20260101_000100_add_featured_product.down,
    name: '20260101_000100_add_featured_product'
  },
  {
    up: migration_20260101_010000_one_shot_engine.up,
    down: migration_20260101_010000_one_shot_engine.down,
    name: '20260101_010000_one_shot_engine'
  },
  {
    up: migration_20260101_020000_add_video_url.up,
    down: migration_20260101_020000_add_video_url.down,
    name: '20260101_020000_add_video_url'
  },
  {
    up: migration_20260101_030000_add_featured_product.up,
    down: migration_20260101_030000_add_featured_product.down,
    name: '20260101_030000_add_featured_product'
  },
];
