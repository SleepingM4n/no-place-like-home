import {ID, state} from "./rules.mjs";
import {crewSlots, resolveLink} from "./hq-assets.mjs";
import {escapeHTML} from "./character-benefits.mjs";

export async function ipRecipients(hq) {
  const s = state(hq.getFlag(ID, "hq"));
  const uuids = [...new Set(crewSlots(s.crewSlots).filter(uuid => uuid && uuid !== s.garageUuid))];
  const actors = await Promise.all(uuids.map(resolveLink));
  // Mooks do not have an Improvement Points ledger in Cyberpunk RED 0.92.4.
  return actors.filter(actor => actor?.documentName === "Actor" && actor.type === "character" && !actor.pack);
}

export function ipUpdate(actor, amount, reason, money = false) {
  const unit = money ? "eb" : "IP", key = money ? "wealth" : "improvementPoints";
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error(`Enter a positive whole number of ${unit} per character.`);
  if (typeof reason !== "string" || !reason.trim()) throw new Error(`Enter a reason for the ${money ? "money" : "IP"} award.`);
  const ledger = actor.system[key];
  if (!Number.isSafeInteger(ledger?.value) || !Array.isArray(ledger.transactions) || !Number.isSafeInteger(ledger.value + amount)) {
    throw new Error(`${actor.name} does not have a valid ${money ? "Eurobucks" : "Improvement Points"} ledger.`);
  }
  return {[`system.${key}.value`]: ledger.value + amount,
    [`system.${key}.transactions`]: [...ledger.transactions.map(row => [...row]), [`+${amount} ${unit}; balance ${ledger.value + amount} ${unit}`, reason.trim()]]};
}

export async function awardCrewIP(hq, selected, amount, reason, money = false) {
  const unit = money ? "eb" : "IP";
  if (!game.user.isGM) throw new Error(`Only the GM can award crew ${money ? "money" : "IP"}.`);
  if (!Array.isArray(selected) || !selected.length) throw new Error("Select at least one crew character.");
  const eligible = new Map((await ipRecipients(hq)).map(actor => [actor.uuid, actor]));
  const actors = [...new Set(selected)].map(uuid => {
    const actor = eligible.get(uuid);
    if (!actor) throw new Error("The selected crew has changed. Reopen the popup and select current crew characters.");
    return actor;
  });
  // Preflight every recipient before writing anything. Save one awaited ledger
  // update per actor so a write failure cannot be mistaken for a successful award.
  const changes = actors.map(actor => ({actor, update: ipUpdate(actor, amount, reason, money)}));
  const awarded = [], failed = [];
  for (const {actor, update} of changes) {
    try { await actor.update(update); awarded.push(actor.name); }
    catch { failed.push(actor.name); }
  }
  if (failed.length) {
    ui.notifications.warn(`${money ? "Money" : "IP"} award completed for: ${awarded.join(", ") || "nobody"}. Failed: ${failed.join(", ")}. Check those characters before retrying; do not re-award successful recipients.`, {permanent: true});
  } else ui.notifications.info(`Awarded ${amount} ${unit} each to ${awarded.length} crew member(s): ${awarded.join(", ")}.`);
  return {awarded, failed};
}

const openAwards = new Set();
export async function crewIPDialog(hq, money = false) {
  const label = money ? "money" : "IP", unit = money ? "Eurobucks" : "IP";
  if (!game.user.isGM) throw new Error(`Only the GM can award crew ${label}.`);
  const key = hq.uuid ?? hq.id;
  if (openAwards.has(key)) return;
  openAwards.add(key);
  try {
    const actors = await ipRecipients(hq);
    if (!actors.length) throw new Error(`Link at least one Character actor in the six crew slots first. Vehicles and NPC mooks cannot receive ${label} here.`);
    const rows = actors.map(actor => `<label class="crew-ip-choice"><input type="checkbox" name="recipient" value="${escapeHTML(actor.uuid)}" checked><span>${escapeHTML(actor.name)}</span></label>`).join("");
    const result = await new Promise(resolve => new Dialog({title: `Award crew ${label}`,
      content: `<div class="nplh-benefit-dialog crew-ip-dialog"><p>Select the crew members who receive this award.</p><div class="crew-ip-selection"><button type="button" data-select-crew="all">Select all</button><button type="button" data-select-crew="none">Clear</button><span data-recipient-count></span></div><div class="crew-ip-list">${rows}</div><label>${unit} per selected character<input name="amount" type="number" min="1" step="1" value="${money ? 100 : 40}" required></label><label>Reason<textarea name="reason" rows="3" placeholder="${money ? "Mission payment, bonus…" : "Mission completed, roleplay award…"}" required></textarea></label><p>The full amount goes to each selected character. ${money ? "This awards new money; no funds are taken from the shared stash." : "The HQ IP balance is managed separately."}</p></div>`,
      buttons: {apply: {label: `Award ${label}`, callback: html => resolve({
        selected: html.find('[name="recipient"]:checked').map((i, input) => input.value).get(),
        amount: Number(html.find('[name="amount"]').val()), reason: html.find('[name="reason"]').val()})},
        cancel: {label: "Cancel", callback: () => resolve(null)}},
      default: "apply", close: () => resolve(null),
      render: html => {
        const refresh = () => {
          const count = html.find('[name="recipient"]:checked').length;
          html.find('[data-recipient-count]').text(`${count} / ${actors.length} selected`);
        };
        html.find('[name="recipient"]').on('change', refresh);
        html.find('[data-select-crew]').on('click', event => {
          html.find('[name="recipient"]').prop('checked', event.currentTarget.dataset.selectCrew === 'all'); refresh();
        });
        refresh();
      }
    }, {width: 480}).render(true));
    if (result) await awardCrewIP(hq, result.selected, result.amount, result.reason, money);
  } finally { openAwards.delete(key); }
}
