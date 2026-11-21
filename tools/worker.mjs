// pdf.js ishchi (worker) faylini eski Android WebView'lar ham tushunadigan qilib (es2017) tayyorlaydi.
// pdfjs-dist 3.11 "legacy" ham `||=` kabi yangi sintaksisni ishlatadi — Chrome 85 dan eski
// WebView'larda "Unexpected token '='" xatosi bilan kitob umuman ochilmasdi.
import { transformSync } from 'esbuild';
import { readFileSync, writeFileSync } from 'fs';

const src = readFileSync('node_modules/pdfjs-dist/legacy/build/pdf.worker.min.js', 'utf8');
const out = transformSync(src, { target: 'es2017', minify: true, legalComments: 'none' });
const poly = transformSync(readFileSync('src/polyfill.js', 'utf8'), { target: 'es2017', minify: true }).code;
writeFileSync('public/pdf.worker.es2017.js', poly + '\n' + out.code);
console.log('pdf.worker.es2017.js:', Math.round(out.code.length / 1024), 'KB');
