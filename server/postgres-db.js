const {Pool}=require('pg');
const fs=require('node:fs');
const path=require('node:path');
const {AsyncLocalStorage}=require('node:async_hooks');
const tables=['users','clients_profile','parents_profile','partners_profile','tasks','escrow_transactions','verification_logs','whatsapp_logs','audit_logs','security_settings','parent_vitals','parent_medications','medical_vault_documents','emergency_events','task_reviews','family_members','email_otps','sessions','private_uploads','google_oauth_flows'];
function sqlForPostgres(input){
 let sql=input.replace(/datetime\('now'\)/gi,'CURRENT_TIMESTAMP').replace(/\bDATETIME\b/gi,'TIMESTAMPTZ');
 sql=sql.replace(/\b(expires) INTEGER\b/g,'$1 BIGINT');
 const ignore=/INSERT OR IGNORE/i.test(sql),replace=/INSERT OR REPLACE/i.test(sql);
 sql=sql.replace(/INSERT OR (?:IGNORE|REPLACE)/gi,'INSERT');
 if(ignore)sql=sql.trim().replace(/;$/,'')+' ON CONFLICT DO NOTHING';
 if(replace){
  const match=sql.match(/INSERT INTO (\w+)\s*\(([^)]+)\)/i);
  if(!match)throw Error('Unsupported upsert statement.');
  const columns=match[2].split(',').map(x=>x.trim());
  const key=match[1]==='security_settings'?'key':match[1]==='task_reviews'?'task_id':'id';
  sql=sql.trim().replace(/;$/,'')+` ON CONFLICT (${key}) DO UPDATE SET `+columns.filter(x=>x!==key).map(x=>`${x}=EXCLUDED.${x}`).join(',');
 }
 // Prefix identifiers without changing string literals (for example audit text).
 sql=sql.replace(/'(?:''|[^'])*'|\b\w+\b/g,word=>tables.includes(word)?'fh_'+word:word);
 let quoted=false,index=0,result='';
 for(let i=0;i<sql.length;i++){
  const char=sql[i];
  if(char==="'" && quoted && sql[i+1]==="'"){result+="''";i++;continue}
  if(char==="'")quoted=!quoted;
  result+=char==='?'&&!quoted?'$'+(++index):char;
 }
 return result;
}
function createDatabase(pool){
 const context=new AsyncLocalStorage();
 const execute=(sql,values)=> (context.getStore()||pool).query(sqlForPostgres(sql),values);
 return {
  open:true,
  pragma(){},
  async exec(sql){
    let translated=sqlForPostgres(sql);
    if(/CREATE TABLE/i.test(sql)){
      const guard=`DO $$ DECLARE target text; BEGIN FOREACH target IN ARRAY ARRAY[${tables.map(t=>`'fh_${t}'`).join(',')}] LOOP IF to_regclass('public.' || target) IS NOT NULL THEN EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',target); EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated',target); END IF; END LOOP; END $$;`;
      const client=context.getStore() || await pool.connect();
      const owned=!context.getStore();
      try {
        if(owned)await client.query('BEGIN');
        await client.query(translated+';'+guard);
        if(owned)await client.query('COMMIT');
      }catch(error){if(owned)await client.query('ROLLBACK');throw error}
      finally{if(owned)client.release()}
      return;
    }
    await (context.getStore()||pool).query(translated);
  },
  prepare(sql){return {
   async get(...values){return (await execute(sql,values)).rows[0]},
   async all(...values){return (await execute(sql,values)).rows},
   async run(...values){return {changes:(await execute(sql,values)).rowCount}},
  }},
  transaction(fn){return async(...args)=>{
   if(context.getStore())return fn(...args);
   const client=await pool.connect();
   try{await client.query('BEGIN');const result=await context.run(client,()=>fn(...args));await client.query('COMMIT');return result}
   catch(error){await client.query('ROLLBACK');throw error}finally{client.release()}
  }},
  async close(){this.open=false;await pool.end()},
  async lockTask(id){await execute('SELECT id FROM tasks WHERE id=? FOR UPDATE',[id])},
 };
}
function connect(){
 if(!process.env.DATABASE_URL)throw Error('DATABASE_URL must be configured for durable free hosting.');
 const connection=new URL(process.env.DATABASE_URL);
 for(const key of ['sslmode','sslcert','sslkey','sslrootcert'])connection.searchParams.delete(key);
 const ca=process.env.DATABASE_CA_CERT?.replace(/\\n/g,'\n') || (connection.hostname.endsWith('.supabase.com') || connection.hostname.endsWith('.supabase.co') ? fs.readFileSync(path.join(__dirname,'certs/supabase-ca.crt'),'utf8') : undefined);
 const ssl=process.env.DATABASE_SSL==='false' && process.env.NODE_ENV!=='production' ? false : {rejectUnauthorized:true,...(ca?{ca}:{})};
 return createDatabase(new Pool({connectionString:connection.toString(),max:4,connectionTimeoutMillis:10000,idleTimeoutMillis:30000,ssl}));
}
module.exports={connect,createDatabase,sqlForPostgres,tables};
