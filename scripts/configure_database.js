// Called by configure_database.ps1. The password arrives through stdin, never argv.
const fs = require('node:fs');
const path = require('node:path');
const { Pool } = require('pg');
async function main() {
  let password = '';
  for await (const chunk of process.stdin) password += chunk;
  if (!password) throw new Error('empty password');
  const uri = new URL('postgresql://postgres.afuzvijsaubndtgwirrs@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres');
  uri.password = password;
  password = '';
  const ca = fs.readFileSync(path.resolve(__dirname, '../server/certs/supabase-ca.crt'), 'utf8');
  const pool = new Pool({ connectionString: uri.toString(), ssl: { rejectUnauthorized: true, ca }, max: 1, connectionTimeoutMillis: 15000 });
  try { await pool.query('SELECT 1'); } finally { await pool.end(); }
  const filename = path.resolve(__dirname, '../.env');
  const original = fs.existsSync(filename) ? fs.readFileSync(filename, 'utf8') : '';
  const entry = `DATABASE_URL=${JSON.stringify(uri.toString())}`;
  const updated = /^DATABASE_URL\s*=/m.test(original)
    ? original.replace(/^DATABASE_URL\s*=.*$/gm, () => entry)
    : original.replace(/\s*$/, '') + '\n' + entry + '\n';
  const temporary = filename + '.database-setup.tmp';
  try { fs.writeFileSync(temporary, updated, { mode: 0o600 }); fs.renameSync(temporary, filename); }
  finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
  console.log('Database connection verified and saved privately in .env. You can return to Codex.');
}
main().catch((error) => {
  const reasons = { '28P01': 'Database password was rejected.', SELF_SIGNED_CERT_IN_CHAIN: 'The database certificate could not be verified.', ENOTFOUND: 'The database hostname could not be reached.', ETIMEDOUT: 'The database connection timed out.', ECONNREFUSED: 'The database refused the connection.' };
  if (reasons[error.code]) console.error(reasons[error.code]);
  console.error('Connection could not be verified. Nothing was saved. Check your database password and network, then retry.');
  process.exitCode = 1;
});
