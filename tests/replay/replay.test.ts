import { describe, expect, it } from 'vitest';
import { replayAt } from '../../src/features/replay/state';
import type { ReplaySnapshot, TraceEvent } from '../../src/model/contracts';
const initial:ReplaySnapshot={timeS:0,requests:[],cars:[{id:0,floor:0,nextFloor:null,mode:'idle',onboardIds:[],actualWeightKg:0,departureS:null,arrivalS:null,eventVersion:0}]};
const events:TraceEvent[]=[{sequence:0,timeS:1,kind:'DEPART',carChanges:[{...initial.cars[0],mode:'moving',nextFloor:2,departureS:1,arrivalS:5}],requestChanges:[],links:[]},{sequence:1,timeS:5,kind:'ARRIVE',carChanges:[{...initial.cars[0],floor:2}],requestChanges:[],links:[]}];
describe('replay immutabile per eventi',()=>{
 it('avanti, indietro e seek ricostruiscono lo stesso stato senza cambiare origine',()=>{
  expect(replayAt(initial,events,1).cars[0].floor).toBe(2);
  expect(replayAt(initial,events,0).cars[0].mode).toBe('moving');
  expect(replayAt(initial,events,-1)).toEqual(initial);expect(initial.cars[0].floor).toBe(0);
 });
});
