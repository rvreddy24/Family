// Removes only known fixtures. Real accounts and their records are preserved.
require("dotenv").config();
const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");
async function main() {
  const db = new Database(
    process.env.DB_PATH || path.join(__dirname, "../server/familyhubs.db"),
  );
  db.pragma("foreign_keys=ON");
  const backupDir = path.join(__dirname, "../backups");
  fs.mkdirSync(backupDir, { recursive: true });
  const backup = path.join(backupDir, `before-demo-cleanup-${Date.now()}.db`);
  await db.backup(backup);
  const fixtures = db
    .prepare(
      "SELECT id FROM users WHERE id IN ('c11e4701-0000-4000-8000-000000000001','p11e4701-0000-4000-8000-000000000002') OR email LIKE 'parent.test.%@example.com'",
    )
    .all();
  db.transaction(() => {
    for (const { id } of fixtures) {
      db.prepare(
        "DELETE FROM task_reviews WHERE client_id=? OR partner_id=?",
      ).run(id, id);
      db.prepare(
        "DELETE FROM emergency_events WHERE triggered_by_user_id=? OR parent_id IN (SELECT id FROM parents_profile WHERE client_id=?)",
      ).run(id, id);
      db.prepare(
        "DELETE FROM tasks WHERE client_id=? OR assigned_partner_id=?",
      ).run(id, id);
      db.prepare("DELETE FROM users WHERE id=?").run(id);
    }
    db.prepare(
      "UPDATE security_settings SET value='' WHERE key='escrow_release_pin' AND value='849201'",
    ).run();
    // These exact identifiers and medical labels originate from the old seed routine.
    db.prepare(
      "DELETE FROM parents_profile WHERE parent_name='Aging Parents in India' AND primary_phone='+91 94401 23456' AND full_address='India' AND id NOT IN (SELECT parent_id FROM tasks)",
    ).run();
    db.prepare("DELETE FROM email_otps").run();
    if (
      db.prepare("SELECT name FROM sqlite_master WHERE name='sessions'").get()
    )
      db.prepare("DELETE FROM sessions").run();
  })();
  console.log(
    `Removed ${fixtures.length} fixture accounts. Backup saved locally. Real accounts preserved.`,
  );
  db.close();
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
