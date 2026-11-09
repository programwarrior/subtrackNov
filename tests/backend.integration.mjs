// Run against an isolated, freshly initialized database only.
// No hosted account or production credential is used by this test.
import assert from 'node:assert/strict';
const base=process.env.SUBTRACK_TEST_API;
if(!base)throw new Error('Set SUBTRACK_TEST_API to the isolated local test API.');
if(!/^http:\/\/127\.0\.0\.1:/.test(base))throw new Error('Integration tests may only run on loopback.');
let assertions=0;
async function call(route,body,token,origin='http://127.0.0.1:5173'){
 const res=await fetch(base+'?route='+route,{method:body?'POST':'GET',headers:{'Content-Type':'application/json','Origin':origin,...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:res.status,data:await res.json()};
}
function eq(actual,expected,label){assert.deepEqual(actual,expected,label);assertions++;console.log('PASS '+label);}
const suffix=Date.now();
const a=await call('register',{email:`a${suffix}@example.test`,password:'Only-for-local-tests-123'});
const b=await call('register',{email:`b${suffix}@example.test`,password:'Only-for-local-tests-456'});
eq(a.status,201,'account A registers');eq(b.status,201,'account B registers');
const ta=a.data.token,tb=b.data.token;
eq((await call('login',{email:`a${suffix}@example.test`,password:'wrong'})).status,401,'wrong password rejected');
eq((await call('changes')).status,401,'unauthenticated reads rejected');
eq((await call('changes',null,ta,'https://evil.example')).status,403,'unapproved origin rejected');
const sub={id:'test-sub',type:'subscription',name:'Test plan',currency:'EUR',amount:1200,frequency:'monthly',status:'active',nextDate:'2026-12-01'};
const batch={id:'initial',changes:[{record:sub,baseVersion:0}]};
const first=await call('sync',{batch},ta);eq(first.status,200,'first subscription saved');eq(first.data.records[0].version,1,'server assigns version');
eq((await call('sync',{batch},ta)).data,first.data,'retry is idempotent after lost response');
eq((await call('changes',null,tb)).data.records.length,0,'another account cannot read the subscription');
eq((await call('records',{ids:['test-sub']},tb)).data.records.length,0,'direct record fetch enforces account isolation');
eq((await call('sync',{batch:{id:'empty',changes:[]}},ta)).status,400,'empty replacement is rejected');
eq((await call('changes',null,ta)).data.records.length,1,'empty device did not wipe account');
eq((await call('sync',{batch:{id:'conflict',changes:[{record:{...sub,name:'Stale'},baseVersion:0}]}},ta)).status,409,'simultaneous stale update is rejected');
const payment={id:'test-payment',type:'payment',subscriptionId:'test-sub',amount:1200,currency:'EUR',date:'2026-11-09',status:'confirmed'};
eq((await call('sync',{batch:{id:'foreign',changes:[{record:payment,baseVersion:0}]}},tb)).status,403,'foreign subscription history write rejected');
const combined={id:'pay',changes:[{record:{...sub,nextDate:'2027-01-01'},baseVersion:1},{record:payment,baseVersion:0}]};
eq((await call('sync',{batch:combined},ta)).status,200,'payment and renewal saved atomically');
const bad={id:'bad-payment',changes:[{record:{...sub,nextDate:'2027-02-01'},baseVersion:2},{record:{...payment,id:'wrong',subscriptionId:'absent'},baseVersion:0}]};
eq((await call('sync',{batch:bad},ta)).status,403,'invalid history rejects entire action');
const retained=await call('records',{ids:['test-sub']},ta);eq(retained.data.records[0].nextDate,'2027-01-01','failed action did not advance renewal');
const created=[];for(let i=0;i<6;i++)created.push({record:{...sub,id:'bulk-'+i},baseVersion:0});
await call('sync',{batch:{id:'bulk-create',changes:created}},ta);
const deleted=created.map(c=>({record:{...c.record,deletedAt:'2026-11-09T12:00:00Z'},baseVersion:1}));
eq((await call('sync',{batch:{id:'bulk-delete',changes:deleted}},ta)).status,422,'unexpected bulk deletion blocked');
eq((await call('sync',{batch:{id:'bulk-delete-confirmed',confirmedDeletes:6,changes:deleted}},ta)).status,200,'confirmed deletion retains tombstones');
eq((await call('records',{ids:['bulk-0']},ta)).data.records[0].deletedAt,'2026-11-09T12:00:00Z','deleted record remains recoverable');
eq((await call('logout',{},ta)).status,200,'logout succeeds');
eq((await call('changes',null,ta)).status,401,'revoked token cannot read account');
console.log(`${assertions} backend integration assertions passed.`);
