import fs from 'fs';
import path from 'path';
import { pool } from './index';

export async function runMigrations() {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');

  console.log('Running database schema migration...');
  const client = await pool.connect();
  try {
    await client.query(sql);
    // Safe column additions for existing profiles table
    await client.query(`
      ALTER TABLE profiles ADD COLUMN IF NOT EXISTS reports_to_id UUID REFERENCES profiles(id) ON DELETE SET NULL;
      ALTER TABLE profiles ADD COLUMN IF NOT EXISTS department TEXT NULL;
      ALTER TABLE profiles ADD COLUMN IF NOT EXISTS title TEXT NULL;

      CREATE TABLE IF NOT EXISTS user_archived_requisitions (
        user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        requisition_id UUID NOT NULL REFERENCES requisitions(id) ON DELETE CASCADE,
        archived_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (user_id, requisition_id)
      );
      CREATE INDEX IF NOT EXISTS idx_user_archived_requisitions_user ON user_archived_requisitions(user_id);
    `);
    console.log('Database migration completed successfully.');
  } catch (error) {
    console.error('Database migration failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  runMigrations()
    .then(async () => {
      await pool.end();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error(err);
      await pool.end();
      process.exit(1);
    });
}
