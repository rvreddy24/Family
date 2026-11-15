const {supabaseAdmin}=require('./supabase');
const bucket=process.env.PRIVATE_STORAGE_BUCKET || 'familyhubs-proofs';
function cloud(){return process.env.DATA_BACKEND==='postgres'}
function missing(error){return String(error?.statusCode || error?.status)==='404' || /^(Bucket|Object) not found$/i.test(error?.message || '')}
async function init(){
 if(!cloud())return;
 if(!supabaseAdmin)throw Error('Supabase Storage is required for cloud hosting.');
 const result=await supabaseAdmin.storage.getBucket(bucket);
 if(result.error){if(!missing(result.error))throw Error('Private file storage could not be checked.');const created=await supabaseAdmin.storage.createBucket(bucket,{public:false,fileSizeLimit:6000000,allowedMimeTypes:['image/jpeg','image/png']});if(created.error)throw Error('Private file storage could not be initialized.')}
 else if(result.data.public)throw Error('The proof storage bucket must be private.');
}
async function put(name,buffer,type){const {error}=await supabaseAdmin.storage.from(bucket).upload(name,buffer,{contentType:type,upsert:false});if(error)throw Error('Photo storage is unavailable. Please try again.')}
async function get(name){const {data,error}=await supabaseAdmin.storage.from(bucket).download(name);if(error){if(missing(error))return null;throw Error('Photo storage is unavailable. Please try again.')}return Buffer.from(await data.arrayBuffer())}
module.exports={init,put,get,cloud};
