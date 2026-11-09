export const uid = () => crypto.randomUUID();
export const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
export const frequencies = { weekly: 'Weekly', monthly: 'Monthly', bimonthly: 'Every 2 months', quarterly: 'Quarterly', semiannual: 'Every 6 months', yearly: 'Yearly', custom: 'Custom', once: 'One-time' };
export const categories = ['Entertainment','Software','AI tools','Hosting','Education','Fitness','Finance','Utilities','Other'];
export const digits = (currency = 'EUR') => new Intl.NumberFormat('en', {style:'currency',currency}).resolvedOptions().maximumFractionDigits;
export const money = (minor, currency = 'EUR') => new Intl.NumberFormat('en-GB',{style:'currency',currency, maximumFractionDigits:digits(currency)}).format((minor || 0) / 10 ** digits(currency));
export const minorAmount = (value, currency='EUR') => { const n=Number(String(value).replace(/\s/g,'').replace(',','.')); if(!Number.isFinite(n)||n<0) throw new Error('Enter a valid positive amount.'); return Math.round(n*10**digits(currency)); };
export function validDate(value) { if(!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false; const d=new Date(value+'T12:00:00Z'); return !isNaN(d)&&d.toISOString().slice(0,10)===value; }
export function addDays(date, days) { const d=new Date(date+'T12:00:00Z'); d.setUTCDate(d.getUTCDate()+days); return d.toISOString().slice(0,10); }
export function advance(date, sub) {
 if(!validDate(date)) throw new Error('A valid payment date is required.');
 if(sub.frequency==='once') return null;
 if(sub.frequency==='weekly') return addDays(date,7);
 if(sub.frequency==='custom' && sub.customUnit!=='months') return addDays(date,Math.max(1,Number(sub.customInterval)||1));
 const months={monthly:1,bimonthly:2,quarterly:3,semiannual:6,yearly:12}[sub.frequency] || Math.max(1,Number(sub.customInterval)||1);
 const d=new Date(date+'T12:00:00Z'); const day=Number(sub.billingDay)||d.getUTCDate(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth()+months);
 const end=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate(); d.setUTCDate(Math.min(day,end)); return d.toISOString().slice(0,10);
}
export function currentPrice(sub, records=[], at=today()) {
 const events=records.filter(r=>r.subscriptionId===sub.id&&!r.deletedAt&&((r.type==='payment'&&r.status==='confirmed')||r.type==='price')&&r.date<=at)
 .sort((a,b)=>a.date.localeCompare(b.date)||(a.type==='price'?1:0)-(b.type==='price'?1:0)||(a.createdAt||'').localeCompare(b.createdAt||''));
 const last=events.at(-1); return last ? (last.type==='price'?last.newAmount:last.amount) : sub.amount;
}
export function monthlyAmount(sub, records=[], at=today()) {
 const price=currentPrice(sub,records,at);
 return price * ({weekly:52/12,monthly:1,bimonthly:1/2,quarterly:1/3,semiannual:1/6,yearly:1/12,once:0}[sub.frequency] ?? (sub.customUnit==='months'?1/Math.max(1,sub.customInterval):365.2425/(12*Math.max(1,sub.customInterval))));
}
export function markPaid(sub, records=[], paidDate=today()) {
 if(sub.status!=='active'||!sub.nextDate) throw new Error('This subscription has no active payment due.');
 const occurrenceId=`${sub.id}:${sub.nextDate}`;
 if(records.some(r=>!r.deletedAt&&r.type==='payment'&&r.occurrenceId===occurrenceId&&r.status==='confirmed')) throw new Error('This occurrence has already been paid.');
 const nextDate=advance(sub.nextDate,sub);
 return [{...sub,nextDate,status:nextDate?sub.status:'cancelled'}, {id:uid(),type:'payment',subscriptionId:sub.id,amount:currentPrice(sub,records,sub.nextDate),currency:sub.currency,date:paidDate,scheduledDate:sub.nextDate,status:'confirmed',occurrenceId,note:'Marked paid',createdAt:new Date().toISOString()}];
}
export function estimatedHistory(sub, records=[]) {
 if(!sub.firstDate || sub.imported || records.some(r=>r.type==='payment'&&r.subscriptionId===sub.id&&!r.deletedAt)) return [];
 const rows=[]; let date=sub.firstDate;
 while(validDate(date)&&date<today()&&(!sub.nextDate||date<sub.nextDate)&&rows.length<600) { rows.push({id:`estimate:${sub.id}:${date}`,type:'payment',date,amount:currentPrice(sub,records,date),currency:sub.currency,status:'estimated'}); const next=advance(date,sub); if(!next||next<=date) break; date=next; }
 return rows;
}
export function merchantKey(name) { return String(name||'').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/\b(payment|subscription|limited|ltd|inc)\b/g,'').replace(/[^a-z0-9]/g,''); }
export const fingerprint = r => [merchantKey(r.name),r.date,r.amount,r.currency,r.transactionId||''].join('|');
export function validateBackup(value) {
 if(value?.format!=='subtrack-backup'||value.version!==1||!Array.isArray(value.records)||value.records.length>50000) throw new Error('This is not a supported Subtrack backup.');
 const ids=new Set();
 for(const r of value.records) {
  if(!r||typeof r.id!=='string'||!r.id||ids.has(r.id)||!['subscription','payment','price','settings'].includes(r.type)) throw new Error('Backup contains invalid or duplicate records.');
  ids.add(r.id);
  if(r.type==='subscription'&&(!r.name||!Number.isSafeInteger(r.amount)||r.amount<0||!frequencies[r.frequency]||!['active','paused','cancelled'].includes(r.status)||!(/^[A-Z]{3}$/).test(r.currency))) throw new Error('Backup contains an invalid subscription.');
  if(['payment','price'].includes(r.type)&&(!validDate(r.date)||!Number.isSafeInteger(r.type==='payment'?r.amount:r.newAmount)||(r.type==='payment'?r.amount:r.newAmount)<0||!r.subscriptionId)) throw new Error('Backup contains an invalid history record.');
 }
 for(const r of value.records) if(['payment','price'].includes(r.type)&&!value.records.some(s=>s.id===r.subscriptionId&&s.type==='subscription')) throw new Error('Backup contains history without its subscription.');
 return value.records;
}
export function mergeBackup(existing,incoming) {
 const merged=new Map(existing.map(r=>[r.id,r])); let added=0,conflicts=[];
 for(const r of incoming) { const old=merged.get(r.id); if(!old) {merged.set(r.id,r);added++;} else if(JSON.stringify({...old,version:0})!==JSON.stringify({...r,version:0})) conflicts.push({local:old,incoming:r}); }
 return {records:[...merged.values()],added,conflicts};
}
export function prepareMutation(records, queue, changes) {
 const map=new Map(records.map(r=>[r.id,r]));
 for(const r of changes) map.set(r.id,{...r,updatedAt:new Date().toISOString()});
 // Each action is an atomic batch, so payment creation and renewal advancement cannot split.
 const confirmedDeletes=changes.filter(r=>r.deletedAt&&!records.find(old=>old.id===r.id)?.deletedAt).length;
 const batch={id:uid(),confirmedDeletes,changes:changes.map(r=>({record:map.get(r.id),baseVersion:r.version||0}))};
 return {records:[...map.values()],queue:[...queue,batch]};
}
export const catalog = [
 ['Netflix','Entertainment','netflix.com','Standard, Premium'],['Spotify','Entertainment','spotify.com','Individual, Duo, Family'],['YouTube Premium','Entertainment','youtube.com/premium','Individual, Family'],['Apple Music','Entertainment','music.apple.com','Individual, Family'],['Disney+','Entertainment','disneyplus.com','Standard, Premium'],['Amazon Prime','Entertainment','amazon.com/prime','Monthly, Annual'],['ChatGPT','AI tools','chatgpt.com','Plus, Pro'],['Claude','AI tools','claude.ai','Pro, Max'],['Perplexity','AI tools','perplexity.ai','Pro'],['GitHub','Software','github.com','Pro, Team'],['Adobe Creative Cloud','Software','adobe.com','Single app, All apps'],['Canva','Software','canva.com','Pro'],['Notion','Software','notion.so','Plus, Business'],['Figma','Software','figma.com','Professional'],['Microsoft 365','Software','microsoft.com','Personal, Family'],['Google One','Utilities','one.google.com','Storage plans'],['iCloud+','Utilities','icloud.com','Storage plans'],['Dropbox','Software','dropbox.com','Plus'],['Hostinger','Hosting','hostinger.com','Hosting plans'],['A2 Hosting','Hosting','hosting.com','Hosting plans'],['DigitalOcean','Hosting','digitalocean.com','Usage based'],['Duolingo','Education','duolingo.com','Super'],['Coursera','Education','coursera.org','Plus'],['Strava','Fitness','strava.com','Subscription'],['Revolut','Finance','revolut.com','Plus, Premium, Metal']
].map(([name,category,website,plans])=>({name,category,website:'https://'+website,plans}));
