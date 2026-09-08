import {ID, state, benefits} from "./rules.mjs";
import {escapeHTML, ownedCharacters, requireCharacter} from "./character-benefits.mjs";

export function crewSlots(raw = []) { return Array.from({length: 6}, (_, i) => typeof raw[i] === "string" ? raw[i] : ""); }
export function setCrewSlot(raw, index, uuid) {
  if (!Number.isInteger(index) || index < 0 || index > 5) throw new Error("Choose one of the six crew slots.");
  const slots = crewSlots(raw);
  if (uuid && slots.some((entry, i) => entry === uuid && i !== index)) throw new Error("That character is already in the crew.");
  slots[index] = uuid; return slots;
}
export async function resolveLink(uuid) {
  if (!uuid) return null;
  try { return await fromUuid(uuid); } catch { return null; }
}
export async function linkView(uuid, portrait = false) {
  const doc = await resolveLink(uuid);
  if (!doc) return {uuid, missing: Boolean(uuid), name: uuid ? "Missing sheet" : "Empty slot"};
  if (!doc.testUserPermission(game.user, "LIMITED")) return {uuid, name: "Restricted sheet", restricted: true};
  const image = portrait ? doc.img : doc.prototypeToken?.texture?.src || doc.img;
  return {uuid, name: doc.name, image: image || "icons/svg/mystery-man.svg", linked: true};
}
export async function assetData(hq) {
  const s = state(hq.getFlag(ID, "hq"));
  const crew = await Promise.all(crewSlots(s.crewSlots).map(async (uuid, index) => ({...await linkView(uuid, true), index})));
  const garage = await linkView(s.garageUuid), stash = await resolveLink(s.stashUuid);
  const allowed = stash?.type === "container" && stash.testUserPermission(game.user, "OBSERVER");
  return {crew, garage, stash: allowed ? {name: stash.name, balance: stash.system.wealth.value, count: stash.items.size,
    canPayRent: stash.isOwner && stash.getFlag(ID, 'headquarters') === hq.uuid && stash.getFlag('cyberpunk-red-core', 'container-type') === 'stash' && benefits(s).monthlyRent > 0,
    canTransfer: stash.isOwner && ownedCharacters().length > 0} : null, stashMissing: Boolean(s.stashUuid && !stash)};
}
export async function openLink(uuid) {
  const doc = await resolveLink(uuid);
  if (!doc) throw new Error("That sheet no longer exists. Ask the GM to replace its link.");
  if (!doc.testUserPermission(game.user, "LIMITED")) throw new Error("You do not have permission to open that sheet.");
  doc.sheet.render(true);
}
export async function saveDrop(hq, kind, index, data) {
  if (!game.user.isGM) throw new Error("The GM manages crew and garage links.");
  const doc = await resolveLink(data.uuid);
  if (!doc || doc.pack) throw new Error("Drop a sheet from this world, not a compendium.");
  if (kind === "crew") {
    if (doc.documentName !== "Actor" || !["character", "mook"].includes(doc.type)) throw new Error("Crew slots accept character or NPC Actor sheets.");
    const s = state(hq.getFlag(ID, "hq"));
    await hq.update({[`flags.${ID}.hq.crewSlots`]: setCrewSlot(s.crewSlots, index, doc.uuid)});
  } else if (kind === "garage") {
    if (!(doc.documentName === "Actor" || (doc.documentName === "Item" && doc.type === "vehicle"))) throw new Error("Drop a vehicle Item or an Actor used as a vehicle sheet.");
    await hq.update({[`flags.${ID}.hq.garageUuid`]: doc.uuid});
  }
}
export function stashOwnership(hq) {
  return {default: 0, ...Object.fromEntries(game.users.filter(u => !u.isGM && hq.testUserPermission(u, "OBSERVER")).map(u => [u.id, 3]))};
}
export async function createStash(hq) {
  if (!game.user.isGM) throw new Error("Ask the GM to create the shared stash.");
  const existing = await resolveLink(state(hq.getFlag(ID, "hq")).stashUuid);
  if (existing) return existing;
  // Batch creation bypasses 0.92.4's CPRContainerActor.create(), which defaults
  // to shop mode and does not return the created document.
  const [stash] = await Actor.implementation.createDocuments([{name: `${hq.name} — Shared Stash`, type: "container", img: "icons/svg/chest.svg", system: {},
    ownership: stashOwnership(hq), flags: {[ID]: {headquarters: hq.uuid}, "cyberpunk-red-core": {
      "container-type": "stash", "items-free": true, "players-create": true, "players-delete": true,
      "players-modify": true, "players-move": true, "players-sell": false, "infinite-stock": false}}}]);
  if (!stash) throw new Error("The system could not create the stash.");
  await hq.update({[`flags.${ID}.hq.stashUuid`]: stash.uuid});
  return stash;
}
export async function syncStashOwnership(hq) {
  if (!game.user.isGM) return;
  const stash = await resolveLink(state(hq.getFlag(ID, "hq")).stashUuid);
  if (!stash || stash.getFlag(ID, "headquarters") !== hq.uuid) return;
  const ownership = stashOwnership(hq);
  for (const userId of Object.keys(stash.ownership)) if (userId !== "default" && !(userId in ownership)) ownership[userId] = 0;
  await stash.update({ownership});
}
export function moneyUpdates(actor, delta, reason) {
  const wallet = actor.system.wealth;
  if (!Number.isSafeInteger(delta) || !Number.isSafeInteger(wallet?.value) || !Array.isArray(wallet.transactions)) throw new Error("Invalid Eurobucks ledger.");
  const value = wallet.value + delta;
  if (!Number.isSafeInteger(value) || value < 0) throw new Error("Not enough Eurobucks for this transfer.");
  return {"system.wealth.value": value, "system.wealth.transactions": [...wallet.transactions.map(r => [...r]), [`${delta >= 0 ? "+" : ""}${delta}eb; balance ${value}eb`, reason]]};
}
const transfers = new Set();
async function rentSource(hq) {
  if (!hq.testUserPermission(game.user, 'OBSERVER')) throw new Error('You cannot access this HQ.');
  const s = state(hq.getFlag(ID, 'hq')), stash = await resolveLink(s.stashUuid);
  if (!stash || stash.documentName !== 'Actor' || stash.type !== 'container' || !stash.isOwner || stash.getFlag(ID, 'headquarters') !== hq.uuid || stash.getFlag('cyberpunk-red-core', 'container-type') !== 'stash') throw new Error('Create and sync this HQ’s shared stash first. You need Owner permission on it to pay rent.');
  const current = state(hq.getFlag(ID, 'hq'));
  if (current.stashUuid !== s.stashUuid || !hq.testUserPermission(game.user, 'OBSERVER')) throw new Error('HQ stash access changed. Review the payment again.');
  if (![current.rent, current.reducedRent].every(x => Number.isSafeInteger(x) && x >= 0)) throw new Error('Enter valid non-negative whole rent amounts.');
  const amount = benefits(current).monthlyRent;
  if (amount <= 0) throw new Error('No rent is due.');
  return {stash, amount};
}
export async function payRent(hq) {
  const quote = await rentSource(hq);
  if (transfers.has(quote.stash.uuid)) throw new Error('A stash payment or transfer is already in progress. Please wait.');
  transfers.add(quote.stash.uuid);
  try {
    moneyUpdates(quote.stash, -quote.amount, 'Rent payment');
    if (!await Dialog.confirm({title: 'Pay monthly rent', content: `<p>Pay ${quote.amount}eb for one month of ${escapeHTML(hq.name)} rent from ${escapeHTML(quote.stash.name)}?</p><p>Each payment covers one month. No automatic calendar limit is enforced.</p>`})) return;
    const current = await rentSource(hq);
    if (current.stash.uuid !== quote.stash.uuid || current.amount !== quote.amount) throw new Error('Rent or the linked stash changed. Review the payment again.');
    await current.stash.update(moneyUpdates(current.stash, -current.amount, `${hq.name}: monthly rent — ${game.user.name}`));
    ui.notifications.info(`Paid ${current.amount}eb rent from ${current.stash.name}.`);
    return current.amount;
  } finally { transfers.delete(quote.stash.uuid); }
}
export async function transferMoney(hq, actorId, direction, amount) {
  if (!hq.testUserPermission(game.user, "OBSERVER")) throw new Error("You cannot access this HQ.");
  if (!Number.isSafeInteger(amount) || amount <= 0 || !["deposit", "withdraw"].includes(direction)) throw new Error("Enter a positive whole amount of Eurobucks.");
  const actor = requireCharacter(actorId), stash = await resolveLink(state(hq.getFlag(ID, "hq")).stashUuid);
  if (!stash || stash.type !== "container" || !stash.isOwner) throw new Error("You need Owner permission on the shared stash.");
  if (transfers.has(stash.uuid)) throw new Error("A stash transfer is already in progress. Please wait.");
  transfers.add(stash.uuid);
  try {
    const source = direction === "deposit" ? actor : stash, target = direction === "deposit" ? stash : actor;
    const reason = `${hq.name}: ${direction} ${amount}eb — ${actor.name} / ${game.user.name}`;
    const debit = moneyUpdates(source, -amount, reason);
    moneyUpdates(target, amount, reason);
    await source.update(debit);
    try { await target.update(moneyUpdates(target, amount, reason)); }
    catch {
      try { await source.update(moneyUpdates(source, amount, `Reversed failed transfer: ${reason}`)); }
      catch { throw new Error(`Transfer failed and refund failed. Ask the GM to reconcile ${amount}eb on ${source.name} before retrying.`); }
      throw new Error("Transfer failed; the deducted money was refunded.");
    }
    ui.notifications.info(`${direction === "deposit" ? "Deposited" : "Withdrew"} ${amount}eb for ${actor.name}.`);
  } finally { transfers.delete(stash.uuid); }
}
export async function moneyDialog(hq, direction) {
  if (direction === 'rent') return payRent(hq);
  const actors = ownedCharacters();
  if (!actors.length) throw new Error("You need an owned character to transfer money.");
  const result = await new Promise(resolve => new Dialog({title: direction === "deposit" ? "Deposit Eurobucks" : "Withdraw Eurobucks",
    content: `<div class="nplh-benefit-dialog"><label>Character<select name="actor">${actors.map(a => `<option value="${escapeHTML(a.id)}">${escapeHTML(a.name)}</option>`).join("")}</select></label><label>Eurobucks<input name="amount" type="number" min="1" step="1" value="100"></label></div>`,
    buttons: {apply: {label: "Transfer", callback: html => resolve({id: html.find('[name="actor"]').val(), amount: Number(html.find('[name="amount"]').val())})}, cancel: {label: "Cancel", callback: () => resolve(null)}},
    default: "apply", close: () => resolve(null)}).render(true));
  if (result) await transferMoney(hq, result.id, direction, result.amount);
}
