import { describe, expect, it } from 'vitest';
import { fromBasePath, isAppRoute, withBasePath } from '../../src/navigation/paths';

const base='/Ascensore-v2/';
describe('navigation on the public project URL',()=>{
  it('keeps root hosting unchanged',()=>{
    expect(withBasePath('/come-funziona#esempio','/')).toBe('/come-funziona#esempio');
    expect(fromBasePath('/gli-algoritmi/?x=1#fonti','/')).toBe('/gli-algoritmi/?x=1#fonti');
  });
  it('prefixes routes, images and the original PDF',()=>{
    expect(withBasePath('/',base)).toBe(base);
    expect(withBasePath('/#simulatore',base)).toBe(`${base}#simulatore`);
    expect(withBasePath('/come-funziona#esempio',base)).toBe(`${base}come-funziona#esempio`);
    expect(withBasePath('/assets/tower.webp',base)).toBe(`${base}assets/tower.webp`);
    expect(withBasePath('/model/rapporto_ascensori.pdf',base)).toBe(`${base}model/rapporto_ascensori.pdf`);
  });
  it('does not prefix an already public path twice',()=>{
    expect(withBasePath(`${base}gli-algoritmi#fonti`,base)).toBe(`${base}gli-algoritmi#fonti`);
  });
  it('preserves relative anchors and external links',()=>{
    for(const value of ['#problema','?mode=example','relative.pdf','https://example.com/file.pdf','//example.com/file.pdf'])expect(withBasePath(value,base)).toBe(value);
  });
  it('normalizes refresh URLs while keeping search and fragment',()=>{
    expect(fromBasePath('/Ascensore-v2',base)).toBe('/');
    expect(fromBasePath(base,base)).toBe('/');
    expect(fromBasePath(`${base}gli-algoritmi/?x=1#fonti`,base)).toBe('/gli-algoritmi/?x=1#fonti');
  });
  it('does not intercept unrelated projects or domains',()=>{
    expect(fromBasePath('/Ascensore-v2-other/come-funziona',base)).toBeNull();
    expect(fromBasePath('/other/come-funziona',base)).toBeNull();
    expect(fromBasePath('https://example.com/come-funziona',base)).toBeNull();
    expect(fromBasePath('//example.com/come-funziona',base)).toBeNull();
  });
  it('recognizes only the three supported routes',()=>{
    for(const path of ['/','/#simulatore','/come-funziona/','/come-funziona?x=1#esempio','/gli-algoritmi/#fonti'])expect(isAppRoute(path)).toBe(true);
    for(const path of ['/other','/gli-algoritmi-other','/model/rapporto_ascensori.pdf'])expect(isAppRoute(path)).toBe(false);
  });
});
