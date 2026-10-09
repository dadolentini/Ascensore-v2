// Presentation only: sorted waits come from the completed simulation outcomes.
function upperBound(sorted:readonly number[],value:number) {
  let lo=0,hi=sorted.length;
  while(lo<hi){const mid=Math.floor((lo+hi)/2);if(sorted[mid]<=value)lo=mid+1;else hi=mid;}
  return lo;
}

export function cdfAt(sorted:readonly number[],waitS:number) {
  const count=upperBound(sorted,waitS),total=sorted.length;
  return {count,total,percent:total?100*count/total:null};
}

export function nearestWaitIndex(sorted:readonly number[],waitS:number):number|null {
  if(!sorted.length)return null;
  const next=upperBound(sorted,waitS);
  if(next===0)return 0;
  if(next===sorted.length)return next-1;
  return waitS-sorted[next-1]<=sorted[next]-waitS?next-1:next;
}
