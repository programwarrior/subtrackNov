export const API=import.meta.env?.VITE_API_URL?.replace(/\/$/,'')||'';
export async function request(path,body,session) {
 if(!API) throw new Error('Cloud is not configured yet. Your data stays safely on this device.');
 const [route,...params]=path.split('&');
 const res=await fetch(API+'?route='+encodeURIComponent(route)+(params.length?'&'+params.join('&'):''),{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(session?{Authorization:'Bearer '+session.token}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(25000)});
 let data;try{data=await res.json();}catch{throw new Error('The server returned an unexpected response. Your local changes are retained.');}
 if(!res.ok){const e=new Error(data.error||'Connection failed. Your changes are retained.');e.status=res.status;e.conflicts=data.conflicts;throw e;} return data;
}
export function applyRemote(state,changes,cursor) {
 const dirty=new Set(state.queue.flatMap(b=>b.changes.map(c=>c.record.id)));
 const map=new Map(state.records.map(r=>[r.id,r]));
 const conflicts=[...state.conflicts];
 for(const remote of changes) {
  const local=map.get(remote.id);
  if(dirty.has(remote.id)&&local&&(local.version||0)!==remote.version) {
   if(!conflicts.some(c=>c.id===remote.id&&c.remote.version===remote.version))conflicts.push({id:remote.id,local,remote});
  } else if(!dirty.has(remote.id))map.set(remote.id,remote);
 }
 return {...state,records:[...map.values()],cursor,conflicts};
}
export function acceptBatch(state,batchId,acknowledged) {
 const queue=state.queue.filter(b=>b.id!==batchId);
 const versions=new Map(acknowledged.map(r=>[r.id,r.version]));
 // Rebase later local actions only after a successful acknowledgement of our own write.
 const rebased=queue.map(b=>({...b,changes:b.changes.map(c=>versions.has(c.record.id)?{...c,baseVersion:versions.get(c.record.id),record:{...c.record,version:versions.get(c.record.id)}}:c)}));
 const dirty=new Set(rebased.flatMap(b=>b.changes.map(c=>c.record.id)));
 const map=new Map(state.records.map(r=>[r.id,versions.has(r.id)?{...r,version:versions.get(r.id)}:r]));
 for(const r of acknowledged)if(!dirty.has(r.id))map.set(r.id,r);
 return {...state,records:[...map.values()],queue:rebased};
}
