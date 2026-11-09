import {parseText,parseTable} from './import-core.js';
export async function extractFiles(files,options,onProgress) {
 const all=[];const errors=[];
 for(let i=0;i<files.length;i++) {
  const file=files[i];onProgress(`Reading ${i+1} of ${files.length}: ${file.name}`);
  try {
   if(file.size>30*1024*1024)throw new Error('File exceeds the 30 MB limit.');
   const opts={...options,source:file.name};const ext=file.name.split('.').at(-1).toLowerCase();
   if(['csv','tsv'].includes(ext)) {const {default:Papa}=await import('papaparse');const parsed=Papa.parse(await file.text(),{skipEmptyLines:true});all.push(...parseTable(parsed.data,opts));}
   else if(ext==='xlsx') {const {default:ExcelJS}=await import('exceljs');const book=new ExcelJS.Workbook();await book.xlsx.load(await file.arrayBuffer());book.eachSheet(sheet=>{const rows=[];sheet.eachRow(row=>rows.push(row.values.slice(1).map(v=>v?.result??v?.text??v)));all.push(...parseTable(rows,{...opts,source:file.name+' / '+sheet.name}));});}
   else if(ext==='pdf') {
    const pdfjs=await import('pdfjs-dist');const {default:workerUrl}=await import('pdfjs-dist/build/pdf.worker.min.mjs?url');pdfjs.GlobalWorkerOptions.workerSrc=workerUrl;
    const doc=await pdfjs.getDocument({data:await file.arrayBuffer()}).promise;
    try{for(let p=1;p<=doc.numPages;p++){onProgress(`Reading ${file.name}, page ${p}/${doc.numPages}`);const page=await doc.getPage(p);const content=await page.getTextContent();const lines=[];let lastY=null;for(const item of content.items){if(lastY===null||Math.abs(item.transform[5]-lastY)>3)lines.push([]);lines.at(-1).push(item.str);lastY=item.transform[5];}let text=lines.map(l=>l.join('  ')).join('\n');if(text.trim().length<15){const viewport=page.getViewport({scale:1.6});const canvas=document.createElement('canvas');canvas.width=viewport.width;canvas.height=viewport.height;await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;text=await ocr(canvas,onProgress);}all.push(...parseText(text,{...opts,source:`${file.name}, page ${p}`}));}}finally{await doc.destroy();}
   } else if(file.type.startsWith('image/')) all.push(...parseText(await ocr(file,onProgress),opts));
   else if(ext==='txt')all.push(...parseText(await file.text(),opts));
   else throw new Error('Use PDF, XLSX, CSV, TSV, TXT, PNG or JPEG. For older XLS files, save as XLSX first.');
  }catch(e){errors.push(`${file.name}: ${e.message}`);}
 }
 return {rows:all,errors};
}
async function ocr(file,onProgress){const {createWorker}=await import('tesseract.js');onProgress('Reading image on your device with the bundled OCR model.');const base=new URL('./ocr/',document.baseURI).href;const worker=await createWorker('eng',1,{workerPath:base+'worker.min.js',corePath:base,langPath:base,logger:()=>{}});try{return (await worker.recognize(file)).data.text;}finally{await worker.terminate();}}
