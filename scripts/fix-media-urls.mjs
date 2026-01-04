#!/usr/bin/env node
/**
 * Fix Media URLs Script
 *
 * This script populates the missing URL fields in the media table
 * by matching filenames with Vercel Blob Storage URLs.
 */

import pg from 'pg';
import { list } from '@vercel/blob';

const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;
const DB_URL = process.env.POSTGRES_URL || 'postgresql://neondb_owner:REDACTED@ep-little-heart-ah2lpao0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

if (!BLOB_TOKEN) {
  console.error('ERROR: BLOB_READ_WRITE_TOKEN environment variable is required');
  process.exit(1);
}

async function getAllBlobs() {
  console.log('Fetching all blobs from Vercel Blob Storage...');
  const blobMap = new Map(); // filename -> { url, sizes: {} }

  let cursor = undefined;
  let totalBlobs = 0;

  do {
    const response = await list({ token: BLOB_TOKEN, cursor, limit: 1000 });

    for (const blob of response.blobs) {
      const pathname = blob.pathname;
      totalBlobs++;

      // Parse filename and size suffix
      // e.g., "filename-300x300.jpg" or "filename.jpg"
      const sizeMatch = pathname.match(/^(.+?)-(\d+x\d+)\.(\w+)$/);

      if (sizeMatch) {
        // This is a sized version: filename-WxH.ext
        const [, baseName, dimensions, ext] = sizeMatch;
        const originalFilename = `${baseName}.${ext}`;
        const sizeName = getSizeName(dimensions);

        if (!blobMap.has(originalFilename)) {
          blobMap.set(originalFilename, { url: null, sizes: {} });
        }
        blobMap.get(originalFilename).sizes[sizeName] = blob.url;
      } else {
        // This is the original file
        if (!blobMap.has(pathname)) {
          blobMap.set(pathname, { url: blob.url, sizes: {} });
        } else {
          blobMap.get(pathname).url = blob.url;
        }
      }
    }

    cursor = response.cursor;
    console.log(`  Processed ${totalBlobs} blobs...`);
  } while (cursor);

  console.log(`Found ${blobMap.size} unique media files with ${totalBlobs} total blobs`);
  return blobMap;
}

function getSizeName(dimensions) {
  // Map dimensions to Payload size names from Media.ts
  const sizeMap = {
    '300x300': 'thumbnail',
    '500x500': 'square',
    '600x600': 'small',
    '900x900': 'medium',
    '1400x1400': 'large',
    '1920x1920': 'xlarge',
    '1200x630': 'og',
  };

  // Also handle width-only sizes
  const widthMatch = dimensions.match(/^(\d+)/);
  if (widthMatch) {
    const width = parseInt(widthMatch[1]);
    if (width === 300) return 'thumbnail';
    if (width === 500) return 'square';
    if (width === 600) return 'small';
    if (width === 900) return 'medium';
    if (width === 1400) return 'large';
    if (width === 1920) return 'xlarge';
  }

  return sizeMap[dimensions] || null;
}

async function updateMediaUrls(blobMap) {
  console.log('\nConnecting to database...');
  const client = new pg.Client({ connectionString: DB_URL });
  await client.connect();

  try {
    // Get all media records with NULL url
    const res = await client.query('SELECT id, filename FROM media WHERE url IS NULL');
    console.log(`Found ${res.rows.length} media records with NULL urls`);

    let updated = 0;
    let notFound = 0;

    for (const row of res.rows) {
      const blobData = blobMap.get(row.filename);

      if (!blobData || !blobData.url) {
        console.log(`  ⚠ No blob found for: ${row.filename}`);
        notFound++;
        continue;
      }

      // Build update query
      const setClauses = ['url = $1'];
      const values = [blobData.url];
      let paramIndex = 2;

      // Add size URLs if available
      const sizeColumns = {
        thumbnail: 'sizes_thumbnail_url',
        square: 'sizes_square_url',
        small: 'sizes_small_url',
        medium: 'sizes_medium_url',
        large: 'sizes_large_url',
        xlarge: 'sizes_xlarge_url',
        og: 'sizes_og_url',
      };

      for (const [sizeName, columnName] of Object.entries(sizeColumns)) {
        if (blobData.sizes[sizeName]) {
          setClauses.push(`${columnName} = $${paramIndex}`);
          values.push(blobData.sizes[sizeName]);
          paramIndex++;
        }
      }

      values.push(row.id);

      const updateQuery = `UPDATE media SET ${setClauses.join(', ')} WHERE id = $${paramIndex}`;
      await client.query(updateQuery, values);

      updated++;
      console.log(`  ✓ Updated: ${row.filename}`);
    }

    console.log(`\n✅ Updated ${updated} media records`);
    if (notFound > 0) {
      console.log(`⚠ ${notFound} records had no matching blob`);
    }

  } finally {
    await client.end();
  }
}

async function main() {
  console.log('=== Fix Media URLs Script ===\n');

  const blobMap = await getAllBlobs();
  await updateMediaUrls(blobMap);

  console.log('\nDone!');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
