const cloud = process.env.DATA_BACKEND === 'postgres';
const data = cloud ? require('./db-postgres') : require('./db-sqlite');
data.transact = cloud ? (fn)=>data.db.transaction(fn)() : async(fn)=>{
  data.db.exec('BEGIN IMMEDIATE');
  try {const value=await fn();data.db.exec('COMMIT');return value}
  catch(error){data.db.exec('ROLLBACK');throw error}
};
module.exports = data;
