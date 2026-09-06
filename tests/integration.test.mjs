import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync, existsSync} from "node:fs";
import {ID, state, saveCustom} from "../scripts/rules.mjs";

const hooks = new Map();
globalThis.Hooks = {once: (name, fn) => hooks.set(name, fn), on: (name, fn) => hooks.set(name, fn)};
globalThis.DocumentSheet = class {
  constructor(document) { this.document = document; }
  get isEditable() { return true; }
  async submit() {}
};
globalThis.game = {user: {isGM: true, name: "GM"}, modules: new Map([[ID, {}]])};
globalThis.Dialog = {confirm: async () => true};
const {HeadquartersSheet} = await import("../scripts/module.mjs");
function sheet() {
  const doc = {name: "HQ", hq: state({ip: 40}), getFlag() {return this.hq;}, async setFlag(ns, key, value) {this.hq = value;}};
  const app = new HeadquartersSheet(doc);
  app.element = {find: () => ({val: () => "60"})};
  return app;
}
test('custom purchases, active benefits, loss and HQ destruction persist correctly', async () => {
  const app=sheet();
  app.document.hq=saveCustom(state({ip:200}),{id:'custom_room',name:'<Room>',base:'Base',upgrades:['Tier one']});
  Dialog.confirm=async ({content})=>{assert.ok(!content.includes('<Room>'));return true;};
  try {
    await app.act('buy','custom_room'); await app.act('buy','custom_room');
    const data=await app.getData();assert.equal(data.customBenefits[0].acquiredUpgrades[0],'Tier one');
    assert.equal(data.cards.find(c=>c.id==='custom_room').maxUpgrades,1);
    app.document.hq.access=false;assert.equal((await app.getData()).customBenefits.length,0);
    app.document.hq.access=true;await app.act('destroy');
    assert.equal(app.document.hq.improvements.custom_room,0);assert.equal(app.document.hq.spent,80);
    assert.equal(app.document.hq.customImprovements.length,1);
  } finally {Dialog.confirm=async()=>true;}
});
test('custom deletion is GM-only and preserves historical spending', async () => {
  const app=sheet(); app.document.hq=saveCustom(state({spent:40}),{id:'custom_room',name:'Room',base:'Base',upgrades:[]});
  game.user.isGM=false;
  try {await app.act('custom-delete','custom_room');assert.equal(app.document.hq.customImprovements.length,1);}
  finally {game.user.isGM=true;}
  await app.act('custom-delete','custom_room');assert.equal(app.document.hq.customImprovements.length,0);assert.equal(app.document.hq.spent,40);
});
test("sheet purchase persists IP, rank and activity", async () => {
  const app = sheet(); await app.act("buy", "garage");
  assert.equal(app.document.hq.ip, 0); assert.equal(app.document.hq.improvements.garage, 1);
  assert.equal(app.document.hq.log.length, 1);
});
test("award is captured before form submission can rerender", async () => {
  const app = sheet(); app.submit = async () => {app.element.find = () => ({val: () => "40"});};
  await app.act("award"); assert.equal(app.document.hq.ip, 100);
});
test("custom purchase cost appears in confirmation, deduction and activity", async () => {
  const app=sheet();app.document.hq.purchaseCost=15;
  Dialog.confirm=async ({content})=>{assert.match(content,/Spend 15 HQ IP/);return true;};
  try {await app.act('buy','garage');assert.equal(app.document.hq.ip,25);assert.match(app.document.hq.log[0].label,/-15 HQ IP/);}
  finally {Dialog.confirm=async()=>true;}
});
test("price changes while confirmation is open require a fresh review", async () => {
  const app=sheet();Dialog.confirm=async()=>{app.document.hq.purchaseCost=20;return true;};
  try {await assert.rejects(app.act('buy','garage'),/cost changed/);assert.equal(app.document.hq.ip,40);}
  finally {Dialog.confirm=async()=>true;}
});
test("GM can save a custom price but players and invalid input cannot", async () => {
  const app=sheet();let saved;
  app.document.update=async data=>{saved=data;};
  await app._updateObject(null,{purchaseCost:'25'});assert.equal(saved[`flags.${ID}.hq.purchaseCost`],25);
  await assert.rejects(app._updateObject(null,{purchaseCost:-2}));
  saved=null;game.user.isGM=false;
  try {await app._updateObject(null,{purchaseCost:5});assert.equal(saved,null);}
  finally {game.user.isGM=true;}
});
test("cancelled purchase changes nothing", async () => {
  const app = sheet(); Dialog.confirm = async () => false;
  await app.act("buy", "garage"); assert.equal(app.document.hq.ip, 40);
  Dialog.confirm = async () => true;
});
test("players receive a read-only sheet and cannot purchase", async () => {
  const app = sheet(); game.user.isGM = false;
  try {assert.equal((await app.getData()).editable, false); await app.act("buy", "garage"); assert.equal(app.document.hq.ip, 40);}
  finally {game.user.isGM = true;}
});
test("manifest assets exist and template block helpers balance", () => {
  const manifest = JSON.parse(readFileSync(new URL("../module.json", import.meta.url)));
  for (const path of [...manifest.esmodules, ...manifest.styles]) assert.ok(existsSync(new URL(`../${path}`, import.meta.url)));
  const source = readFileSync(new URL("../templates/hq.hbs", import.meta.url), "utf8");
  const stack = [];
  for (const match of source.matchAll(/{{([#/])(\w+)[^}]*}}/g)) {
    if (match[1] === "#") stack.push(match[2]); else assert.equal(stack.pop(), match[2]);
  }
  assert.equal(stack.length, 0);
});
