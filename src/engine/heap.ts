type NewEvent = { timeS:number; kind:'NEW'; requestId:number };
type CarEvent = { timeS:number; kind:'ARRIVE'|'DOOR'|'PARK'; carId:number; version:number };
export type ScheduledEvent = (NewEvent|CarEvent)&{ order:number };
export type EventInput = NewEvent|CarEvent;

/** Source ordering is (time, insertion counter), never event-type priority. */
export class EventHeap {
  private items: ScheduledEvent[] = [];
  private counter = 0;
  get size():number { return this.items.length; }
  push(event:EventInput):void {
    const entry = { ...event, order:this.counter++ } as ScheduledEvent;
    let index = this.items.length; this.items.push(entry);
    while(index>0) {
      const parent=(index-1)>>1;
      if(!this.less(entry,this.items[parent])) break;
      this.items[index]=this.items[parent]; index=parent;
    }
    this.items[index]=entry;
  }
  pop():ScheduledEvent|undefined {
    const head=this.items[0]; const tail=this.items.pop();
    if(this.items.length && tail) {
      let index=0;
      while(true) {
        const left=2*index+1; if(left>=this.items.length) break;
        const right=left+1;
        const child=right<this.items.length&&this.less(this.items[right],this.items[left])?right:left;
        if(!this.less(this.items[child],tail)) break;
        this.items[index]=this.items[child]; index=child;
      }
      this.items[index]=tail;
    }
    return head;
  }
  private less(a:ScheduledEvent,b:ScheduledEvent):boolean { return a.timeS<b.timeS || (a.timeS===b.timeS&&a.order<b.order); }
}
