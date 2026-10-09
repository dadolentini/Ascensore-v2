import assert from 'node:assert/strict';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const base=process.env.VITE_BASE_PATH||'/elevator/';
assert(/^\/(?:[A-Za-z0-9_-]+\/)*elevator\/$/.test(base),'Pages base must end with /elevator/.');
const source=resolve('dist');
const destination=resolve('.cache/pages-site');
const index=await readFile(join(source,'index.html'),'utf8');
assert(index.includes(`src="${base}assets/`),'Build the app with the same VITE_BASE_PATH before preparing Pages.');
await rm(destination,{recursive:true,force:true});
await mkdir(destination,{recursive:true});
await cp(source,join(destination,'elevator'),{recursive:true});
// Preserve existing public links to the original mathematical documents.
await cp(join(source,'model'),join(destination,'model'),{recursive:true});
for(const route of ['', 'come-funziona', 'gli-algoritmi']) {
  const target=base+(route?route+'/':'');
  const directory=join(destination,route);
  await mkdir(directory,{recursive:true});
  await writeFile(join(directory,'index.html'),`<!doctype html>
<html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Elevator</title><link rel="canonical" href="${target}">
<noscript><meta http-equiv="refresh" content="0;url=${target}"></noscript>
<script>location.replace(${JSON.stringify(target)}+location.search+location.hash)</script>
</head><body><a href="${target}">Apri Elevator</a></body></html>\n`,'utf8');
}
console.log(`Prepared ${destination}: Elevator at ${base}, root and legacy page redirects, original PDF links.`);
