import { describe, expect, it } from 'vitest';
import { cdfAt, nearestWaitIndex } from '../../src/features/results/cdf';

describe('lettura dei punti della distribuzione delle attese',()=>{
  it('conta tutte le attese uguali alla soglia, comprese le duplicazioni',()=>{
    expect(cdfAt([1,1,2,4],1)).toEqual({count:2,total:4,percent:50});
    expect(cdfAt([1,1,2,4],3)).toEqual({count:3,total:4,percent:75});
  });
  it('distingue soglie prima e dopo il campione',()=>{
    expect(cdfAt([1,2,4],0).percent).toBe(0);
    expect(cdfAt([1,2,4],4).percent).toBe(100);
    expect(cdfAt([1,2,4],10).count).toBe(3);
  });
  it('gestisce attese tutte nulle senza perdere i viaggi',()=>{
    expect(cdfAt([0,0,0],0)).toEqual({count:3,total:3,percent:100});
  });
  it('non inventa una percentuale per un campione vuoto',()=>{
    expect(cdfAt([],10)).toEqual({count:0,total:0,percent:null});
  });
  it('sceglie il tempo realmente osservato più vicino e limita gli estremi',()=>{
    expect(nearestWaitIndex([0,2,10],1)).toBe(0);
    expect(nearestWaitIndex([0,2,10],1.5)).toBe(1);
    expect(nearestWaitIndex([0,2,10],8)).toBe(2);
    expect(nearestWaitIndex([0,2,10],-10)).toBe(0);
    expect(nearestWaitIndex([0,2,10],100)).toBe(2);
    expect(nearestWaitIndex([],1)).toBeNull();
  });
});
