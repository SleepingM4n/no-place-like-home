import {test} from 'node:test';
import assert from 'node:assert/strict';
import {state, saveCustom, catalog, purchase, purchaseError, lose, limit} from '../scripts/rules.mjs';
import {escapeHTML} from '../scripts/custom-improvements.mjs';
const entry = {id:'custom_test', name:'Safe Room', base:'A secure meeting room.', upgrades:['Soundproofing.', 'Independent power.']};

test('custom definitions extend the default catalog and do not purchase or mutate the source', () => {
  const original=state({ip:100}); const s=saveCustom(original, entry);
  assert.equal(catalog(s).length,13); assert.equal(catalog(original).length,12);
  assert.equal(s.ip,100); assert.equal(s.improvements.custom_test,0);
  assert.equal(limit(s,entry.id),3);
});
test('custom base and ordered tiers charge the shared price and enforce the limit', () => {
  let s=saveCustom(state({ip:100,purchaseCost:25}),entry);
  for(let i=1;i<=3;i++){s=purchase(s,entry.id);assert.equal(s.improvements[entry.id],i);}
  assert.equal(s.ip,25);assert.equal(s.spent,75);assert.match(purchaseError(s,entry.id),/Maximum/);
  s=lose(s,entry.id);assert.equal(s.improvements[entry.id],0);assert.equal(s.spent,75);
  assert.equal(s.customImprovements.length,1);
});
test('custom entries support zero upgrades and obey access, faction and debt restrictions', () => {
  const s=saveCustom(state({ip:100}),{...entry,upgrades:[]});
  assert.equal(limit(s,entry.id),1);
  for(const patch of [{access:false},{faction:true},{workstationDebt:true},{ip:0}]) assert.ok(purchaseError({...s,...patch},entry.id));
  assert.equal(purchase({...s,purchaseCost:0},entry.id).ip,100);
});
test('editing preserves spending and ranks; purchased tiers cannot be removed', () => {
  const bought=purchase(purchase(saveCustom(state({ip:100}),entry),entry.id),entry.id);
  assert.throws(()=>saveCustom(bought,{...entry,upgrades:[]}),/already purchased/);
  const edited=saveCustom(bought,{...entry,name:'New name',upgrades:['Changed tier','Another tier','New tier']});
  assert.equal(edited.improvements[entry.id],2);assert.equal(edited.ip,20);assert.equal(edited.spent,80);
  assert.equal(edited.customImprovements.length,1);
});
test('invalid definitions reject and text escapes safely in dialogs', () => {
  for(const patch of [{id:'garage'},{id:'__proto__'},{name:' '},{base:''},{upgrades:Array(51).fill('x')}]) assert.throws(()=>saveCustom(state(),{...entry,...patch}));
  assert.equal(escapeHTML('<img src="x">&'), '&lt;img src=&quot;x&quot;&gt;&amp;');
});
