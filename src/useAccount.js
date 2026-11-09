import {useState,useEffect,useRef,useCallback} from 'react';
import {readAccount,saveAccount} from './storage';
import {prepareMutation} from './core';
import {API,request,applyRemote,acceptBatch} from './sync';
const empty={records:[],queue:[],cursor:0,conflicts:[],lastSync:null};
const lock=(key,fn)=>navigator.locks?navigator.locks.request('subtrack:'+key,fn):Promise.reject(new Error('This browser needs Web Locks support to safely edit data. Please update your browser.'));
export function useAccount(session) {
 const account=session?.userId||(import.meta.env.DEV&&new URLSearchParams(location.search).has('qa')?'isolated-qa':'local');const [data,setData]=useState(empty);const [ready,setReady]=useState(false);const [status,setStatus]=useState('');const [error,setError]=useState('');const ref=useRef(account);ref.current=account;
 const publish=useCallback(async(next)=>{await saveAccount(account,next);if(ref.current===account)setData(next);const channel=new BroadcastChannel('subtrack');channel.postMessage(account);channel.close();},[account]);
 useEffect(()=>{setReady(false);setData(empty);readAccount(account).then(d=>{if(ref.current===account){setData(d);setReady(true);}}).catch(e=>setError(e.message));const channel=new BroadcastChannel('subtrack');channel.onmessage=e=>{if(e.data===account)readAccount(account).then(setData);};return()=>channel.close();},[account]);
 const update=useCallback(fn=>lock(account,async()=>{const d=await readAccount(account);const next=await fn(d);await publish(next);return next;}),[account,publish]);
 const change=useCallback(changes=>changes.length?update(d=>({...d,...prepareMutation(d.records,d.queue,changes)})):Promise.resolve(),[update]);
 const sync=useCallback(async()=>{
  if(!session||!API||!navigator.onLine)return;
  setStatus('Syncing');setError('');
  try{await lock(account,async()=>{let d=await readAccount(account);if(d.conflicts.length)return;
   for(const batch of [...d.queue]) {try{const result=await request('sync',{batch},session);d=acceptBatch(d,batch.id,result.records);await publish(d);}catch(e){if(e.status===409){d={...d,conflicts:(e.conflicts||[]).map(c=>({id:c.id,remote:c.remote,local:d.records.find(r=>r.id===c.id)}))};await publish(d);}throw e;}}
   let more=true;while(more){const result=await request('changes&cursor='+d.cursor,null,session);d=applyRemote(d,result.records,result.cursor);more=result.hasMore;await publish(d);}
   d={...d,lastSync:new Date().toISOString()};await publish(d);
  });setStatus('Up to date');}catch(e){setStatus('Sync needs attention');setError(e.message);}
 },[session,account,publish]);
 useEffect(()=>{const run=()=>{if(document.visibilityState==='visible')sync();};run();window.addEventListener('online',run);document.addEventListener('visibilitychange',run);const id=setInterval(run,60000);return()=>{clearInterval(id);window.removeEventListener('online',run);document.removeEventListener('visibilitychange',run);};},[sync]);
 useEffect(()=>{if(data.queue.length){const id=setTimeout(sync,1500);return()=>clearTimeout(id);}},[data.queue.length,sync]);
 return {data,ready,change,update,sync,status,error,setError};
}
