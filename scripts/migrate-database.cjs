const { Client } = require('pg');

const sourceDB = 'postgresql://neondb_owner:npg_cJEsQ16HheMp@ep-floral-recipe-ad0eixx0-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require';
const targetDB = 'postgresql://neondb_owner:npg_pjzU9ZSceH4X@ep-little-heart-ah2lpao0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function migrate() {
  const source = new Client({ connectionString: sourceDB });
  const target = new Client({ connectionString: targetDB });

  console.log('Connecting to databases...');
  await source.connect();
  await target.connect();

  // Get all tables (excluding migrations)
  const { rows: tables } = await source.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_type = 'BASE TABLE'
    AND table_name NOT LIKE 'payload_migrations%'
    ORDER BY table_name
  `);

  console.log(`Found ${tables.length} tables to migrate`);

  // First, truncate ALL tables with CASCADE to clear FK dependencies
  console.log('Clearing target tables...');
  for (const { table_name } of tables) {
    try {
      await target.query(`TRUNCATE "${table_name}" CASCADE`);
    } catch (e) {
      // Ignore if table doesn't exist
    }
  }

  let migrated = 0;
  let skipped = 0;
  let errors = [];

  console.log('Copying data...');
  for (const { table_name } of tables) {
    try {
      // Get all data from source
      const { rows: data } = await source.query(`SELECT * FROM "${table_name}"`);

      if (data.length === 0) {
        skipped++;
        continue;
      }

      // Get column names
      const columns = Object.keys(data[0]);
      const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
      const columnNames = columns.map(c => `"${c}"`).join(', ');

      // Insert data
      for (const row of data) {
        const values = columns.map(c => row[c]);
        try {
          await target.query(
            `INSERT INTO "${table_name}" (${columnNames}) VALUES (${placeholders})`,
            values
          );
        } catch (insertErr) {
          // Skip duplicate key errors silently
          if (!insertErr.message.includes('duplicate key')) {
            throw insertErr;
          }
        }
      }

      console.log(`  ✓ ${table_name}: ${data.length} rows`);
      migrated++;
    } catch (e) {
      console.log(`  ✗ ${table_name}: ${e.message}`);
      errors.push({ table: table_name, error: e.message });
    }
  }

  // Update sequences
  console.log('Updating sequences...');
  const { rows: sequences } = await source.query(`
    SELECT sequence_name FROM information_schema.sequences WHERE sequence_schema = 'public'
  `);

  for (const { sequence_name } of sequences) {
    try {
      const { rows: [{ last_value }] } = await source.query(`SELECT last_value FROM "${sequence_name}"`);
      await target.query(`SELECT setval('"${sequence_name}"', ${last_value}, true)`);
    } catch (e) {
      // Ignore sequence errors
    }
  }

  console.log(`\n========== Migration Summary ==========`);
  console.log(`  Migrated: ${migrated} tables`);
  console.log(`  Skipped (empty): ${skipped} tables`);
  console.log(`  Errors: ${errors.length} tables`);

  if (errors.length > 0) {
    console.log('\nFailed tables:');
    errors.forEach(e => console.log(`  - ${e.table}: ${e.error}`));
  }

  // Verify migration
  console.log('\nVerifying...');
  const srcCount = await source.query('SELECT COUNT(*) FROM videos');
  const tgtCount = await target.query('SELECT COUNT(*) FROM videos');
  console.log(`  Videos: source=${srcCount.rows[0].count}, target=${tgtCount.rows[0].count}`);

  await source.end();
  await target.end();
}

migrate().catch(e => {
  console.error('Migration failed:', e);
  process.exit(1);
});
