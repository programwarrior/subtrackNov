import { validDate,minorAmount,fingerprint,merchantKey,catalog } from './core.js';
export function parseDate(text,year='') {
 const s=String(text||'').trim();
 let m=s.match(/\b(\d{4})[-/](\d{1,2})[-/](\d{1,2})\b/);
 if(m){const date=`${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;return {date:validDate(date)?date:'',uncertain:!validDate(date)};}
 m=s.match(/\b(\d{1,2})[/.\-](\d{1,2})(?:[/.\-](\d{2,4}))?\b/);
 if(m){const y=m[3]?(m[3].length===2?'20'+m[3]:m[3]):year;const date=y?`${y}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`:'';return {date:validDate(date)?date:'',uncertain:!y||!validDate(date)||(Number(m[1])<=12&&Number(m[2])<=12&&m[1]!==m[2])};}
 const months={jan:1,january:1,janvier:1,feb:2,february:2,février:2,mar:3,march:3,mars:3,apr:4,april:4,avril:4,may:5,mai:5,jun:6,june:6,juin:6,jul:7,july:7,juillet:7,aug:8,august:8,août:8,sep:9,september:9,septembre:9,oct:10,october:10,octobre:10,nov:11,november:11,novembre:11,dec:12,december:12,décembre:12};
 m=s.toLowerCase().match(/\b(\d{1,2})\s+([a-zéû]+)\.?\s*(\d{4})?\b/);
 if(m&&months[m[2]]){const y=m[3]||year;const date=y?`${y}-${String(months[m[2]]).padStart(2,'0')}-${m[1].padStart(2,'0')}`:'';return {date:validDate(date)?date:'',uncertain:!y||!validDate(date)};}
 return {date:'',uncertain:true};
}
export function parseAmounts(text,defaultCurrency='EUR') {
 const amounts=[];const re=/(?:([€£$]|EUR|USD|GBP|JPY|CAD|AUD|CHF)\s*(-?\d+(?:[ .\u00a0]\d{3})*(?:[.,]\d{1,2})?)|(-?\d+(?:[ .\u00a0]\d{3})*(?:[.,]\d{1,2})?)\s*(EUR|USD|GBP|JPY|CAD|AUD|CHF|[€£$]))/gi;
 for(const m of String(text).matchAll(re)) {
  const symbol=(m[1]||m[4]).toUpperCase();const currency={'€':'EUR','£':'GBP','$':'USD'}[symbol]||symbol||defaultCurrency;
  let raw=(m[2]||m[3]).replace(/[\s\u00a0]/g,'');if(raw.includes(',')&&raw.includes('.')) raw=raw.lastIndexOf(',')>raw.lastIndexOf('.')?raw.replace(/\./g,'').replace(',','.'):raw.replace(/,/g,'');else raw=raw.replace(',','.');
  amounts.push({amount:minorAmount(Math.abs(Number(raw)),currency),currency,match:m[0],index:m.index});
 }
 return amounts;
}
function provider(text) { return catalog.find(c=>merchantKey(text).includes(merchantKey(c.name)))?.name||''; }
export function parseText(text,{source='',year='',currency='EUR'}={}) {
 const lines=text.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);const rows=[];let context={date:'',uncertain:true};
 const header=lines.findIndex(line=>/\bdate\b/i.test(line)&&/total\s*ttc/i.test(line)&&/\s{2,}|\t/.test(line));
 if(header>=0){const table=lines.slice(header).map(line=>line.split(/\t+|\s{2,}/));const names=table[0].map(v=>v.toLowerCase());if(names.some(n=>/^date$|invoice.*date|date.*facture/.test(n)))return parseTable(table,{source,year,currency});}
 const documentProvider=provider(lines.slice(0,8).join(' '));
 for(let i=0;i<lines.length;i++) {
  const line=lines[i]; const date=parseDate(line,year); if(date.date||/\b\d{1,2}\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(line))context=date;
  let found=parseAmounts(line,currency);
  if(!found.length && /(?:total\s*(?:ttc)?|amount due|montant dû)\s*[:=]?\s*[-\d]/i.test(line)) {
   const raw=line.match(/(?:total\s*(?:ttc)?|amount due|montant dû)\s*[:=]?\s*(-?\d+(?:[.,]\d{1,2})?)/i)?.[1];
   if(raw)found=[{amount:minorAmount(Math.abs(Number(raw.replace(',','.'))),currency),currency,match:raw,index:line.indexOf(raw)}];
  }
  if(!found.length)continue;
  if(/\b(subtotal|sous.total|VAT|TVA|tax|discount|remise)\b/i.test(line)&&!/(total\s*ttc|amount due)/i.test(line))continue;
  const amount=found.at(-1);const known=provider(line)||documentProvider;
  let rawName=line.replace(amount.match,'').replace(/\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}[/.\-]\d{1,2}(?:[/.\-]\d{2,4})?\b/g,'').replace(/\b(total|ttc|amount due|paid|payment|debit|€|EUR)\b/gi,'').replace(/^[\s:|–-]+|[\s:|–-]+$/g,'').trim();
  const name=known||(/\p{L}/u.test(rawName)?rawName:'');
  rows.push({name,date:date.date||context.date,amount:amount.amount,currency:amount.currency,source,evidence:line.slice(0,300),uncertain:!name||(!date.date?context.uncertain:date.uncertain)||found.length>1,warnings:[...(!known?['Confirm merchant']:[]),...((!date.date?context.uncertain:date.uncertain)?['Confirm date (day/month order or missing year)']:[]),...(found.length>1?['Multiple amounts: verify total']:[])],isTotal:/(?:\btotal\s*(?:ttc)?\b|amount due|montant dû)/i.test(line)});
 }
 // A single full receipt's explicitly labelled total takes precedence over line items.
 const totals=rows.filter(r=>r.isTotal); if(totals.length===1&&new Set(rows.map(r=>r.date).filter(Boolean)).size<=1)return totals;
 return rows;
}
export function parseTable(rows,options={}) {
 if(!rows.length)return [];
 const headers=rows[0].map(h=>String(h||'').toLowerCase().trim());
 const index=patterns=>headers.findIndex(h=>patterns.some(p=>p.test(h)));
 const dateIdx=index([/^date$/, /transaction.*date/,/invoice.*date/,/date.*facture/]);
 let amountIdx=index([/total.*ttc/,/amount due/,/montant.*ttc/]);if(amountIdx<0)amountIdx=index([/^total$/, /^amount$/, /^montant$/, /^debit$/, /^débit$/]);
 const nameIdx=index([/merchant/,/provider/,/description/,/^name$/, /libell/,/fournisseur/]);const currencyIdx=index([/currency/,/devise/]);const idIdx=index([/transaction.?id/,/reference/]);
 if(dateIdx<0||amountIdx<0)return parseText(rows.map(r=>r.join('  ')).join('\n'),options);
 return rows.slice(1).filter(r=>r.some(v=>v!==''&&v!=null)).map(r=>{
  const date=parseDate(r[dateIdx] instanceof Date?r[dateIdx].toISOString().slice(0,10):r[dateIdx],options.year);
  const currency=String(r[currencyIdx]||options.currency||'EUR').trim().toUpperCase();
  const raw=String(r[amountIdx]??'');let amount=parseAmounts(raw,currency)[0]?.amount;
  if(amount==null&&/^\s*-?[\d\s]+(?:[,.]\d{1,2})?\s*$/.test(raw))amount=minorAmount(Math.abs(Number(raw.replace(/\s/g,'').replace(',','.'))),currency);
  const name=String(r[nameIdx]||'').trim();
  return {name:provider(name)||name,date:date.date,amount:amount??null,currency,source:options.source||'',transactionId:String(r[idIdx]||''),evidence:r.join(' | ').slice(0,300),uncertain:date.uncertain||!name||amount==null,warnings:[...(date.uncertain?['Confirm date']:[]),...(!name?['Missing merchant']:[]),...(amount==null?['Missing amount']:[])]};
 });
}
export function groupCandidates(rows,existing=[]) {
 const seen=new Set(existing.map(fingerprint));const groups=new Map();
 for(const r of rows){const key=fingerprint(r);const duplicate=seen.has(key);seen.add(key);const groupKey=merchantKey(r.name)||'unknown:'+groups.size;if(!groups.has(groupKey))groups.set(groupKey,{name:r.name,charges:[],frequency:'monthly'});groups.get(groupKey).charges.push({...r,duplicate,selected:!duplicate});}
 return [...groups.values()].map(g=>{
  const dates=[...new Set(g.charges.map(r=>r.date).filter(Boolean))].sort();const gaps=dates.slice(1).map((d,i)=>(new Date(d)-new Date(dates[i]))/86400000);
  const recurring=gaps.length>0&&gaps.every(n=>n>=25&&n<=35);
  if(gaps.length&&gaps.every(n=>n>=350&&n<=380))g.frequency='yearly';
  if(gaps.length&&gaps.every(n=>n>=6&&n<=8))g.frequency='weekly';
  return {...g,evidence:recurring?'Repeated charges about a month apart.':gaps.length?'Several charges; confirm whether this is a subscription.':'Only one charge. This may be ordinary spending.',selected:false};
 });
}
