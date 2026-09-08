import {test, beforeEach} from "node:test";
import assert from "node:assert/strict";
import {state} from "../scripts/rules.mjs";
import {HUSTLES, hustleResult, moraleMode, recover, healingAmount, ownedCharacters, requireCharacter, roleTable,
  applyHealing, applyHumanity, applyHustle, applyLifestyle, lifestyleOptions, LIFESTYLES, runBenefit, escapeHTML} from "../scripts/character-benefits.mjs";

let actor, doc, messages, warnings, dice, formulas;
const role = {id: "solo", type: "role", name: "Solo", system: {rank: 4}};
beforeEach(() => {
  messages = []; warnings = []; dice = []; formulas = [];
  actor = {id: "owned", type: "character", isOwner: true, name: "V <test>",
    system: {stats: {body: {value: 6}, emp: {value: 3}}, derivedStats: {hp: {value: 10, max: 40}, humanity: {value: 39, max: 60}}, wealth: {value: 100, transactions: [["Old", "entry"]]}},
    items: new Map([[role.id, structuredClone(role)]]), _calcMaxHumanity: () => 58,
    async update(data) {this.lastUpdate = data; for (const [key, value] of Object.entries(data)) {const path = key.split("."); const prop = path.pop(); let target = this; for (const part of path) target = target[part]; target[prop] = value;} return this;}};
  doc = {name: "HQ", hq: state(), testUserPermission: () => true, getFlag() {return this.hq;}};
  globalThis.game = {user: {name: "Player", isGM: false}, actors: {contents: [actor], get: id => id === actor.id ? actor : undefined}};
  globalThis.ui = {notifications: {info() {}, warn: t => warnings.push(t)}};
  globalThis.ChatMessage = {getSpeaker: ({actor: a}) => ({actor: a.id}), create: async data => messages.push(data)};
  globalThis.Roll = class {constructor(formula) {this.formula = formula; formulas.push(formula);} async evaluate() {this.total = dice.shift(); return this;} async toMessage(data) {messages.push({...data, total: this.total});}};
});

test('lifestyle prices debit all four tiers with and without the Morale discount', async () => {
  for (const morale of [0,1,11]) for (const lifestyle of LIFESTYLES) {
    doc.hq.improvements.morale=morale;actor.items=new Map([['life',{name:lifestyle.name}]]);
    actor.system.wealth={value:2000,transactions:[['Old','entry']]};
    const amount=lifestyle.cost-(morale?50:0);
    await applyLifestyle(doc,actor.id,lifestyle.name,amount);
    assert.equal(actor.system.wealth.value,2000-amount);
    assert.deepEqual(actor.system.wealth.transactions[0],['Old','entry']);
    assert.match(actor.system.wealth.transactions[1][1],new RegExp(lifestyle.name));
  }
});
test('lifestyle detection ignores case and surrounding spaces and deduplicates matches', () => {
  actor.items=new Map([['a',{name:' kibble '}],['b',{name:'KIBBLE'}],['c',{name:'Fresh Food'}],['d',{name:'Kibble bag'}]]);
  assert.deepEqual(lifestyleOptions(actor,doc.hq).map(x=>x.name),['Kibble','Fresh Food']);
});
test('lifestyle rejects insufficient funds, removed items, changed discount and revoked permissions', async () => {
  actor.items.set('life',{name:'Good Prepak'});
  await assert.rejects(applyLifestyle(doc,actor.id,'Good Prepak',600),/Not enough/);
  actor.system.wealth.value=1000;doc.hq.improvements.morale=1;
  await assert.rejects(applyLifestyle(doc,actor.id,'Good Prepak',600),/changed/);
  await assert.rejects(applyLifestyle(doc,actor.id,'Kibble',50),/no longer/);
  actor.isOwner=false;await assert.rejects(applyLifestyle(doc,actor.id,'Good Prepak',550),/own/);
  actor.isOwner=true;doc.hq.access=false;await assert.rejects(applyLifestyle(doc,actor.id,'Good Prepak',550),/access is lost/);
  doc.hq.access=true;doc.testUserPermission=()=>false;await assert.rejects(applyLifestyle(doc,actor.id,'Good Prepak',550),/HQ record/);
  assert.equal(actor.lastUpdate,undefined);
});
test('lifestyle failed writes and malformed ledgers do not report a payment', async () => {
  actor.items.set('life',{name:'Kibble'});actor.system.wealth.transactions=[null];
  await assert.rejects(applyLifestyle(doc,actor.id,'Kibble',100),/ledger/);
  actor.system.wealth.transactions=[];actor.update=async()=>{throw new Error('Failed write');};
  await assert.rejects(applyLifestyle(doc,actor.id,'Kibble',100),/Failed write/);
  assert.equal(messages.length,0);
});
test('lifestyle UI cancellation makes no debit and selected item determines the payment', async () => {
  actor.items.set('a',{name:'Kibble'});actor.items.set('b',{name:'Fresh Food'});actor.system.wealth.value=2000;
  let cancel=true;
  globalThis.Dialog=class {constructor(config){this.config=config;}render(){
    if(this.config.title==='Pay monthly lifestyle') this.config.buttons.apply.callback({find:()=>({val:()=>actor.id})});
    else if(cancel) this.config.buttons.cancel.callback();
    else this.config.buttons.apply.callback({find:()=>({val:()=> 'Fresh Food'})});
  }};
  await runBenefit(doc,'lifestyle');assert.equal(actor.system.wealth.value,2000);
  cancel=false;await runBenefit(doc,'lifestyle');assert.equal(actor.system.wealth.value,500);
});
test("heals BODY plus stacked HQ bonuses over multiple days and caps at maximum", async () => {
  doc.hq.improvements.medbay = 1; doc.hq.improvements.morale = 3;
  await applyHealing(doc, actor.id, 2); assert.equal(actor.system.derivedStats.hp.value, 28);
  assert.match(messages[0].content, /10 → 28/);
  await applyHealing(doc, actor.id, 4); assert.equal(actor.system.derivedStats.hp.value, 40);
});
test("full HP and over-cap resources are never reduced by recovery", () => {
  assert.deepEqual(recover(40, 40, 20), {value: 40, gained: 0});
  assert.deepEqual(recover(50, 40, 20), {value: 50, gained: 0});
});
test("reject invalid day counts, missing BODY and invalid resource values", () => {
  for (const days of [0, -1, 0.5, NaN, Infinity]) assert.throws(() => healingAmount(6, 2, days));
  assert.throws(() => healingAmount(undefined, 2, 1)); assert.throws(() => recover(undefined, 40, 8));
});
test("character selector excludes unowned actors and non-character documents", () => {
  game.actors.contents.push({...actor, id: "other", isOwner: false}, {...actor, id: "npc", type: "mook"});
  assert.deepEqual(ownedCharacters().map(a => a.id), [actor.id]);
  assert.throws(() => requireCharacter("other"), /own/);
});
test("player owners can heal without editing the HQ, but revoked actor/HQ permissions reject", async () => {
  await applyHealing(doc, actor.id, 1); assert.equal(actor.system.derivedStats.hp.value, 16);
  actor.isOwner = false; await assert.rejects(applyHealing(doc, actor.id, 1), /own/);
  actor.isOwner = true; doc.testUserPermission = () => false;
  await assert.rejects(applyHealing(doc, actor.id, 1), /HQ record/);
});
test("access loss blocks all three actions before rolling or updating", async () => {
  doc.hq.access = false;
  await assert.rejects(applyHealing(doc, actor.id, 1), /access is lost/);
  await assert.rejects(applyHumanity(doc, actor.id), /access is lost/);
  await assert.rejects(applyHustle(doc, actor.id, {roleId: "solo", table: "solo"}), /access is lost/);
  assert.equal(formulas.length, 0); assert.equal(actor.lastUpdate, undefined);
});
test("Humanity formulas replace at upgrades 1, 4 and 9", () => {
  for (let upgrades = 0; upgrades <= 10; upgrades++) {
    const s = state(); s.improvements.morale = upgrades + 1;
    assert.equal(moraleMode(s).humanityFormula, upgrades >= 9 ? "2d6kh1" : upgrades >= 4 ? "1d6" : upgrades >= 1 ? "floor(1d6 / 2)" : null);
  }
});
test("Humanity uses cyberware-adjusted cap and updates EMP in the same write", async () => {
  doc.hq.improvements.morale = 5; dice.push(5);
  await applyHumanity(doc, actor.id); assert.equal(actor.system.derivedStats.humanity.value, 44); assert.equal(actor.system.stats.emp.value, 4);
  actor.system.derivedStats.humanity.value = 57; dice.push(6);
  await applyHumanity(doc, actor.id); assert.equal(actor.system.derivedStats.humanity.value, 58); assert.equal(actor.system.derivedStats.humanity.max, 58);
  assert.deepEqual(formulas, ["1d6", "1d6"]);
});
test("Humanity with no upgrade rejects and a permission change after rolling prevents update", async () => {
  await assert.rejects(applyHumanity(doc, actor.id), /Morale/);
  doc.hq.improvements.morale = 2; dice.push(2);
  Roll.prototype.toMessage = async () => {actor.isOwner = false;};
  await assert.rejects(applyHumanity(doc, actor.id), /own/); assert.equal(actor.lastUpdate, undefined);
});
test("all role payouts match all d6 rows at the three rank bands", () => {
  const expected = {
    rockerboy: [[200,0,300,300,300,200],[300,100,500,500,500,300],[600,300,800,800,800,600]],
    solo: [[100,200,200,100,0,100],[200,300,300,200,100,200],[500,600,600,500,300,500]],
    netrunner: [[100,200,0,200,200,200],[200,300,100,300,300,300],[500,600,300,600,600,600]],
    tech: [[0,100,200,100,100,100],[100,200,300,200,200,200],[300,500,600,500,500,500]],
    medtech: [[100,200,100,0,200,100],[200,300,200,100,300,200],[500,600,500,300,600,500]],
    media: [[300,200,200,200,0,300],[500,300,300,300,100,500],[800,600,600,600,300,800]],
    lawman: [[100,200,0,100,200,200],[200,300,100,200,300,300],[500,600,300,500,600,600]],
    exec: [[300,0,200,300,300,200],[500,100,300,500,500,300],[800,300,600,800,800,600]],
    fixer: [[200,200,200,0,200,300],[300,300,300,100,300,500],[600,600,600,300,600,800]],
    nomad: [[100,100,100,200,100,0],[200,200,200,300,200,100],[500,500,500,600,500,300]]
  };
  for (const key of Object.keys(HUSTLES)) for (const rank of [1,4,5,7,8,10]) {
    assert.deepEqual([1,2,3,4,5,6].map(die => hustleResult(key, rank, die).amount), expected[key][rank >= 8 ? 2 : rank >= 5 ? 1 : 0]);
  }
  assert.throws(() => hustleResult("solo", 0, 1)); assert.throws(() => hustleResult("unknown", 4, 1));
});
test("normal Hustle rolls once and appends income to the existing wealth ledger", async () => {
  dice.push(2); await applyHustle(doc, actor.id, {roleId: "solo", table: "solo"});
  assert.equal(actor.system.wealth.value, 300); assert.equal(actor.system.wealth.transactions.length, 2);
  assert.deepEqual(actor.system.wealth.transactions[0], ["Old", "entry"]); assert.deepEqual(formulas, ["1d6"]);
});
test("Morale upgrades 6–7 allow either outcome, including the lower-paying choice", async () => {
  doc.hq.improvements.morale = 7; dice.push(1,2);
  await applyHustle(doc, actor.id, {roleId: "solo", table: "solo"}, async results => {assert.equal(results.length, 2); return 0;});
  assert.equal(actor.system.wealth.value, 200); assert.equal(formulas.length, 2);
});
test("Morale upgrade 8 pays both rolls, including identical results", async () => {
  doc.hq.improvements.morale = 9; dice.push(2,2);
  await applyHustle(doc, actor.id, {roleId: "solo", table: "solo"}, () => {throw new Error("Should not ask");});
  assert.equal(actor.system.wealth.value, 500);
});
test("cancelled Hustle choice leaves money unchanged and dice visible in chat", async () => {
  doc.hq.improvements.morale = 7; dice.push(1,2);
  assert.equal(await applyHustle(doc, actor.id, {roleId: "solo", table: "solo"}, async () => null), null);
  assert.equal(actor.system.wealth.value, 100); assert.equal(messages.length, 2);
});
test("missing role and out-of-range rank fail before dice or money changes", async () => {
  await assert.rejects(applyHustle(doc, actor.id, {roleId: "missing", table: "solo"}), /Role/);
  actor.items.get("solo").system.rank = 0;
  await assert.rejects(applyHustle(doc, actor.id, {roleId: "solo", table: "solo"}), /rank/);
  assert.equal(formulas.length, 0); assert.equal(actor.lastUpdate, undefined);
});
test("translated or renamed core Roles can be identified by their compendium source", () => {
  assert.equal(roleTable({name: "Translated", _stats: {compendiumSource: "Compendium.cyberpunk-red-core.core_roles.Item.I4qtphsiVa4rj9U8"}}), "solo");
  assert.equal(roleTable({name: "Translated", flags: {babele: {originalName: "Medtech"}}}), "medtech");
  assert.equal(roleTable({name: "Custom"}), "");
});
test("failed character update does not post a success receipt; failed chat does not repeat an applied update", async () => {
  actor.update = async () => {throw new Error("Write failed");};
  await assert.rejects(applyHealing(doc, actor.id, 1), /Write failed/); assert.equal(messages.length, 0);
});
test("chat failure after a successful update warns that the action was already applied", async () => {
  ChatMessage.create = async () => {throw new Error("Chat failed");};
  await applyHealing(doc, actor.id, 1); assert.equal(actor.system.derivedStats.hp.value, 16); assert.equal(warnings.length, 1);
});
test("player-provided strings are escaped in dialog and chat markup", () => {
  assert.equal(escapeHTML('<img src="x">'), "&lt;img src=&quot;x&quot;&gt;");
});
