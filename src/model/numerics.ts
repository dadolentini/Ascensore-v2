import library from 'jstat';
const {jStat}=library;

export function mean(values: readonly number[]): number|null {
  if(!values.length) return null;
  let sum=0,correction=0;
  for(const value of values) {
    const y=value-correction, next=sum+y; correction=(next-sum)-y; sum=next;
  }
  return sum/values.length;
}

export function quantile(values: readonly number[], p: number): number|null {
  if(!Number.isFinite(p)||p<0||p>1) throw new RangeError('Quantile probability must be in [0,1]');
  if(!values.length) return null;
  const ordered=[...values].sort((a,b)=>a-b), position=(ordered.length-1)*p;
  const lo=Math.floor(position), hi=Math.ceil(position);
  return ordered[lo]+(ordered[hi]-ordered[lo])*(position-lo);
}

export function normalCdf(z: number): number { return jStat.normal.cdf(z,0,1); }

export interface PairedInterval {mean:number;lower:number;upper:number;n:number}
export function pairedConfidenceInterval(a: readonly number[], b: readonly number[]): PairedInterval|null {
  if(a.length!==b.length) throw new RangeError('Paired samples must have equal length');
  if(a.length<2) return null;
  if(![...a,...b].every(Number.isFinite)) throw new TypeError('Paired samples must be finite');
  const differences=a.map((x,i)=>x-b[i]), m=mean(differences)!;
  const variance=differences.reduce((v,x)=>v+(x-m)**2,0)/(a.length-1);
  const width=jStat.studentt.inv(.975,a.length-1)*Math.sqrt(variance/a.length);
  return {mean:m,lower:m-width,upper:m+width,n:a.length};
}

/** Least squares on the active columns by Householder QR, avoiding normal equations. */
function leastSquares(A: readonly (readonly number[])[], b: readonly number[], columns: readonly number[]): number[] {
  const rows=A.length, n=columns.length, Q=A.map(row=>columns.map(c=>row[c])), rhs=[...b];
  for(let k=0;k<n;k++) {
    let norm=0; for(let r=k;r<rows;r++) norm=Math.hypot(norm,Q[r][k]);
    if(norm<1e-13) throw new Error('Rank deficient active NNLS set');
    const alpha=Q[k][k]>=0?-norm:norm;
    const vector=Array.from({length:rows-k},(_,i)=>Q[k+i][k]); vector[0]-=alpha;
    const vnorm=Math.hypot(...vector); for(let i=0;i<vector.length;i++) vector[i]/=vnorm;
    for(let col=k;col<n;col++) {
      let dot=0; for(let i=0;i<vector.length;i++) dot+=vector[i]*Q[k+i][col];
      for(let i=0;i<vector.length;i++) Q[k+i][col]-=2*vector[i]*dot;
    }
    let dot=0; for(let i=0;i<vector.length;i++) dot+=vector[i]*rhs[k+i];
    for(let i=0;i<vector.length;i++) rhs[k+i]-=2*vector[i]*dot;
  }
  const x=Array(n).fill(0) as number[];
  for(let k=n-1;k>=0;k--) {
    let value=rhs[k]; for(let j=k+1;j<n;j++) value-=Q[k][j]*x[j]; x[k]=value/Q[k][k];
  }
  return x;
}

/** Lawson–Hanson active-set NNLS. Returns coefficients in column order. */
export function nnls(A: readonly (readonly number[])[], b: readonly number[]): number[] {
  if(A.length!==b.length||!A.length||!A[0].length) throw new RangeError('Invalid NNLS dimensions');
  const n=A[0].length;
  if(A.some(row=>row.length!==n||row.some(x=>!Number.isFinite(x)))||b.some(x=>!Number.isFinite(x))) throw new TypeError('NNLS requires a finite rectangular matrix');
  const x=Array(n).fill(0) as number[], active=new Set<number>(), excluded=new Set<number>();
  const scale=Math.max(1,...A.map(row=>Math.hypot(...row)))*Math.max(1,Math.hypot(...b));
  const tolerance=1e-12*scale;
  let iterations=0;
  for(;;) {
    const residual=A.map((row,r)=>b[r]-row.reduce((sum,v,c)=>sum+v*x[c],0));
    const w=Array.from({length:n},(_,c)=>A.reduce((sum,row,r)=>sum+row[c]*residual[r],0));
    let candidate=-1;
    for(let c=0;c<n;c++) if(!active.has(c)&&!excluded.has(c)&&w[c]>tolerance&&(candidate<0||w[c]>w[candidate])) candidate=c;
    if(candidate<0) break;
    active.add(candidate);
    for(;;) {
      if(++iterations>100*n*n) throw new Error('NNLS active-set convergence failed');
      const columns=[...active].sort((a,b)=>a-b), z=Array(n).fill(0) as number[];
      let coefficients:number[];
      try {coefficients=leastSquares(A,b,columns);} catch {
        active.delete(candidate); excluded.add(candidate); break;
      }
      columns.forEach((c,i)=>{z[c]=coefficients[i];});
      if(columns.every(c=>z[c]>0)) {for(let c=0;c<n;c++) x[c]=z[c]; break;}
      let alpha=Infinity;
      for(const c of columns) if(z[c]<=0) alpha=Math.min(alpha,x[c]/(x[c]-z[c]));
      if(!Number.isFinite(alpha)) alpha=0;
      for(let c=0;c<n;c++) x[c]+=alpha*(z[c]-x[c]);
      for(const c of columns) if(x[c]<=1e-14) {x[c]=0; active.delete(c);}
    }
  }
  return x;
}
