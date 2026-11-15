const assert=require('node:assert/strict');
process.env.DATA_BACKEND='postgres';
let bucketResult={data:{public:false}},downloadResult={},created=0;
const storage={
 getBucket:async()=>bucketResult,
 createBucket:async(_name,options)=>{assert.equal(options.public,false);created++;return {}},
 from:()=>({download:async()=>downloadResult,upload:async()=>({})}),
};
require.cache[require.resolve('../server/supabase')]={exports:{supabaseAdmin:{storage}}};
const files=require('../server/private-storage');
(async()=>{
 await files.init();assert.equal(created,0);
 bucketResult={error:{statusCode:'404'}};await files.init();assert.equal(created,1);
 bucketResult={error:{statusCode:'503'}};await assert.rejects(files.init);assert.equal(created,1);
 bucketResult={data:{public:true}};await assert.rejects(files.init);
 downloadResult={error:{statusCode:'404'}};assert.equal(await files.get('missing'),null);
 downloadResult={error:{statusCode:'503'}};await assert.rejects(()=>files.get('unavailable'));
 downloadResult={data:new Blob(['private proof'])};assert.equal((await files.get('proof')).toString(),'private proof');
 console.log('PASS private storage: private bucket enforcement, creation, missing files and service failures.');
})().catch(error=>{console.error(error);process.exitCode=1});
