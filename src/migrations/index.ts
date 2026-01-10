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
import * as migration_20251230_000000_add_amazon_asin from './20251230_000000_add_amazon_asin';
import * as migration_20251231_215000_add_voting_to_user_submissions from './20251231_215000_add_voting_to_user_submissions';
import * as migration_20251231_216000_add_ingredient_watchlist from './20251231_216000_add_ingredient_watchlist';
import * as migration_20251231_240000_add_background_removed from './20251231_240000_add_background_removed';
import * as migration_20260101_000000_add_product_badges from './20260101_000000_add_product_badges';
import * as migration_20260101_000100_add_featured_product from './20260101_000100_add_featured_product';
import * as migration_20260101_010000_one_shot_engine from './20260101_010000_one_shot_engine';
import * as migration_20260101_020000_add_video_url from './20260101_020000_add_video_url';
import * as migration_20260101_030000_add_featured_product from './20260101_030000_add_featured_product';
import * as migration_20260102_010000_create_site_settings from './20260102_010000_create_site_settings';
import * as migration_20260102_000000_add_trending_fields from './20260102_000000_add_trending_fields';
import * as migration_20260102_020000_add_trending_news_rel from './20260102_020000_add_trending_news_rel';
import * as migration_20260102_030000_add_display_title from './20260102_030000_add_display_title';
import * as migration_20260102_040000_add_amazon_link_validation from './20260102_040000_add_amazon_link_validation';
import * as migration_20260103_000000_add_automation_thresholds from './20260103_000000_add_automation_thresholds';
import * as migration_20260103_010000_add_automation_thresholds_v2 from './20260103_010000_add_automation_thresholds_v2';
import * as migration_20260103_020000_zero_input_refactor from './20260103_020000_zero_input_refactor';
import * as migration_20260104_000000_fix_archetype_column_names from './20260104_000000_fix_archetype_column_names';
import * as migration_20260104_010000_create_product_votes from './20260104_010000_create_product_votes';
import * as migration_20260104_020000_create_push_tokens from './20260104_020000_create_push_tokens';
import * as migration_20260105_000000_remove_ingredients from './20260105_000000_remove_ingredients';
import * as migration_20260105_010000_add_missing_category_tables from './20260105_010000_add_missing_category_tables';
import * as migration_20260105_020000_add_missing_categories_columns from './20260105_020000_add_missing_categories_columns';
import * as migration_20260105_030000_add_feedback_collection from './20260105_030000_add_feedback_collection';
import * as migration_20260106_000000_add_referrals_collections from './20260106_000000_add_referrals_collections';
import * as migration_20260106_100000_fix_locked_docs_double_underscore from './20260106_100000_fix_locked_docs_double_underscore';
import * as migration_20260106_200000_scout_program_velocity_and_bounties from './20260106_200000_scout_program_velocity_and_bounties';
import * as migration_20260107_000000_add_email_collections from './20260107_000000_add_email_collections';
import * as migration_20260107_010000_add_content_collections from './20260107_010000_add_content_collections';
import * as migration_20260107_020000_fix_content_collection_columns from './20260107_020000_fix_content_collection_columns';
import * as migration_20260107_030000_add_referral_breakdown_table from './20260107_030000_add_referral_breakdown_table';
import * as migration_20260107_040000_fix_referral_and_fingerprint_columns from './20260107_040000_fix_referral_and_fingerprint_columns';
import * as migration_20260107_050000_fix_generated_content_columns from './20260107_050000_fix_generated_content_columns';
import * as migration_20260107_060000_fix_regulatory_changes_columns from './20260107_060000_fix_regulatory_changes_columns';
import * as migration_20260107_070000_fix_users_email_preferences_columns from './20260107_070000_fix_users_email_preferences_columns';
import * as migration_20260107_080000_add_pgvector_embeddings from './20260107_080000_add_pgvector_embeddings';
import * as migration_20260107_090000_update_embedding_dimension from './20260107_090000_update_embedding_dimension';
import * as migration_20260106_300000_enhance_feedback_user_attribution from './20260106_300000_enhance_feedback_user_attribution';
import * as migration_20260107_100000_scout_program_collections from './20260107_100000_scout_program_collections';
import * as migration_20260107_110000_add_performance_indexes from './20260107_110000_add_performance_indexes';
import * as migration_20260107_115000_create_contributor_profiles from './20260107_115000_create_contributor_profiles';
import * as migration_20260107_120000_rename_scout_to_contributor from './20260107_120000_rename_scout_to_contributor';
import * as migration_20260107_130000_add_product_votes_notification_columns from './20260107_130000_add_product_votes_notification_columns';
import * as migration_20260108_000000_add_search_queries from './20260108_000000_add_search_queries';
import * as migration_20260108_100000_fix_push_tokens_array_table from './20260108_100000_fix_push_tokens_array_table';
import * as migration_20260108_120000_fix_product_votes_contributor_fk from './20260108_120000_fix_product_votes_contributor_fk';
// Removed: migration_20260108_140000_rename_purchase_links_to_where_to_buy (reverted field rename)
import * as migration_20260110_000000_create_notification_templates from './20260110_000000_create_notification_templates';
import * as migration_20260110_010000_seed_notification_templates from './20260110_010000_seed_notification_templates';
import * as migration_20260110_020000_create_audit_logs from './20260110_020000_create_audit_logs';
import * as migration_20260110_030000_create_paywall_variants from './20260110_030000_create_paywall_variants';
import * as migration_20260110_031000_create_paywall_settings from './20260110_031000_create_paywall_settings';
import * as migration_20260110_040000_create_user_segments from './20260110_040000_create_user_segments';
import * as migration_20260110_050000_create_notification_engine from './20260110_050000_create_notification_engine';
import * as migration_20260110_000000_add_legal_framework from './20260110_000000_add_legal_framework';

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
    up: migration_20251230_000000_add_amazon_asin.up,
    down: migration_20251230_000000_add_amazon_asin.down,
    name: '20251230_000000_add_amazon_asin'
  },
  {
    up: migration_20251231_215000_add_voting_to_user_submissions.up,
    down: migration_20251231_215000_add_voting_to_user_submissions.down,
    name: '20251231_215000_add_voting_to_user_submissions'
  },
  {
    up: migration_20251231_216000_add_ingredient_watchlist.up,
    down: migration_20251231_216000_add_ingredient_watchlist.down,
    name: '20251231_216000_add_ingredient_watchlist'
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
  {
    up: migration_20260102_010000_create_site_settings.up,
    down: migration_20260102_010000_create_site_settings.down,
    name: '20260102_010000_create_site_settings'
  },
  {
    up: migration_20260102_000000_add_trending_fields.up,
    down: migration_20260102_000000_add_trending_fields.down,
    name: '20260102_000000_add_trending_fields'
  },
  {
    up: migration_20260102_020000_add_trending_news_rel.up,
    down: migration_20260102_020000_add_trending_news_rel.down,
    name: '20260102_020000_add_trending_news_rel'
  },
  {
    up: migration_20260102_030000_add_display_title.up,
    down: migration_20260102_030000_add_display_title.down,
    name: '20260102_030000_add_display_title'
  },
  {
    up: migration_20260102_040000_add_amazon_link_validation.up,
    down: migration_20260102_040000_add_amazon_link_validation.down,
    name: '20260102_040000_add_amazon_link_validation'
  },
  {
    up: migration_20260103_000000_add_automation_thresholds.up,
    down: migration_20260103_000000_add_automation_thresholds.down,
    name: '20260103_000000_add_automation_thresholds'
  },
  {
    up: migration_20260103_010000_add_automation_thresholds_v2.up,
    down: migration_20260103_010000_add_automation_thresholds_v2.down,
    name: '20260103_010000_add_automation_thresholds_v2'
  },
  {
    up: migration_20260103_020000_zero_input_refactor.up,
    down: migration_20260103_020000_zero_input_refactor.down,
    name: '20260103_020000_zero_input_refactor'
  },
  {
    up: migration_20260104_000000_fix_archetype_column_names.up,
    down: migration_20260104_000000_fix_archetype_column_names.down,
    name: '20260104_000000_fix_archetype_column_names'
  },
  {
    up: migration_20260104_010000_create_product_votes.up,
    down: migration_20260104_010000_create_product_votes.down,
    name: '20260104_010000_create_product_votes'
  },
  {
    up: migration_20260104_020000_create_push_tokens.up,
    down: migration_20260104_020000_create_push_tokens.down,
    name: '20260104_020000_create_push_tokens'
  },
  {
    up: migration_20260105_000000_remove_ingredients.up,
    down: migration_20260105_000000_remove_ingredients.down,
    name: '20260105_000000_remove_ingredients'
  },
  {
    up: migration_20260105_010000_add_missing_category_tables.up,
    down: migration_20260105_010000_add_missing_category_tables.down,
    name: '20260105_010000_add_missing_category_tables'
  },
  {
    up: migration_20260105_020000_add_missing_categories_columns.up,
    down: migration_20260105_020000_add_missing_categories_columns.down,
    name: '20260105_020000_add_missing_categories_columns'
  },
  {
    up: migration_20260105_030000_add_feedback_collection.up,
    down: migration_20260105_030000_add_feedback_collection.down,
    name: '20260105_030000_add_feedback_collection'
  },
  {
    up: migration_20260106_000000_add_referrals_collections.up,
    down: migration_20260106_000000_add_referrals_collections.down,
    name: '20260106_000000_add_referrals_collections'
  },
  {
    up: migration_20260106_100000_fix_locked_docs_double_underscore.up,
    down: migration_20260106_100000_fix_locked_docs_double_underscore.down,
    name: '20260106_100000_fix_locked_docs_double_underscore'
  },
  {
    up: migration_20260106_200000_scout_program_velocity_and_bounties.up,
    down: migration_20260106_200000_scout_program_velocity_and_bounties.down,
    name: '20260106_200000_scout_program_velocity_and_bounties'
  },
  {
    up: migration_20260107_000000_add_email_collections.up,
    down: migration_20260107_000000_add_email_collections.down,
    name: '20260107_000000_add_email_collections'
  },
  {
    up: migration_20260107_010000_add_content_collections.up,
    down: migration_20260107_010000_add_content_collections.down,
    name: '20260107_010000_add_content_collections'
  },
  {
    up: migration_20260107_020000_fix_content_collection_columns.up,
    down: migration_20260107_020000_fix_content_collection_columns.down,
    name: '20260107_020000_fix_content_collection_columns'
  },
  {
    up: migration_20260107_030000_add_referral_breakdown_table.up,
    down: migration_20260107_030000_add_referral_breakdown_table.down,
    name: '20260107_030000_add_referral_breakdown_table'
  },
  {
    up: migration_20260107_040000_fix_referral_and_fingerprint_columns.up,
    down: migration_20260107_040000_fix_referral_and_fingerprint_columns.down,
    name: '20260107_040000_fix_referral_and_fingerprint_columns'
  },
  {
    up: migration_20260107_050000_fix_generated_content_columns.up,
    down: migration_20260107_050000_fix_generated_content_columns.down,
    name: '20260107_050000_fix_generated_content_columns'
  },
  {
    up: migration_20260107_060000_fix_regulatory_changes_columns.up,
    down: migration_20260107_060000_fix_regulatory_changes_columns.down,
    name: '20260107_060000_fix_regulatory_changes_columns'
  },
  {
    up: migration_20260107_070000_fix_users_email_preferences_columns.up,
    down: migration_20260107_070000_fix_users_email_preferences_columns.down,
    name: '20260107_070000_fix_users_email_preferences_columns'
  },
  {
    up: migration_20260107_080000_add_pgvector_embeddings.up,
    down: migration_20260107_080000_add_pgvector_embeddings.down,
    name: '20260107_080000_add_pgvector_embeddings'
  },
  {
    up: migration_20260107_090000_update_embedding_dimension.up,
    down: migration_20260107_090000_update_embedding_dimension.down,
    name: '20260107_090000_update_embedding_dimension'
  },
  {
    up: migration_20260106_300000_enhance_feedback_user_attribution.up,
    down: migration_20260106_300000_enhance_feedback_user_attribution.down,
    name: '20260106_300000_enhance_feedback_user_attribution'
  },
  {
    up: migration_20260107_100000_scout_program_collections.up,
    down: migration_20260107_100000_scout_program_collections.down,
    name: '20260107_100000_scout_program_collections'
  },
  {
    up: migration_20260107_110000_add_performance_indexes.up,
    down: migration_20260107_110000_add_performance_indexes.down,
    name: '20260107_110000_add_performance_indexes'
  },
  {
    up: migration_20260107_115000_create_contributor_profiles.up,
    down: migration_20260107_115000_create_contributor_profiles.down,
    name: '20260107_115000_create_contributor_profiles'
  },
  {
    up: migration_20260107_120000_rename_scout_to_contributor.up,
    down: migration_20260107_120000_rename_scout_to_contributor.down,
    name: '20260107_120000_rename_scout_to_contributor'
  },
  {
    up: migration_20260107_130000_add_product_votes_notification_columns.up,
    down: migration_20260107_130000_add_product_votes_notification_columns.down,
    name: '20260107_130000_add_product_votes_notification_columns'
  },
  {
    up: migration_20260108_000000_add_search_queries.up,
    down: migration_20260108_000000_add_search_queries.down,
    name: '20260108_000000_add_search_queries'
  },
  {
    up: migration_20260108_100000_fix_push_tokens_array_table.up,
    down: migration_20260108_100000_fix_push_tokens_array_table.down,
    name: '20260108_100000_fix_push_tokens_array_table'
  },
  {
    up: migration_20260108_120000_fix_product_votes_contributor_fk.up,
    down: migration_20260108_120000_fix_product_votes_contributor_fk.down,
    name: '20260108_120000_fix_product_votes_contributor_fk'
  },
  {
    up: migration_20260110_000000_create_notification_templates.up,
    down: migration_20260110_000000_create_notification_templates.down,
    name: '20260110_000000_create_notification_templates'
  },
  {
    up: migration_20260110_010000_seed_notification_templates.up,
    down: migration_20260110_010000_seed_notification_templates.down,
    name: '20260110_010000_seed_notification_templates'
  },
  {
    up: migration_20260110_020000_create_audit_logs.up,
    down: migration_20260110_020000_create_audit_logs.down,
    name: '20260110_020000_create_audit_logs'
  },
  {
    up: migration_20260110_030000_create_paywall_variants.up,
    down: migration_20260110_030000_create_paywall_variants.down,
    name: '20260110_030000_create_paywall_variants'
  },
  {
    up: migration_20260110_031000_create_paywall_settings.up,
    down: migration_20260110_031000_create_paywall_settings.down,
    name: '20260110_031000_create_paywall_settings'
  },
  {
    up: migration_20260110_040000_create_user_segments.up,
    down: migration_20260110_040000_create_user_segments.down,
    name: '20260110_040000_create_user_segments'
  },
  {
    up: migration_20260110_050000_create_notification_engine.up,
    down: migration_20260110_050000_create_notification_engine.down,
    name: '20260110_050000_create_notification_engine'
  },
  {
    up: migration_20260110_000000_add_legal_framework.up,
    down: migration_20260110_000000_add_legal_framework.down,
    name: '20260110_000000_add_legal_framework'
  },
];

