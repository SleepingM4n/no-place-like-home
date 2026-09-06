import {ID, state, benefits} from "./rules.mjs";

// Mechanical payouts only, checked against CP:R pp. 382–385. Rows are d6 results;
// each payout band contains amounts for Role ranks 1–4, 5–7 and 8–10.
const PAY = [[0, 100, 300], [100, 200, 500], [200, 300, 600], [300, 500, 800]];
export const HUSTLES = {
  rockerboy: {name: "Rockerboy", source: "ybQOwW3ICzHY7LiQ", bands: [2, 0, 3, 3, 3, 2], events: ["Local show", "No bookings", "Private headline gig", "Royalties", "Support act", "Appearance fee"]},
  solo: {name: "Solo", source: "I4qtphsiVa4rj9U8", bands: [1, 2, 2, 1, 0, 1], events: ["Budget protection contract", "Premium protection contract", "High-risk contract", "Muscle for hire", "Laying low", "Enforcement contract"]},
  netrunner: {name: "Netrunner", source: "g5S5E8UG1QJ4yFsp", bands: [1, 2, 0, 2, 2, 2], events: ["Small data sale", "Corporate data sale", "Unproductive week", "Recovered data", "Ransomware payoff", "Network sabotage"]},
  tech: {name: "Tech", source: "f815HiiDpThbd7eY", bands: [0, 1, 2, 1, 1, 1], events: ["No commissions", "Salvage restoration", "Security contract", "Cybertech servicing", "Weapon servicing", "Sabotage commission"]},
  medtech: {name: "Medtech", source: "8wRoRsRQnpt3Je00", bands: [1, 2, 1, 0, 2, 1], events: ["Emergency treatment", "Recovered implant sale", "Trauma Team assistance", "Unpaid community care", "Wealthy patient's procedure", "Pharmaceutical order"]},
  media: {name: "Media", source: "Ek251OMdphcqzWPP", bands: [3, 2, 2, 2, 0, 3], events: ["Investigative sale", "Popular feature", "Advertising copy", "Controversial report", "No usable leads", "Major revelation"]},
  lawman: {name: "Lawman", source: "kDE2jnvcsbbz1vaL", bands: [1, 2, 0, 1, 2, 2], events: ["Routine arrests", "Citizen's reward", "Salary deduction", "Routine paycheck", "Smuggling bust bonus", "Gang seizure bonus"]},
  exec: {name: "Exec", source: "MauQVKqh2mLLWXA8", bands: [3, 0, 2, 3, 3, 2], events: ["Project bonus", "Bonus withheld", "Routine paycheck", "Office leverage", "Major project reward", "Reallocated rival funding"]},
  fixer: {name: "Fixer", source: "fR6KBqJgywWfhI2n", bands: [2, 2, 2, 0, 2, 3], events: ["Information brokerage", "Booking commission", "Sourcing commission", "Failed deal", "Job placement fee", "Rare goods brokerage"]},
  nomad: {name: "Nomad", source: "E2NkaEAx8Rv4nqWQ", bands: [1, 1, 1, 2, 1, 0], events: ["Cargo run", "Convoy security", "Small smuggling run", "Major smuggling run", "Passenger delivery", "No transport work"]}
};
export function hustleResult(table, rank, die) {
  if (!Object.hasOwn(HUSTLES, table) || !Number.isInteger(rank) || rank < 1 || rank > 10 || !Number.isInteger(die) || die < 1 || die > 6) throw new Error("Hustle needs a supported Role, rank 1–10 and a d6 result.");
  const entry = HUSTLES[table];
  return {die, amount: PAY[entry.bands[die - 1]][rank >= 8 ? 2 : rank >= 5 ? 1 : 0], event: entry.events[die - 1]};
}
export function moraleMode(raw) {
  const s = state(raw), upgrades = s.access ? Math.max(0, s.improvements.morale - 1) : 0;
  return {humanityFormula: upgrades >= 9 ? "2d6kh1" : upgrades >= 4 ? "1d6" : upgrades >= 1 ? "floor(1d6 / 2)" : null,
    hustle: upgrades >= 8 ? "both" : upgrades >= 6 ? "choose" : "single"};
}
export function recover(current, max, amount) {
  if (![current, max, amount].every(Number.isFinite) || max < 0 || amount < 0) throw new Error("Character resource values are invalid.");
  // Never lower an already over-cap value when applying recovery.
  const gained = Math.max(0, Math.min(amount, max - current));
  return {value: current + gained, gained};
}
export function healingAmount(body, bonus, days) {
  if (!Number.isSafeInteger(days) || days < 1) throw new Error("Healing days must be a positive whole number.");
  const amount = (body + bonus) * days;
  if (![body, bonus, amount].every(Number.isFinite) || body < 0 || bonus < 0 || !Number.isSafeInteger(amount)) throw new Error("Cannot calculate healing from this character's BODY.");
  return amount;
}
export const escapeHTML = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));
export function ownedCharacters() {
  return (game.actors?.contents ?? []).filter(a => a.type === "character" && a.isOwner).sort((a, b) => a.name.localeCompare(b.name));
}
export function requireCharacter(actorId) {
  const actor = game.actors?.get(actorId);
  if (!actor || actor.type !== "character" || !actor.isOwner) throw new Error("Choose a character you currently own.");
  return actor;
}
export function requireAccess(doc) {
  if (!doc.testUserPermission(game.user, "OBSERVER")) throw new Error("You no longer have access to this HQ record.");
  const s = state(doc.getFlag(ID, "hq"));
  if (!s.access) throw new Error("HQ access is lost. Its benefit actions are unavailable.");
  return s;
}
export function roleTable(item) {
  if (!item) return "";
  const source = item._stats?.compendiumSource ?? item.flags?.core?.sourceId ?? "";
  const name = String(item.flags?.babele?.originalName ?? item.name).trim().toLowerCase();
  return Object.entries(HUSTLES).find(([key, value]) => key === name || source.split(".").at(-1) === value.source)?.[0] ?? "";
}

function prompt({title, content, read, render, label = "Apply"}) {
  return new Promise(resolve => new Dialog({title, content: `<div class="nplh-benefit-dialog">${content}</div>`,
    buttons: {apply: {label, callback: html => resolve(read(html))}, cancel: {label: "Cancel", callback: () => resolve(null)}},
    default: "apply", close: () => resolve(null), render
  }, {width: 480}).render(true));
}

async function selectCharacter(action) {
  const actors = ownedCharacters();
  if (!actors.length) throw new Error("You do not own any Cyberpunk RED characters.");
  const title = {heal: "Natural healing", humanity: "Monthly Humanity recovery", hustle: "Weekly Hustle"}[action];
  const options = actors.map(a => `<option value="${escapeHTML(a.id)}">${escapeHTML(a.name)}</option>`).join("");
  const extra = action === "heal"
    ? '<label>Days of healing<input name="days" type="number" min="1" step="1" value="1"></label><p>Use completed days of natural recovery after stabilization. Critical injuries still need their normal treatment.</p>'
    : action === "humanity" ? '<p>Use once per in-game month, up to your cyberware-adjusted maximum Humanity. This button does not advance or track a campaign calendar.</p>'
      : '<p>One Hustle represents seven free days. Next, choose which owned Role to use.</p>';
  return prompt({title, content: `<label>Character<select name="actor">${options}</select></label>${extra}`,
    label: action === "heal" ? "Heal character" : action === "humanity" ? "Roll & restore Humanity" : "Choose Role",
    read: html => ({actorId: html.find('[name="actor"]').val(), days: Number(html.find('[name="days"]').val())})});
}
async function selectRole(actor) {
  const roles = actor.items.filter(i => i.type === "role" && Number.isInteger(i.system.rank) && i.system.rank >= 1 && i.system.rank <= 10);
  if (!roles.length) throw new Error("This character needs a Role item with a rank from 1 to 10 to Hustle.");
  const options = roles.map(r => `<option value="${escapeHTML(r.id)}">${escapeHTML(r.name)} · Rank ${r.system.rank}</option>`).join("");
  const tables = Object.entries(HUSTLES).map(([key, t]) => `<option value="${key}">${t.name}</option>`).join("");
  return prompt({title: `${actor.name} — Hustle Role`, label: "Roll Hustle",
    content: `<label>Character's Role<select name="role">${options}</select></label><label>Hustle table<select name="table"><option value="">Choose a table…</option>${tables}</select></label><p>The rank comes from your Role item. Check the table for renamed or custom Roles.</p>`,
    render: html => {
      const sync = () => html.find('[name="table"]').val(roleTable(roles.find(r => r.id === html.find('[name="role"]').val())));
      html.find('[name="role"]').on("change", sync); sync();
    }, read: html => ({roleId: html.find('[name="role"]').val(), table: html.find('[name="table"]').val()})});
}

// Serialize actions for each actor within this client, even with multiple HQ sheets open.
const busyActors = new Set();
async function locked(actorId, fn) {
  if (busyActors.has(actorId)) throw new Error("A benefit action is already running for this character.");
  busyActors.add(actorId);
  try { return await fn(); } finally { busyActors.delete(actorId); }
}
async function report(actor, text) {
  ui.notifications.info(`${actor.name}: ${text}`);
  try { await ChatMessage.create({speaker: ChatMessage.getSpeaker({actor}), content: `<p><b>No Place Like Home</b> — ${escapeHTML(text)}</p>`}); }
  catch { ui.notifications.warn("Character updated, but the chat receipt could not be posted. Do not repeat the action."); }
}

export async function applyHealing(doc, actorId, days) {
  const s = requireAccess(doc), actor = requireCharacter(actorId);
  const body = actor.system.stats.body.value, bonus = benefits(s).healing;
  const hp = actor.system.derivedStats.hp;
  const before = hp.value, result = recover(before, hp.max, healingAmount(body, bonus, days));
  await actor.update({"system.derivedStats.hp.value": result.value});
  await report(actor, `Healed ${result.gained} HP over ${days} day(s): (BODY ${body} + HQ ${bonus}) × ${days}. HP ${before} → ${result.value} (maximum ${hp.max}).`);
  return result;
}
export async function applyHumanity(doc, actorId) {
  const s = requireAccess(doc), actor = requireCharacter(actorId), {humanityFormula} = moraleMode(s);
  if (!humanityFormula) throw new Error("Monthly Humanity requires at least one Morale Boost upgrade.");
  const roll = await new Roll(humanityFormula).evaluate();
  await roll.toMessage({speaker: ChatMessage.getSpeaker({actor}), flavor: "HQ monthly Humanity recovery — rolled amount (before maximum cap)"});
  // Check permissions and current resources again after the asynchronous roll.
  if (moraleMode(requireAccess(doc)).humanityFormula !== humanityFormula) throw new Error("HQ benefits changed during the roll; no Humanity was applied.");
  requireCharacter(actorId);
  const humanity = actor.system.derivedStats.humanity;
  // 0.92.4's calculator includes installed cyberware and max-Humanity effects.
  const max = typeof actor._calcMaxHumanity === "function" ? actor._calcMaxHumanity() : humanity.max;
  const before = humanity.value, result = recover(before, max, Number(roll.total));
  await actor.update({"system.derivedStats.humanity.value": result.value, "system.derivedStats.humanity.max": max,
    "system.stats.emp.value": Math.floor(result.value / 10)});
  await report(actor, `Monthly Humanity: restored ${result.gained}; ${before} → ${result.value} (maximum ${max}). EMP ${Math.floor(result.value / 10)}.`);
  return result;
}
export async function applyHustle(doc, actorId, {roleId, table}, choose) {
  const s = requireAccess(doc), actor = requireCharacter(actorId), mode = moraleMode(s).hustle;
  const role = actor.items.get(roleId), rank = role?.system.rank;
  if (role?.type !== "role") throw new Error("Choose one of this character's Role items.");
  hustleResult(table, rank, 1); // Validate before rolling or updating the actor.
  const outcomes = [];
  for (let i = 0; i < (mode === "single" ? 1 : 2); i++) {
    const roll = await new Roll("1d6").evaluate();
    outcomes.push(hustleResult(table, rank, Number(roll.total)));
    await roll.toMessage({speaker: ChatMessage.getSpeaker({actor}), flavor: `HQ Hustle — ${HUSTLES[table].name}, Rank ${rank}, roll ${i + 1} (not yet credited)`});
  }
  let selected = 0;
  if (mode === "choose") {
    selected = await choose(outcomes);
    if (selected === null) return null;
    if (![0, 1].includes(selected)) throw new Error("Choose one of the two Hustle results.");
  }
  requireCharacter(actorId);
  if (moraleMode(requireAccess(doc)).hustle !== mode) throw new Error("HQ benefits changed during the Hustle; no money was applied.");
  const chosen = mode === "both" ? outcomes : [outcomes[selected]], amount = chosen.reduce((sum, o) => sum + o.amount, 0);
  const wealth = actor.system.wealth;
  if (!Number.isSafeInteger(wealth?.value) || !Array.isArray(wealth.transactions) || !Number.isSafeInteger(wealth.value + amount)) throw new Error("Cannot read this character's Eurobucks ledger.");
  const reason = `HQ Hustle: ${HUSTLES[table].name} rank ${rank}, d6 ${outcomes.map(o => o.die).join(" / ")}; ${mode === "both" ? "both paid" : `result ${selected + 1} paid`}. ${doc.name} — ${game.user.name}`;
  // The system's deltaLedgerProperty does not await its update in 0.92.4.
  // Write both fields in one awaited update using the system's ledger schema.
  await actor.update({"system.wealth.value": wealth.value + amount,
    "system.wealth.transactions": [...wealth.transactions.map(row => [...row]), [`Increased wealth by ${amount} to ${wealth.value + amount}.`, reason]]});
  await report(actor, `Hustle credited ${amount}eb for seven days. ${chosen.map(o => `${o.event}: ${o.amount}eb`).join("; ")}.`);
  return {amount, outcomes};
}

export async function runBenefit(doc, action) {
  if (!["heal", "humanity", "hustle"].includes(action)) throw new Error("Unknown benefit action.");
  requireAccess(doc);
  const selection = await selectCharacter(action);
  if (!selection) return;
  return locked(selection.actorId, async () => {
    if (action === "heal") return applyHealing(doc, selection.actorId, selection.days);
    if (action === "humanity") return applyHumanity(doc, selection.actorId);
    const role = await selectRole(requireCharacter(selection.actorId));
    if (!role) return;
    return applyHustle(doc, selection.actorId, role, outcomes => prompt({title: "Choose your Hustle result", label: "Credit selected income",
      content: `<p>Morale Boost lets you keep either result:</p><select name="outcome">${outcomes.map((o, i) => `<option value="${i}" ${o.amount > outcomes[1-i].amount ? "selected" : ""}>Roll ${i+1}: ${o.die} — ${escapeHTML(o.event)} — ${o.amount}eb</option>`).join("")}</select>`,
      read: html => Number(html.find('[name="outcome"]').val())}));
  });
}
