import {test, beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {ID, state, benefits} from '../scripts/rules.mjs';
import {crewSlots, setCrewSlot, saveDrop, linkView, stashOwnership, createStash, syncStashOwnership, transferMoney, openLink, payRent} from '../scripts/hq-assets.mjs';
let hq, actor, stash, docs;
function wallet(uuid, type, value) {
  return {uuid, id: uuid.split('.').at(-1), name: uuid, type, documentName:'Actor', isOwner:true, ownership:{default:0},
    system:{wealth:{value,transactions:[]}}, items:new Map(), testUserPermission:()=>true,
    sheet:{render(){this.opened=true;}}, getFlag(ns,key){return this.flags?.[ns]?.[key];},
    async update(updates){for(const [key,value] of Object.entries(updates)){const p=key.split('.'),last=p.pop();let target=this;for(const part of p)target=target[part]??= {};target[last]=value;}return this;}};
}
beforeEach(()=>{
  actor=wallet('Actor.a','character',300);stash=wallet('Actor.s','container',100);
  hq={uuid:'JournalEntry.h',name:'HQ',flags:{[ID]:{hq:state({stashUuid:stash.uuid})}},getFlag(ns,key){return this.flags[ns][key];},testUserPermission:u=>u.id!=='outsider',update:actor.update};
  stash.flags={[ID]:{headquarters:hq.uuid}};
  docs=new Map([[actor.uuid,actor],[stash.uuid,stash]]);
  globalThis.fromUuid=async uuid=>docs.get(uuid);
  globalThis.game={user:{id:'gm',name:'GM',isGM:true},users:[{id:'gm',isGM:true},{id:'player'},{id:'outsider'}],actors:{get:id=>id==='a'?actor:undefined,contents:[actor]}};
  globalThis.ui={notifications:{info(){}}};
});
test('six crew slots persist, duplicates and seventh slot reject',()=>{
  assert.equal(crewSlots().length,6);assert.equal(crewSlots(Array(8).fill('x')).length,6);
  const s=setCrewSlot([],5,'Actor.a');assert.equal(s[5],'Actor.a');
  assert.throws(()=>setCrewSlot(s,0,'Actor.a'),/already/);assert.throws(()=>setCrewSlot(s,6,'Actor.b'),/six/);
  assert.equal(setCrewSlot(s,5,'')[5],'');
});
test('crew drops save links without copying actors; player edits reject',async()=>{
  await saveDrop(hq,'crew',0,{uuid:actor.uuid});assert.equal(hq.getFlag(ID,'hq').crewSlots[0],actor.uuid);
  game.user.isGM=false;await assert.rejects(saveDrop(hq,'crew',1,{uuid:actor.uuid}),/GM/);
});
test('garage accepts vehicle Items and stand-in Actors, rejects ordinary Items',async()=>{
  const vehicle={uuid:'Item.v',documentName:'Item',type:'vehicle'};docs.set(vehicle.uuid,vehicle);
  await saveDrop(hq,'garage',0,{uuid:vehicle.uuid});assert.equal(hq.getFlag(ID,'hq').garageUuid,vehicle.uuid);
  await saveDrop(hq,'garage',0,{uuid:actor.uuid});assert.equal(hq.getFlag(ID,'hq').garageUuid,actor.uuid);
  vehicle.type='weapon';await assert.rejects(saveDrop(hq,'garage',0,{uuid:vehicle.uuid}),/vehicle/);
  await assert.rejects(saveDrop(hq,'crew',1,{uuid:vehicle.uuid}),/Actor/);
});
test('crew uses sheet portraits; garage keeps token art; restricted links hide names/art',async()=>{
  actor.img='portrait.webp';actor.prototypeToken={texture:{src:'token.webp'}};
  assert.equal((await linkView(actor.uuid)).image,'token.webp');
  assert.equal((await linkView(actor.uuid,true)).image,'portrait.webp');
  actor.testUserPermission=()=>false;const view=await linkView(actor.uuid);assert.equal(view.name,'Restricted sheet');assert.equal(view.image,undefined);
  assert.equal((await linkView('Actor.missing')).missing,true);
});
test('click opens permitted sheet but not an unshared or deleted one',async()=>{
  await openLink(actor.uuid);assert.equal(actor.sheet.opened,true);
  actor.testUserPermission=()=>false;await assert.rejects(openLink(actor.uuid),/permission/);
  await assert.rejects(openLink('missing'),/no longer/);
});
test('stash ownership grants only HQ observers; sync revokes former users',async()=>{
  assert.deepEqual(stashOwnership(hq),{default:0,player:3});
  stash.ownership.outsider=3;await syncStashOwnership(hq);assert.equal(stash.ownership.outsider,0);assert.equal(stash.ownership.player,3);
});
test('stash creation uses native stash flags and preserves existing stash',async()=>{
  let creates=0;
  globalThis.Actor={implementation:{async createDocuments(data){creates++;assert.equal(data[0].type,'container');assert.equal(data[0].flags['cyberpunk-red-core']['container-type'],'stash');assert.equal(data[0].ownership.player,3);return [stash];}}};
  await createStash(hq);assert.equal(creates,0);
  hq.flags[ID].hq.stashUuid='';await createStash(hq);assert.equal(creates,1);assert.equal(hq.getFlag(ID,'hq').stashUuid,stash.uuid);
});
test('deposit and withdrawal conserve money and record both sides',async()=>{
  await transferMoney(hq,'a','deposit',80);assert.equal(actor.system.wealth.value,220);assert.equal(stash.system.wealth.value,180);
  await transferMoney(hq,'a','withdraw',40);assert.equal(actor.system.wealth.value,260);assert.equal(stash.system.wealth.value,140);
  assert.equal(actor.system.wealth.transactions.length,2);assert.equal(stash.system.wealth.transactions.length,2);
});
test('insufficient or invalid money and unowned actors reject without changes',async()=>{
  for(const amount of [0,-1,0.5,NaN,1000])await assert.rejects(transferMoney(hq,'a','withdraw',amount));
  actor.isOwner=false;await assert.rejects(transferMoney(hq,'a','deposit',10),/own/);
  assert.equal(actor.system.wealth.value,300);assert.equal(stash.system.wealth.value,100);
});
test('failed credit refunds debit; failed refund gives reconciliation details',async()=>{
  stash.update=async()=>{throw Error('failed');};
  await assert.rejects(transferMoney(hq,'a','deposit',10),/refunded/);assert.equal(actor.system.wealth.value,300);
  const update=actor.update;let writes=0;actor.update=async function(data){if(++writes===2)throw Error('refund');return update.call(this,data);};
  await assert.rejects(transferMoney(hq,'a','deposit',10),/reconcile 10eb/);
});

function rentSetup() {
  hq.getFlag(ID,'hq').rent=100;hq.getFlag(ID,'hq').reducedRent=25;
  stash.flags['cyberpunk-red-core']={'container-type':'stash'};
  globalThis.Dialog={confirm:async()=>true};
}
test('monthly rent subtracts discount, floors at zero and ignores improvement rank',()=>{
  assert.equal(benefits({rent:100,reducedRent:25}).monthlyRent,75);
  assert.equal(benefits({rent:100,reducedRent:150}).monthlyRent,0);
});
test('rent debits only the linked HQ stash, without requiring an owned character',async()=>{
  rentSetup();game.actors.contents=[];
  await payRent(hq);assert.equal(stash.system.wealth.value,25);assert.equal(actor.system.wealth.value,300);
  assert.match(stash.system.wealth.transactions[0][1],/monthly rent/);
});
test('rent cancellation and insufficient funds never debit',async()=>{
  rentSetup();Dialog.confirm=async()=>false;await payRent(hq);assert.equal(stash.system.wealth.value,100);
  Dialog.confirm=async()=>true;stash.system.wealth.value=10;await assert.rejects(payRent(hq),/Not enough/);assert.equal(stash.system.wealth.value,10);
});
test('rent rejects an unrelated sheet, missing stash and revoked access',async()=>{
  rentSetup();hq.getFlag(ID,'hq').stashUuid=actor.uuid;await assert.rejects(payRent(hq),/shared stash/);
  hq.getFlag(ID,'hq').stashUuid=stash.uuid;stash.flags[ID].headquarters='JournalEntry.other';await assert.rejects(payRent(hq),/shared stash/);
  stash.flags[ID].headquarters=hq.uuid;stash.isOwner=false;await assert.rejects(payRent(hq),/Owner/);
  stash.isOwner=true;hq.testUserPermission=()=>false;await assert.rejects(payRent(hq),/access/);
  hq.testUserPermission=()=>true;docs.delete(stash.uuid);await assert.rejects(payRent(hq),/shared stash/);
  assert.equal(actor.system.wealth.value,300);
});
test('rent rechecks changed price, permissions and funds after confirmation',async()=>{
  rentSetup();Dialog.confirm=async()=>{hq.getFlag(ID,'hq').reducedRent=20;return true;};
  await assert.rejects(payRent(hq),/changed/);assert.equal(stash.system.wealth.value,100);
  Dialog.confirm=async()=>{stash.isOwner=false;return true;};await assert.rejects(payRent(hq),/Owner/);
  stash.isOwner=true;Dialog.confirm=async()=>{stash.system.wealth.value=0;return true;};await assert.rejects(payRent(hq),/Not enough/);
});
test('rent shares transfer lock and failed writes release it',async()=>{
  rentSetup();Dialog.confirm=async()=>{await assert.rejects(transferMoney(hq,'a','deposit',10),/progress/);return true;};
  const update=stash.update;stash.update=async()=>{throw new Error('write failed');};await assert.rejects(payRent(hq),/write failed/);
  stash.update=update;await payRent(hq);assert.equal(stash.system.wealth.value,25);
});
