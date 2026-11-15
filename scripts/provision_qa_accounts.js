// Explicit operator QA setup. Credentials remain in ignored artifacts, never stdout.
require('dotenv').config({quiet:true});
process.env.DATA_BACKEND='postgres';
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {supabaseAdmin}=require('../server/supabase');
const data=require('../server/db');
async function main(){
 const filename=path.resolve(__dirname,'../artifacts/live-qa-accounts.json');
 if(fs.existsSync(filename))throw Error('QA account manifest already exists; reuse or clean it first.');
 const manifest={runId:'qa_'+Date.now(),base:'https://familyhubs.in',accounts:[]};
 fs.mkdirSync(path.dirname(filename),{recursive:true});
 const save=()=>fs.writeFileSync(filename,JSON.stringify(manifest,null,2),{mode:0o600});
 save();
 try{
  for(const role of ['CLIENT','ADMIN','PARTNER']){
   const email=`familyhubs.${manifest.runId}.${role.toLowerCase()}@example.com`;
   const password=crypto.randomBytes(24).toString('base64url')+'aA1!';
   const fullName=`QA TEST ${role} ${manifest.runId}`;
   const {data:identity,error}=await supabaseAdmin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{full_name:fullName,requested_role:role,qa_run:manifest.runId,phone:'0000000000'}});
   if(error||!identity.user)throw Error('Could not provision QA identity.');
   const account={role,email,password,authId:identity.user.id};
   manifest.accounts.push(account);save();
   if(role==='ADMIN')await data.db.prepare('INSERT INTO users (id,role,email,phone,full_name,auth_provider_id) VALUES (?,?,?,?,?,?)').run(identity.user.id,role,email,'0000000000',fullName,identity.user.id);
   else if(role==='CLIENT')await data.registerClientAccount({email,fullName,phone:'0000000000',authProviderId:identity.user.id,countryResidence:'India',subscriptionTier:'NONE'});
   else await data.registerPartnerAccount({email,fullName,phone:'0000000000',authProviderId:identity.user.id,serviceCategory:'ERRANDS',operatingRegion:'QA TEST Hyderabad'});
   account.userId=(await data.getUserByEmail(email)).id;save();
  }
  console.log('Provisioned 3 isolated QA accounts. Credentials saved only in ignored artifacts/live-qa-accounts.json.');
 }finally{await data.closeDatabase()}
}
main().catch(()=>{console.error('QA provisioning failed. Inspect the private manifest for partial setup; no credentials were printed.');process.exitCode=1});
