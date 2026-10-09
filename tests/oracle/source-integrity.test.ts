import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { test, expect } from 'vitest';
import manifest from '../../docs/sources/MANIFEST.json';

test('l’autorità matematica conserva tutti i 19 file e le copie pubbliche originali',()=>{
  const originals=manifest.filter(file=>file.member.startsWith('Modello_Ascensori_V2/'));
  expect(originals).toHaveLength(19);
  for(const file of originals){
    const relative=file.member.slice('Modello_Ascensori_V2/'.length);
    const bytes=readFileSync(new URL(`../../reference/source/${relative}`,import.meta.url));
    expect(bytes.length,relative).toBe(file.bytes);
    expect(createHash('sha256').update(bytes).digest('hex'),relative).toBe(file.sha256);
  }
  for(const name of ['rapporto_ascensori.pdf','parametri_ascensori.json'])expect(readFileSync(new URL(`../../public/model/${name}`,import.meta.url))).toEqual(readFileSync(new URL(`../../reference/source/${name}`,import.meta.url)));
});
