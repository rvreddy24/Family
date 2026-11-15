// Run only after DATABASE_URL is configured. Copies records; never deletes local data.
require('dotenv').config();
const path=require('path');
const fs=require('fs');
const Database=require('better-sqlite3');
async function main(){
 if(!process.env.DATABASE_URL)throw Error('Set DATABASE_URL locally before migration.');
 process.env.DATA_BACKEND='postgres';
 const cloud=require('../server/db-postgres');
 const local=new Database(process.env.LOCAL_DB_PATH || path.join(__dirname,'../server/familyhubs.db'),{readonly:true});
 try{
  local.exec('BEGIN');
  await cloud.initDatabase();await require('../server/access').install(require('express')());
  await require('../server/whatsapp').init();await require('../server/private-storage').init();
  // Upload files before publishing their metadata. Retries accept identical files only.
  if(local.prepare("SELECT name FROM sqlite_master WHERE name='private_uploads'").get()){
   const storage=require('../server/private-storage');
   for(const row of local.prepare('SELECT path FROM private_uploads').all()){
    const name=path.basename(row.path),file=path.join(__dirname,'../server/uploads',name);
    if(!fs.existsSync(file))throw Error('A referenced private photo is missing locally.');
    const content=fs.readFileSync(file),existing=await storage.get(name);
    if(existing){if(!existing.equals(content))throw Error('A remote private photo conflicts with local content.');}
    else await storage.put(name,content,name.endsWith('.png')?'image/png':'image/jpeg');
   }
  }
  const tables=['users','clients_profile','partners_profile','parents_profile','tasks','escrow_transactions','verification_logs','whatsapp_logs','security_settings','audit_logs','parent_vitals','parent_medications','medical_vault_documents','emergency_events','task_reviews','family_members','private_uploads'];
  let copied=0;
  await cloud.db.transaction(async()=>{
   for(const table of tables){
    if(!local.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(table))continue;
    const columns=await cloud.db.prepare('SELECT column_name FROM information_schema.columns WHERE table_schema=? AND table_name=?').all('public','fh_'+table);
    const allowed=new Set(columns.map(c=>c.column_name));
    for(const row of local.prepare(`SELECT * FROM ${table}`).all()){
     const keys=Object.keys(row).filter(key=>allowed.has(key));
     const result=await cloud.db.prepare(`INSERT OR IGNORE INTO ${table} (${keys.join(',')}) VALUES (${keys.map(()=>'?').join(',')})`).run(...keys.map(key=>row[key]));
     copied+=result.changes;
    }
   }
  })();
  local.exec('COMMIT');
  console.log(`Cloud migration completed: ${copied} new records copied. Local records preserved. Existing remote records were not overwritten.`);
 }finally{local.close();await cloud.closeDatabase()}
}
main().catch(()=>{console.error('Migration did not complete. Check database credentials and storage configuration locally; no secrets were printed.');process.exitCode=1});
