// Explicit opt-in live QA. Reads locally provisioned, isolated test accounts.
// Never sends notifications, transfers money, or touches pre-existing care records.
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const WebSocket=require('ws');
const fixturePath=path.resolve(process.env.QA_ACCOUNTS_FILE||'artifacts/live-qa-accounts.json');
if(!fs.existsSync(fixturePath))throw Error('Provision the isolated QA accounts before running live checks.');
const fixture=JSON.parse(fs.readFileSync(fixturePath,'utf8'));
if(Array.isArray(fixture.accounts))fixture.accounts=Object.fromEntries(fixture.accounts.map(account=>[account.role,account]));
const base=process.env.QA_BASE_URL||'https://familyhubs.in';
const origin=new URL(base).origin;
const report={startedAt:new Date().toISOString(),base,runId:fixture.runId,checks:[],records:{parents:[],tasks:[],medications:[],documents:[],vitals:[],emergencies:[],family:[],uploads:[]}};
const reportPath=path.resolve('artifacts/live-qa-report-'+Date.now()+'.json');
const clients={};
function save(){fs.mkdirSync(path.dirname(reportPath),{recursive:true});fs.writeFileSync(reportPath,JSON.stringify(report,null,2),{mode:0o600})}
async function check(name,fn){try{await fn();report.checks.push({name,pass:true});console.log('PASS '+name)}catch(error){report.checks.push({name,pass:false,error:error.message});console.log('FAIL '+name+': '+error.message)}save()}
async function request(role,route,body,method){
 const headers={'Origin':origin,'X-FamilyHubs-Portal':role,...(clients[role]?.cookie?{Cookie:clients[role].cookie}:{}),...(body!==undefined?{'Content-Type':'application/json'}:{})};
 const verb=method||(body!==undefined?'POST':'GET');
 const perform=()=>fetch(base+route,{method:verb,headers,body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(30000),redirect:'manual'});
 let res;
 try{res=await perform()}catch(error){
  report.transportErrors||=[];report.transportErrors.push({role,route,method:verb,code:error.cause?.code||error.name});save();
  if(verb!=='GET')throw error;
  // A transport failure on GET is safe to retry once; record it rather than hide it.
  res=await perform();
 }
 const text=await res.text();let data;try{data=JSON.parse(text)}catch{data=null}
 return {status:res.status,data,headers:res.headers,text};
}
const code=(result,expected)=>assert.equal(result.status,expected,`HTTP status: expected ${expected}, received ${result.status}`);
const remember=(type,id)=>{if(id){report.records[type].push(id);save()}return id};
async function observeNextChange(role){
 const url=new URL('/ws/events',base);url.protocol=url.protocol==='https:'?'wss:':'ws:';url.searchParams.set('role',role);
 const ws=new WebSocket(url,{headers:{Origin:origin,Cookie:clients[role].cookie}});
 let resolveEvent;
 const event=new Promise(resolve=>{resolveEvent=resolve});
 const timer=setTimeout(()=>{ws.terminate();resolveEvent({timeout:true})},20000);
 ws.on('message',buffer=>{try{const value=JSON.parse(buffer);if(value.type==='CONNECTED')return;clearTimeout(timer);ws.close();resolveEvent(value)}catch{}});
 await new Promise((resolve,reject)=>{ws.once('open',resolve);ws.once('error',()=>{clearTimeout(timer);resolveEvent({error:true});reject(Error('WebSocket subscription failed'))})});
 return {event,close:()=>{clearTimeout(timer);ws.close()}};
}
async function main(){
 for(const role of ['CLIENT','ADMIN','PARTNER']){
  await check(role+' password login and secure session',async()=>{
   const account=fixture.accounts[role];assert.ok(account,'fixture account exists');
   const r=await request(role,'/api/auth/login',{email:account.email,password:account.password,role});code(r,200);
   const cookies=r.headers.getSetCookie();assert.ok(cookies.some(x=>/HttpOnly/i.test(x)&&/Secure/i.test(x)),'secure HttpOnly cookie');
   clients[role]={cookie:cookies.map(x=>x.split(';')[0]).join('; '),id:r.data.user.id};
   const me=await request(role,'/api/auth/me');code(me,200);assert.equal(me.data.user.role,role);
  });
 }
 if(Object.keys(clients).length!==3)return;
 await check('authenticated unknown API route returns JSON 404',async()=>{const r=await request('CLIENT','/api/qa-route-that-does-not-exist');code(r,404);assert.ok(r.headers.get('content-type')?.includes('application/json'))});
 await check('session refresh does not consume password-login rate limit',async()=>{for(let i=0;i<25;i++)code(await request('CLIENT','/api/auth/me'),200)});
 for(const role of ['CLIENT','ADMIN','PARTNER'])await check(role+' live WebSocket connects',()=>new Promise((resolve,reject)=>{
  const url=new URL('/ws/events',base);url.protocol=url.protocol==='https:'?'wss:':'ws:';url.searchParams.set('role',role);
  const ws=new WebSocket(url,{headers:{Origin:origin,Cookie:clients[role].cookie}});const timer=setTimeout(()=>{ws.terminate();reject(Error('WebSocket connection timed out'))},15000);
  ws.once('open',()=>{clearTimeout(timer);ws.close();resolve()});ws.once('error',()=>{clearTimeout(timer);reject(Error('WebSocket rejected connection'))});
 }));
 await check('client cannot access operations settings',async()=>code(await request('CLIENT','/api/security/settings'),403));
 await check('partner cannot enumerate parent directory',async()=>code(await request('PARTNER','/api/parents'),403));
 await check('role cookie cannot be reused as operations',async()=>{const r=await fetch(base+'/api/auth/me',{headers:{Cookie:clients.CLIENT.cookie,'X-FamilyHubs-Portal':'ADMIN'}});assert.equal(r.status,401)});
 let parentId,taskId,medId,proof,rejectedLogId;
 const parent={parentName:'QA TEST — '+fixture.runId,primaryPhone:'+910000000000',whatsappPhone:'',whatsappConsent:false,locality:'QA TEST Hyderabad',fullAddress:'QA TEST ONLY — no visit required',coordinatesLat:17.385,coordinatesLng:78.4867,medicalNotes:'Synthetic QA record. No real patient data.'};
 await check('family creates parent',async()=>{const r=await request('CLIENT','/api/parents',parent);code(r,201);parentId=remember('parents',r.data.id);assert.ok(parentId)});
 if(!parentId)return;
 await check('family reads its new parent',async()=>{const r=await request('CLIENT','/api/parents');code(r,200);assert.ok(r.data.some(x=>x.id===parentId))});
 await check('family edits parent and consent stays off',async()=>{const r=await request('CLIENT','/api/parents/'+parentId,{...parent,medicalNotes:parent.medicalNotes+' Updated.'},'PUT');code(r,200);assert.equal(r.data.medical_notes,parent.medicalNotes+' Updated.');assert.equal(r.data.whatsapp_consent,0)});
 await check('invalid health reading rejected',async()=>code(await request('CLIENT',`/api/parents/${parentId}/vitals`,{spo2:150}),400));
 await check('empty health reading rejected',async()=>code(await request('CLIENT',`/api/parents/${parentId}/vitals`,{}),400));
 await check('invalid blood sugar reading rejected',async()=>code(await request('CLIENT',`/api/parents/${parentId}/vitals`,{bloodSugar:-1,bloodSugarType:'FASTING'}),400));
 await check('family records health reading',async()=>{const r=await request('CLIENT',`/api/parents/${parentId}/vitals`,{bloodPressureSys:120,bloodPressureDia:80,pulse:72,spo2:98,notes:'QA TEST synthetic reading'});code(r,201);remember('vitals',r.data.id)});
 await check('health reading persists',async()=>{const r=await request('CLIENT',`/api/parents/${parentId}/vitals`);code(r,200);assert.ok(r.data.some(x=>report.records.vitals.includes(x.id)))});
 await check('family records medication with zero stock accurately',async()=>{const r=await request('CLIENT',`/api/parents/${parentId}/medications`,{medicineName:'QA TEST ONLY — synthetic medication',dosage:'Test record only',frequency:'Do not administer',stockRemaining:0,instructions:'Synthetic QA, no prescription'});code(r,201);medId=remember('medications',r.data.id);assert.equal(r.data.stock_remaining,0)});
 await check('family records secure document reference',async()=>{const r=await request('CLIENT',`/api/parents/${parentId}/documents`,{title:'QA TEST synthetic document reference',category:'OTHER',fileUrl:'https://example.com/qa-no-real-document',notes:'QA TEST ONLY'});code(r,201);remember('documents',r.data.id)});
 await check('document reference persists',async()=>{const r=await request('CLIENT',`/api/parents/${parentId}/documents`);code(r,200);assert.ok(r.data.some(x=>report.records.documents.includes(x.id)))});
 await check('invalid document category rejected',async()=>code(await request('CLIENT',`/api/parents/${parentId}/documents`,{title:'QA invalid category',category:'INVALID',fileUrl:'https://example.com/qa'}),400));
 await check('family cannot refill missing medication',async()=>{const r=await request('CLIENT',`/api/parents/${parentId}/medications/qa-missing/refill`,{});assert.ok([403,404].includes(r.status),'missing medication is rejected')});
 await check('operations cannot refill missing medication',async()=>{const r=await request('ADMIN',`/api/parents/${parentId}/medications/qa-missing/refill`,{clientId:clients.CLIENT.id});remember('tasks',r.data?.task?.id);code(r,404)});
 const changes={};
 for(const role of ['CLIENT','ADMIN','PARTNER'])await check(role+' subscribes to care changes',async()=>{changes[role]=await observeNextChange(role)});
 await check('family creates care request',async()=>{const r=await request('CLIENT','/api/tasks',{parentId,category:'ERRANDS',title:'QA TEST ONLY — '+fixture.runId,instructions:'Synthetic test; do not dispatch a real visit or contact anyone.',scheduledAt:new Date(Date.now()+86400000).toISOString()});code(r,201);taskId=remember('tasks',r.data.id);assert.equal(r.data.status,'PENDING_OPS_REVIEW')});
 for(const role of Object.keys(changes))await check(role+' receives scoped real-time care update',async()=>{const event=await changes[role].event;changes[role].close();assert.equal(event.type,role==='ADMIN'?'TASK_CREATED':'DATA_CHANGED');if(role!=='ADMIN')assert.equal(event.payload,undefined);else assert.equal(event.payload.id,taskId)});
 if(!taskId)return;
 await check('partner cannot view unassigned request',async()=>code(await request('PARTNER','/api/tasks/'+taskId),403));
 await check('operations sees family request',async()=>{const r=await request('ADMIN','/api/tasks/'+taskId);code(r,200);assert.equal(r.data.id,taskId)});
 await check('partner toggles duty on',async()=>code(await request('PARTNER',`/api/partners/${clients.PARTNER.id}/duty`,{isActive:true}),200));
 await check('operations verifies test partner',async()=>code(await request('ADMIN',`/api/partners/${clients.PARTNER.id}/verification`,{verified:true,notes:'QA TEST ONLY — synthetic test approval, not a real KYC decision'}),200));
 await check('operations assigns test partner',async()=>{const r=await request('ADMIN',`/api/tasks/${taskId}/assign`,{partnerId:clients.PARTNER.id});code(r,200);assert.equal(r.data.status,'DISPATCHED')});
 await check('partner sees assigned request',async()=>{const r=await request('PARTNER','/api/tasks');code(r,200);assert.ok(r.data.some(x=>x.id===taskId))});
 for(const role of ['CLIENT','ADMIN','PARTNER'])await check(role+' task list has usable task details',async()=>{const r=await request(role,'/api/tasks');code(r,200);const row=r.data.find(x=>x.id===taskId);assert.ok(row,'list contains task ID');assert.equal(row.status,'DISPATCHED');assert.equal(row.title,'QA TEST ONLY — '+fixture.runId);assert.equal(row.parent?.id,parentId);assert.equal(row.assigned_partner?.id,clients.PARTNER.id)});
 await check('partner accepts request',async()=>{const r=await request('PARTNER',`/api/tasks/${taskId}/accept`,{});code(r,200);assert.equal(r.data.status,'ACCEPTED')});
 await check('accept replay rejected',async()=>code(await request('PARTNER',`/api/tasks/${taskId}/accept`,{}),409));
 await check('legacy start cannot bypass arrival proof',async()=>code(await request('PARTNER',`/api/tasks/${taskId}/start`,{}),410));
 await check('partner updates own location',async()=>code(await request('PARTNER',`/api/partners/${clients.PARTNER.id}/location`,{latitude:parent.coordinatesLat,longitude:parent.coordinatesLng,taskId}),200));
 await check('assigned family reads location',async()=>{const r=await request('CLIENT',`/api/partners/${clients.PARTNER.id}/location`);code(r,200);assert.equal(r.data.latitude,parent.coordinatesLat)});
 await check('partner uploads synthetic private proof',async()=>{const r=await request('PARTNER','/api/upload',{imageBase64:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII='});code(r,200);proof=remember('uploads',r.data.imageUrl);assert.ok(proof)});
 if(proof){
  await check('proof cannot be read anonymously',async()=>assert.equal((await fetch(base+proof)).status,401));
  await check('family cannot read proof before it is shared',async()=>code(await request('CLIENT',proof),403));
  await check('out-of-bounds check-in does not advance task',async()=>{const r=await request('PARTNER',`/api/tasks/${taskId}/verify`,{stage:'ARRIVAL_CHECKIN',selfieImageUrl:proof,latitude:0,longitude:0});code(r,200);assert.equal(r.data.status,'ACCEPTED')});
  await check('valid synthetic arrival proof advances visit',async()=>{const r=await request('PARTNER',`/api/tasks/${taskId}/verify`,{stage:'ARRIVAL_CHECKIN',selfieImageUrl:proof,latitude:parent.coordinatesLat,longitude:parent.coordinatesLng});code(r,200);assert.equal(r.data.status,'IN_PROGRESS')});
  await check('owning family reads shared proof',async()=>code(await request('CLIENT',proof),200));
  await check('partner submits completion proof',async()=>{const r=await request('PARTNER',`/api/tasks/${taskId}/verify`,{stage:'TASK_COMPLETION',selfieImageUrl:proof,latitude:parent.coordinatesLat,longitude:parent.coordinatesLng});code(r,200);assert.equal(r.data.status,'VERIFICATION_SUBMITTED')});
  await check('operations requests new completion proof',async()=>{const current=await request('ADMIN','/api/tasks/'+taskId);code(current,200);const logs=current.data.verification_logs||current.data.verificationLogs;const latest=logs.find(x=>x.stage==='TASK_COMPLETION'&&x.review_status==='PENDING');assert.ok(latest,'pending completion proof exists');rejectedLogId=latest.id;const r=await request('ADMIN',`/api/tasks/${taskId}/verify/reject`,{logId:latest.id,reason:'QA TEST ONLY — request another synthetic completion proof'});code(r,200);assert.equal(r.data.status,'IN_PROGRESS')});
  await check('review rejection cannot be replayed',async()=>code(await request('ADMIN',`/api/tasks/${taskId}/verify/reject`,{logId:rejectedLogId,reason:'QA TEST ONLY — replay guard'}),409));
  await check('partner can read the requested proof correction',async()=>{const r=await request('PARTNER','/api/tasks/'+taskId);code(r,200);assert.equal(r.data.verification_logs.find(x=>x.id===rejectedLogId)?.rejection_reason,'QA TEST ONLY — request another synthetic completion proof')});
  await check('partner resubmits completion after review',async()=>{const r=await request('PARTNER',`/api/tasks/${taskId}/verify`,{stage:'TASK_COMPLETION',selfieImageUrl:proof,latitude:parent.coordinatesLat,longitude:parent.coordinatesLng});code(r,200);assert.equal(r.data.status,'VERIFICATION_SUBMITTED')});
  await check('operations completes verified visit',async()=>{const r=await request('ADMIN',`/api/tasks/${taskId}/complete`,{});code(r,200);assert.equal(r.data.status,'COMPLETED')});
  await check('completed task preserves rejected proof history',async()=>{const r=await request('ADMIN','/api/tasks/'+taskId);code(r,200);const logs=r.data.verification_logs||r.data.verificationLogs;assert.equal(logs.find(x=>x.id===rejectedLogId)?.review_status,'REJECTED')});
  await check('completion replay rejected',async()=>code(await request('ADMIN',`/api/tasks/${taskId}/complete`,{}),409));
  await check('family sees completion',async()=>{const r=await request('CLIENT','/api/tasks/'+taskId);code(r,200);assert.equal(r.data.status,'COMPLETED')});
  await check('location sharing ends after completed visit',async()=>code(await request('CLIENT',`/api/partners/${clients.PARTNER.id}/location`),403));
  await check('family reviews completed visit',async()=>{const r=await request('CLIENT',`/api/tasks/${taskId}/review`,{rating:5,tags:['QA TEST'],feedbackText:'QA TEST ONLY — synthetic workflow review'});code(r,201);assert.equal(r.data.rating,5)});
  await check('partner sees family review',async()=>{const r=await request('PARTNER',`/api/partners/${clients.PARTNER.id}/reviews`);code(r,200);assert.ok(r.data.some(x=>x.task_id===taskId))});
 }
 await check('family creates alert without falsely claiming ambulance dispatch',async()=>{const r=await request('CLIENT','/api/emergency/sos',{parentId,latitude:parent.coordinatesLat,longitude:parent.coordinatesLng,notes:'QA TEST ONLY — not an emergency; no action or contact required'});code(r,201);remember('emergencies',r.data.id);assert.equal(r.data.ambulance_dispatched,0);assert.equal(r.data.status,'ACTIVE')});
 for(const id of report.records.emergencies){
  await check('care alert resolution requires notes',async()=>code(await request('ADMIN',`/api/emergency/${id}/resolve`,{}),400));
  await check('operations resolves alert using authenticated identity',async()=>{const r=await request('ADMIN',`/api/emergency/${id}/resolve`,{resolutionNotes:'QA TEST ONLY — closing synthetic test alert',resolvedBy:'forged-qa-identity'});code(r,200);assert.equal(r.data.status,'RESOLVED');assert.equal(r.data.resolved_by,clients.ADMIN.id)});
  await check('care alert resolution cannot be replayed',async()=>code(await request('ADMIN',`/api/emergency/${id}/resolve`,{resolutionNotes:'QA TEST ONLY — replay guard'}),409));
  await check('resolution audit uses authenticated operations actor',async()=>{const r=await request('ADMIN','/api/security/audit-logs');code(r,200);const row=r.data.find(x=>x.event_type==='EMERGENCY_SOS_RESOLVED'&&(x.details_json||'').includes(id));assert.ok(row,'resolution audit exists');assert.equal(row.actor_id,clients.ADMIN.id)});
 }
 await check('missing care alert resolution returns 404',async()=>code(await request('ADMIN','/api/emergency/qa-missing/resolve',{resolutionNotes:'QA TEST ONLY — missing alert'}),404));
 await check('family saves sibling record without sending mail',async()=>{const r=await request('CLIENT',`/api/clients/${clients.CLIENT.id}/family`,{invitedName:'QA TEST synthetic sibling',invitedEmail:'qa-sibling@example.com',relationship:'SIBLING'});code(r,201);remember('family',r.data.id)});
 await check('family sibling record persists',async()=>{const r=await request('CLIENT',`/api/clients/${clients.CLIENT.id}/family`);code(r,200);assert.ok(r.data.some(x=>report.records.family.includes(x.id)))});
 if(medId)await check('family creates medication refill request',async()=>{const r=await request('CLIENT',`/api/parents/${parentId}/medications/${medId}/refill`,{});code(r,201);remember('tasks',r.data.task?.id)});
 await check('completed care history prevents parent deletion',async()=>code(await request('CLIENT','/api/parents/'+parentId,undefined,'DELETE'),409));
 await check('payments remain unavailable',async()=>code(await request('ADMIN',`/api/tasks/${taskId}/escrow/approve`,{}),503));
 for(const role of ['CLIENT','ADMIN','PARTNER'])await check(role+' logout revokes session',async()=>{code(await request(role,'/api/auth/logout',{}),200);code(await request(role,'/api/auth/me'),401)});
}
main().catch(error=>{report.fatal=error.message;process.exitCode=1}).finally(()=>{report.finishedAt=new Date().toISOString();save();const failed=report.checks.filter(x=>!x.pass).length;console.log(`${report.checks.length-failed}/${report.checks.length} live QA checks passed; ${failed} failed.`);console.log('Report saved under artifacts (no credentials printed).');if(failed)process.exitCode=1});
