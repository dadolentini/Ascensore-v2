import { expect, it } from 'vitest';
import { EventHeap } from '../../src/engine/heap';
it('orders events by timestamp then insertion counter, independently of event kind',()=>{
  const heap=new EventHeap();
  heap.push({timeS:3,kind:'DOOR',carId:0,version:0});
  heap.push({timeS:1,kind:'PARK',carId:0,version:0});
  heap.push({timeS:1,kind:'NEW',requestId:1});
  expect(heap.pop()?.kind).toBe('PARK'); expect(heap.pop()?.kind).toBe('NEW'); expect(heap.pop()?.kind).toBe('DOOR');
  expect(heap.pop()).toBeUndefined();
});
