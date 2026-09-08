import {test} from "node:test";
import assert from "node:assert/strict";
import {state, purchase, lose, benefits, CATALOG} from "../scripts/rules.mjs";

test("custom price applies to every improvement and upgrade, including zero", () => {
  for (const purchaseCost of [0, 15, 75]) for (const {id} of CATALOG) {
    let s = state({ip: 1000, purchaseCost, rent: 1500, beds: 2});
    s = purchase(purchase(s, id), id);
    assert.equal(s.ip, 1000 - 2 * purchaseCost); assert.equal(s.spent, 2 * purchaseCost);
  }
});
test("custom prices reject invalid values and insufficient IP without rewriting history", () => {
  for (const purchaseCost of [-1, 1.5, NaN, Infinity, null, '20']) assert.throws(() => purchase(state({ip:100, purchaseCost}), 'garage'), /cost/);
  assert.throws(() => purchase(state({ip:49, purchaseCost:50}), 'garage'), /50 required/);
  let s = purchase(state({ip:100}), 'garage');
  s.purchaseCost = 15; s = purchase(s, 'garage');
  assert.equal(s.spent,55); assert.equal(s.ip,45);
  assert.equal(state({ip:100}).purchaseCost,40);
});

test("all twelve improvements cost 40 and ordinary upgrades stop at one", () => {
  for (const {id} of CATALOG) {
    let s = state({ip: 1000, rent: 1500, beds: 2});
    s = purchase(s, id); assert.equal(s.ip, 960); assert.equal(s.spent, 40);
    s = purchase(s, id); assert.equal(s.ip, 920);
    if (!["morale", "rent"].includes(id)) assert.throws(() => purchase(s, id), /Maximum/);
  }
});
test("reject overspending, lost access, and faction spending without mutating input", () => {
  for (const s of [state(), state({ip: 40, access: false}), state({ip: 40, faction: true})]) {
    const before = structuredClone(s);
    assert.throws(() => purchase(s, "garage")); assert.deepEqual(s, before);
  }
});
test("rent requires rent and permits exactly original-bed-count upgrades", () => {
  assert.throws(() => purchase(state({ip: 40}), "rent"), /monthly rent/);
  let s = state({ip: 500, rent: 3000, reducedRent: 2000, beds: 2});
  for (let i = 0; i < 3; i++) s = purchase(s, "rent");
  assert.equal(benefits(s).beds, 4); assert.equal(benefits(s).monthlyRent, 1000);
  assert.throws(() => purchase(s, "rent"), /Maximum/);
});
test("morale replacement thresholds and stacking with medbay", () => {
  let s = purchase(state({ip: 1000}), "medbay");
  s = purchase(s, "morale"); assert.equal(benefits(s).lifestyle, 50);
  const humanity = ["None", "1d6 / 2 (round down)", "1d6 / 2 (round down)", "1d6 / 2 (round down)", "1d6", "1d6", "1d6", "1d6", "1d6", "2d6, keep highest", "2d6, keep highest"];
  for (let upgrade = 1; upgrade <= 10; upgrade++) {
    s = purchase(s, "morale"); const b = benefits(s);
    assert.equal(b.humanity, humanity[upgrade]);
    assert.equal(b.healing, upgrade >= 2 ? 3 : 2);
    assert.equal(b.luck, upgrade >= 7 ? 2 : upgrade >= 3 ? 1 : 0);
    assert.equal(b.negotiation, upgrade >= 5); assert.equal(b.custom, upgrade === 10);
    assert.equal(b.hustle, upgrade >= 8 ? "Roll twice; earn both" : upgrade >= 6 ? "Roll twice; choose one" : "Normal");
  }
  assert.throws(() => purchase(s, "morale"), /Maximum/);
  const suspended = benefits({...s, access: false});
  assert.equal(suspended.luck, 0); assert.equal(suspended.healing, 0); assert.equal(suspended.humanity, "None");
});
test("garage destruction removes both ranks without refund and allows repurchase", () => {
  let s = state({ip: 160}); s = purchase(purchase(s, "garage"), "garage");
  s = lose(s, "garage"); assert.equal(s.ip, 80); assert.equal(s.spent, 80);
  assert.equal(s.improvements.garage, 0); assert.equal(purchase(s, "garage").ip, 40);
});
test("lost upgraded workstation must be fully restored first", () => {
  let s = state({ip: 400}); s = purchase(purchase(s, "workstation"), "workstation");
  s = lose(s, "workstation"); assert.equal(s.workstationDebt, true);
  assert.throws(() => purchase(s, "garage"), /Workstation/);
  s = purchase(s, "workstation"); assert.equal(s.workstationDebt, true);
  s = purchase(s, "workstation"); assert.equal(s.workstationDebt, false);
  assert.equal(purchase(s, "garage").improvements.garage, 1);
});
