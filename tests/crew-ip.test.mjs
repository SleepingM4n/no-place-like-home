import {test, beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {state} from '../scripts/rules.mjs';
import {ipRecipients, awardCrewIP} from '../scripts/crew-ip.mjs';
let hq, a, b, vehicle, docs, warnings;
function character(uuid) {
  return {uuid, name:uuid, type:'character', documentName:'Actor',
    system:{improvementPoints:{value:10,transactions:[['Old award','Old reason']]},wealth:{value:100,transactions:[['Old pay','Old payment']]}},
    async update(data){for(const [key,value] of Object.entries(data)){const [,ledger,field]=key.split('.');this.system[ledger][field]=value;}}};
}
beforeEach(()=>{
  a=character('Actor.a');b=character('Actor.b');vehicle=character('Actor.vehicle');
  docs=new Map([a,b,vehicle].map(doc=>[doc.uuid,doc]));
  hq={hq:state({ip:80,crewSlots:[a.uuid,b.uuid],garageUuid:vehicle.uuid}),getFlag(){return this.hq;}};
  globalThis.fromUuid=async uuid=>docs.get(uuid);
  globalThis.game={user:{isGM:true,name:'GM'}};warnings=[];
  globalThis.ui={notifications:{info(){},warn:message=>warnings.push(message)}};
});
test('recipient list only includes distinct linked characters, excluding garage and mooks',async()=>{
  const mook={...character('Actor.mook'),type:'mook'};docs.set(mook.uuid,mook);
  hq.hq.crewSlots=[a.uuid,a.uuid,vehicle.uuid,'Actor.deleted',mook.uuid];
  assert.deepEqual((await ipRecipients(hq)).map(a=>a.uuid),[a.uuid]);
});
test('award selected member only, retaining ledger history and the exact reason',async()=>{
  await awardCrewIP(hq,[a.uuid],40,'Mission: <The Rescue>');
  assert.equal(a.system.improvementPoints.value,50);assert.equal(b.system.improvementPoints.value,10);
  assert.deepEqual(a.system.improvementPoints.transactions[0],['Old award','Old reason']);
  assert.equal(a.system.improvementPoints.transactions[1][1],'Mission: <The Rescue>');
  assert.equal(vehicle.system.improvementPoints.value,10);assert.equal(hq.hq.ip,80);
});
test('each selected member receives full award; duplicates cannot receive it twice',async()=>{
  await awardCrewIP(hq,[a.uuid,b.uuid,a.uuid],30,'Job');
  assert.equal(a.system.improvementPoints.value,40);assert.equal(b.system.improvementPoints.value,40);
});
test('unlinked, removed and vehicle recipients reject before any actor is updated',async()=>{
  await assert.rejects(awardCrewIP(hq,[a.uuid,vehicle.uuid],40,'Job'),/changed/);
  hq.hq.crewSlots=[b.uuid];await assert.rejects(awardCrewIP(hq,[a.uuid],40,'Job'),/changed/);
  assert.equal(a.system.improvementPoints.value,10);
});
test('empty selection, invalid amounts, blank reason and non-GM calls reject',async()=>{
  await assert.rejects(awardCrewIP(hq,[],40,'Job'),/Select/);
  for(const amount of [0,-1,1.5,NaN,Infinity])await assert.rejects(awardCrewIP(hq,[a.uuid],amount,'Job'),/positive/);
  await assert.rejects(awardCrewIP(hq,[a.uuid],40,'  '),/reason/);
  game.user.isGM=false;await assert.rejects(awardCrewIP(hq,[a.uuid],40,'Job'),/GM/);
  assert.equal(a.system.improvementPoints.value,10);
});
test('preflight stops all updates if any selected ledger is invalid',async()=>{
  b.system.improvementPoints.value=NaN;
  await assert.rejects(awardCrewIP(hq,[a.uuid,b.uuid],40,'Job'),/ledger/);
  assert.equal(a.system.improvementPoints.value,10);
});
test('partial failure reports successful and failed recipients without re-awarding',async()=>{
  b.update=async()=>{throw Error('write failed');};
  const result=await awardCrewIP(hq,[a.uuid,b.uuid],40,'Job');
  assert.deepEqual(result,{awarded:[a.name],failed:[b.name]});assert.equal(warnings.length,1);
  assert.equal(a.system.improvementPoints.value,50);assert.equal(b.system.improvementPoints.value,10);
});
test('money award credits only selected crew, appends reason and preserves IP and stash',async()=>{
  const stash=character('Actor.stash');docs.set(stash.uuid,stash);hq.hq.stashUuid=stash.uuid;
  await awardCrewIP(hq,[a.uuid,a.uuid],250,'Mission payment',true);
  assert.equal(a.system.wealth.value,350);assert.equal(b.system.wealth.value,100);
  assert.deepEqual(a.system.wealth.transactions,[['Old pay','Old payment'],['+250 eb; balance 350 eb','Mission payment']]);
  assert.equal(a.system.improvementPoints.value,10);assert.equal(hq.hq.ip,80);
  assert.equal(stash.system.wealth.value,100);assert.equal(vehicle.system.wealth.value,100);
});
test('money award gives full amount to each selected recipient',async()=>{
  await awardCrewIP(hq,[a.uuid,b.uuid],500,'Job',true);
  assert.equal(a.system.wealth.value,600);assert.equal(b.system.wealth.value,600);
});
test('money awards reject vehicle, empty selection, invalid amount, blank reason and non-GM',async()=>{
  await assert.rejects(awardCrewIP(hq,[vehicle.uuid],100,'Pay',true),/changed/);
  await assert.rejects(awardCrewIP(hq,[],100,'Pay',true),/Select/);
  for(const amount of [0,-1,0.5,NaN,Infinity])await assert.rejects(awardCrewIP(hq,[a.uuid],amount,'Pay',true),/positive/);
  await assert.rejects(awardCrewIP(hq,[a.uuid],100,'',true),/reason/);
  game.user.isGM=false;await assert.rejects(awardCrewIP(hq,[a.uuid],100,'Pay',true),/GM/);
  assert.equal(a.system.wealth.value,100);
});
test('invalid money ledger preflight and partial write failure are reported safely',async()=>{
  b.system.wealth.value=NaN;await assert.rejects(awardCrewIP(hq,[a.uuid,b.uuid],100,'Pay',true),/Eurobucks/);
  assert.equal(a.system.wealth.value,100);b.system.wealth.value=100;
  b.update=async()=>{throw Error('failed');};
  assert.deepEqual(await awardCrewIP(hq,[a.uuid,b.uuid],100,'Pay',true),{awarded:[a.name],failed:[b.name]});
  assert.equal(a.system.wealth.value,200);assert.equal(b.system.wealth.value,100);assert.match(warnings[0],/Money award/);
});
