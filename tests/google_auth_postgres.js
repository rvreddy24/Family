const {PGlite}=require('@electric-sql/pglite');
const adapter=require('../server/postgres-db');
(async()=>{
 const pg=new PGlite();
 await pg.exec('CREATE ROLE anon; CREATE ROLE authenticated;');
 const query=async(sql,params)=>{
  const result=(!params&&sql.includes(';'))?(await pg.exec(sql)).at(-1):await pg.query(sql,params);
  return {...result,rowCount:result.affectedRows||0};
 };
 const client={query,release(){}};
 adapter.connect=()=>adapter.createDatabase({query,connect:async()=>client,end:()=>pg.close()});
 process.env.DATA_BACKEND='postgres';
 require('./google_auth');
})().catch(error=>{console.error(error);process.exitCode=1});
