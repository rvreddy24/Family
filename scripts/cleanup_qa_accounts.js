// Removes only identities and synthetic records from this run's private QA manifest.
require('dotenv').config({quiet:true});
process.env.DATA_BACKEND='postgres';
const fs=require('node:fs');
const path=require('node:path');
const data=require('../server/db');
const {supabaseAdmin}=require('../server/supabase');
async function main(){
 const filename=path.resolve('artifacts/live-qa-accounts.json');
 const manifest=JSON.parse(fs.readFileSync(filename,'utf8'));
 if(!/^qa_\d+$/.test(manifest.runId)||!Array.isArray(manifest.accounts)||manifest.accounts.length!==3)throw Error('Invalid QA manifest.');
 if(manifest.cleanedAt){console.log('QA cleanup was already completed.');await data.closeDatabase();return;}
 const ids=manifest.accounts.map(a=>a.userId);
 const slots=ids.map(()=>'?').join(',');
 try{
  // Check every identity before any mutation; pre-existing owner accounts never match.
  for(const account of manifest.accounts){
   if(account.email!==`familyhubs.${manifest.runId}.${account.role.toLowerCase()}@example.com`)throw Error('Unexpected QA account.');
   const user=await data.getUserById(account.userId);
   if(user&&(user.email!==account.email||user.auth_provider_id!==account.authId))throw Error('QA identity mismatch.');
   const identity=await supabaseAdmin.auth.admin.getUserById(account.authId);
   if(identity.error&&identity.error.status!==404)throw Error('QA provider identity could not be checked.');
   if(identity.data?.user&&(identity.data.user.email!==account.email||identity.data.user.user_metadata?.qa_run!==manifest.runId))throw Error('QA provider identity mismatch.');
  }
  const uploads=await data.db.prepare(`SELECT path FROM private_uploads WHERE owner IN (${slots})`).all(...ids);
  const names=manifest.cleanupUploads||uploads.map(row=>path.basename(row.path));
  if(names.some(name=>!(/^[a-f0-9-]+\.(png|jpg)$/.test(name))))throw Error('Unexpected QA proof path.');
  manifest.cleanupUploads=names;fs.writeFileSync(filename,JSON.stringify(manifest,null,2),{mode:0o600});
  const related=[];
  for(const table of ['parents_profile','tasks','emergency_events']){
   const filter=table==='parents_profile'?`client_id IN (${slots})`:table==='tasks'?`client_id IN (${slots})`:`parent_id IN (SELECT id FROM parents_profile WHERE client_id IN (${slots}))`;
   related.push(...(await data.db.prepare(`SELECT id FROM ${table} WHERE ${filter}`).all(...ids)).map(row=>row.id));
  }
  await data.transact(async()=>{
   for(const table of ['task_reviews','verification_logs','whatsapp_logs','escrow_transactions'])await data.db.prepare(`DELETE FROM ${table} WHERE task_id IN (SELECT id FROM tasks WHERE client_id IN (${slots}))`).run(...ids);
   await data.db.prepare(`DELETE FROM tasks WHERE client_id IN (${slots})`).run(...ids);
   await data.db.prepare(`DELETE FROM parents_profile WHERE client_id IN (${slots})`).run(...ids);
   await data.db.prepare(`DELETE FROM family_members WHERE client_id IN (${slots})`).run(...ids);
   for(const table of ['sessions','clients_profile','partners_profile'])await data.db.prepare(`DELETE FROM ${table} WHERE user_id IN (${slots})`).run(...ids);
   await data.db.prepare(`DELETE FROM private_uploads WHERE owner IN (${slots})`).run(...ids);
   await data.db.prepare(`DELETE FROM audit_logs WHERE actor_id IN (${slots})`).run(...ids);
   for(const id of related)await data.db.prepare('DELETE FROM audit_logs WHERE details_json LIKE ?').run('%'+id+'%');
   await data.db.prepare(`DELETE FROM users WHERE id IN (${slots})`).run(...ids);
  });
  if(names.length){
   const removed=await supabaseAdmin.storage.from(process.env.PRIVATE_STORAGE_BUCKET||'familyhubs-proofs').remove(names);
   if(removed.error)throw Error('QA photo cleanup failed.');
  }
  for(const account of manifest.accounts){const result=await supabaseAdmin.auth.admin.deleteUser(account.authId);if(result.error&&result.error.status!==404)throw Error('QA identity cleanup failed.');delete account.password;}
  manifest.cleanedAt=new Date().toISOString();fs.writeFileSync(filename,JSON.stringify(manifest,null,2),{mode:0o600});
  console.log('Removed all three QA accounts and their synthetic care records, sessions and private photos. Owner records preserved.');
 }finally{await data.closeDatabase()}
}
main().catch(()=>{console.error('QA cleanup needs attention. No owner records were selected; consult the private manifest.');process.exitCode=1});
