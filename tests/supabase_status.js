const assert=require('node:assert/strict');
process.env.SUPABASE_URL='https://qa.example.invalid';
process.env.SUPABASE_SERVICE_ROLE_KEY='fixture-service';
process.env.DATA_BACKEND='postgres';
let providerReady=true,publicBucket=false,databaseReady=true;
global.fetch=async()=>({ok:providerReady});
require.cache[require.resolve('@supabase/supabase-js')]={exports:{createClient:()=>({storage:{getBucket:async()=>({data:{public:publicBucket}})}})}};
require.cache[require.resolve('../server/db')]={exports:{db:{prepare:()=>({get:async()=>{if(!databaseReady)throw Error('private diagnostic');return {id:'fixture'}}})}}};
const {checkSupabaseHealth}=require('../server/supabase');
(async()=>{
 const connected=await checkSupabaseHealth();assert.equal(connected.connected,true);assert.equal(connected.backend,'postgres');assert.equal(connected.storageReady,true);assert.ok(!connected.message.includes('SQLite'));
 publicBucket=true;assert.equal((await checkSupabaseHealth()).connected,false);
 publicBucket=false;providerReady=false;assert.equal((await checkSupabaseHealth()).connected,false);
 providerReady=true;databaseReady=false;const down=await checkSupabaseHealth();assert.equal(down.connected,false);assert.ok(!JSON.stringify(down).includes('private diagnostic'));
 console.log('PASS connection status: selected PostgreSQL backend, auth, private storage and sanitized failures.');
})().catch(error=>{console.error(error);process.exitCode=1});
