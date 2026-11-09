import {mkdir,copyFile} from 'node:fs/promises';
await mkdir('public/ocr',{recursive:true});
await copyFile('node_modules/tesseract.js/dist/worker.min.js','public/ocr/worker.min.js');
for(const name of ['tesseract-core-lstm.wasm.js','tesseract-core-simd-lstm.wasm.js'])await copyFile('node_modules/tesseract.js-core/'+name,'public/ocr/'+name);
await copyFile('node_modules/@tesseract.js-data/eng/4.0.0/eng.traineddata.gz','public/ocr/eng.traineddata.gz');
await copyFile('node_modules/tesseract.js-core/LICENSE','public/ocr/LICENSE');
console.log('Local OCR worker, engine and English model prepared.');
