export const ID = "no-place-like-home";
export const COST = 40;
// Rank 0 = absent, 1 = improvement, 2+ = improvement plus upgrades.
export const CATALOG = [
  ["evidence", "Evidence Wall", 3, "Lawmen and Medias: +2 to investigation-related Composition, Criminology, Cryptography, Deduction, Education, Forgery, Library Search and Photograph/Film.", "Lawmen: bonus becomes +3. Medias retain +2 and gain +1 effective Credibility Rank for Believability on a story developed here."],
  ["garage", "Garage", 3, "Crew Compact Groundcar; cannot be sold or benefit from Moto. Vehicle upgrades can be purchased separately. If destroyed beyond repair, lose this improvement and its upgrade without refund.", "A Nomad with all vehicles fully repaired and operational can spend one week reassigning Moto vehicle and upgrade choices."],
  ["lockup", "Lockup", 3, "One soundproof cell. A prisoner needs BODY 13+ to break out; outside rescue remains possible.", "Three separate cells. Lawmen gain +2 Interrogation against a prisoner held for at least one day."],
  ["lounge", "Lounge", 4, "Fixers gain +2 Bribery, Bureaucracy, Business, Conversation, Human Perception, Persuasion and Trading during meetings held here.", "Fixers and Medias gain +2 to checks arranging an in-person meeting within their Contacts/Clients or Access/Sources, as the GM decides."],
  ["medbay", "Medbay", 4, "Crew natural healing uses BODY +2. Medtechs gain +2 First Aid, Paramedic and Surgery here.", "Medtechs can use Science (Chemistry) for Maker-style street-drug upgrading, fabrication and invention; expertise equals Medical Tech skill level."],
  ["morale", "Morale Boost", 4, "Recreation or decoration reduces each crew member's monthly Lifestyle cost by 50eb.", "Up to ten upgrades; cumulative benefits with replacements shown below."],
  ["rent", "Rent Reduction", 4, "Reduce rent by one Real Estate category, skipping corporate-provided rows. Cube Hotel becomes 100eb/month. Requires monthly rent. Enter the GM-calculated reduced rent below.", "Each upgrade adds one bed without raising rent, up to twice the original bed count. Extra rooms need GM agreement."],
  ["server", "Server Room", 4, "Build an HQ NET Architecture/security system with a 20,000eb allocation using Home Security 2045. Purchased assets cannot be removed or resold; leftover funds are forfeited.", "Netrunners use Electronics/Security Tech for Maker-style cyberdeck, hardware and program projects; expertise equals Interface Rank."],
  ["studio", "Studio", 5, "Rockerboys gain +2 Acting, Composition, Play Instrument, Paint/Draw/Sculpt and Photograph/Film while here.", "A Rockerboy can refine an art project for one week per cumulative +2 on required art checks. Failure allows another week; completion, abandonment or a natural 1 ends the refinement bonus. Fumble Recovery cannot prevent its loss."],
  ["training", "Training Area", 6, "One week practices one skill for +1: Athletics, Archery, Autofire, Brawling, Evasion, Handgun, Heavy Weapons, Martial Arts, Melee Weapon or Shoulder Arms. Expires on the next Group IP award or new practice.", "Solos may practice two different eligible skills at once."],
  ["workshop", "Workshop", 6, "A Tech using Upgrade, Fabrication or Invention Expertise here can credit the same time toward a second project.", "The same time can also be credited toward a third project."],
  ["workstation", "Workstation", 6, "Choose one Exec Team Member. They become a crew member, gain IP when their Exec does, receive a share of gig pay, and follow their Exec to a new employer. GM spends their IP/cash. Losing access stops new awards, not past gains.", "The selected Team Member stays loyal unless betrayed. If this upgraded workstation is lost, restore it before other HQ purchases or the Team Member leaves." ]
].map(([id, name, page, base, upgrade]) => ({id, name, page, base, upgrade}));

export function defaults() {
  return {schema: 1, purchaseCost: COST, image: "", crewSlots: [], garageUuid: "", stashUuid: "", ip: 0, spent: 0, location: "", description: "", notes: "", crew: "", rent: 0, reducedRent: 0, beds: 1, access: true, faction: false, workstationDebt: false, improvements: Object.fromEntries(CATALOG.map(x => [x.id, 0])), log: []};
}
export function state(raw = {}) {
  const d = defaults();
  const customImprovements = (raw.customImprovements ?? []).map(c => ({...c, upgrades: [...c.upgrades]}));
  return {...d, ...raw, customImprovements, improvements: {...d.improvements, ...Object.fromEntries(customImprovements.map(c => [c.id, 0])), ...raw.improvements}, log: [...(raw.log ?? [])]};
}
export function catalog(s) { return [...CATALOG, ...(s.customImprovements ?? []).map(c => ({...c, custom: true}))]; }
export function saveCustom(raw, entry) {
  const s = state(raw);
  if (!/^custom_[A-Za-z0-9]+$/.test(entry.id)) throw new Error("Invalid custom improvement ID.");
  const name = String(entry.name ?? '').trim(), base = String(entry.base ?? '').trim();
  const upgrades = Array.isArray(entry.upgrades) ? entry.upgrades.map(x => String(x).trim()).filter(Boolean) : [];
  if (!name || name.length > 100 || !base || base.length > 4000) throw new Error("Enter a name (up to 100 characters) and benefit (up to 4000 characters).");
  if (upgrades.length > 50 || upgrades.some(x => x.length > 4000)) throw new Error("Use at most 50 upgrades, each up to 4000 characters.");
  if (upgrades.length < (s.improvements[entry.id] ?? 0) - 1) throw new Error("Cannot remove already purchased upgrade tiers. Record the improvement as lost first.");
  const index = s.customImprovements.findIndex(c => c.id === entry.id);
  const value = {id: entry.id, name, base, upgrades};
  if (index < 0) s.customImprovements.push(value); else s.customImprovements[index] = value;
  s.improvements[entry.id] ??= 0;
  return s;
}
export function limit(s, id) { const custom = (s.customImprovements ?? []).find(c => c.id === id); return custom ? 1 + custom.upgrades.length : id === "morale" ? 11 : id === "rent" ? 1 + s.beds : 2; }
export function purchaseError(s, id) {
  const cost = s.purchaseCost === undefined ? COST : s.purchaseCost;
  if (!Number.isSafeInteger(cost) || cost < 0) return "Purchase cost must be a non-negative whole number of HQ IP.";
  if (!catalog(s).some(x => x.id === id)) return "Unknown improvement.";
  if (s.faction) return "Crew HQ IP cannot be spent on a faction HQ.";
  if (!s.access) return "Restore access before making purchases.";
  if (s.workstationDebt && id !== "workstation") return "Restore the upgraded Workstation first, or resolve the Team Member's departure.";
  if (s.improvements[id] >= limit(s, id)) return "Maximum upgrades reached.";
  if (id === "rent" && s.rent <= 0) return "Rent Reduction requires a monthly rent cost.";
  if (s.ip < cost) return `Not enough HQ IP (${cost} required).`;
  return "";
}
export function purchase(raw, id) {
  const s = state(raw), error = purchaseError(s, id);
  if (error) throw new Error(error);
  s.ip -= s.purchaseCost; s.spent += s.purchaseCost; s.improvements[id]++;
  if (id === "workstation" && s.improvements[id] === 2) s.workstationDebt = false;
  return s;
}
export function lose(raw, id) {
  const s = state(raw);
  if (!catalog(s).some(x => x.id === id)) throw new Error("Unknown improvement.");
  if (id === "workstation" && s.improvements[id] >= 2) s.workstationDebt = true;
  s.improvements[id] = 0;
  return s;
}
export function benefits(raw) {
  const s = state(raw), m = Math.max(0, s.improvements.morale - 1), active = s.access;
  return {
    healing: active ? (s.improvements.medbay ? 2 : 0) + (m >= 2 ? 1 : 0) : 0,
    luck: active ? Number(m >= 3) + Number(m >= 7) : 0,
    lifestyle: active && s.improvements.morale ? 50 : 0,
    beds: s.beds + Math.max(0, s.improvements.rent - 1),
    monthlyRent: active && s.improvements.rent ? s.reducedRent : s.rent,
    humanity: !active || m < 1 ? "None" : m >= 9 ? "2d6, keep highest" : m >= 4 ? "1d6" : "1d6 / 2 (round down)",
    hustle: !active || m < 6 ? "Normal" : m >= 8 ? "Roll twice; earn both" : "Roll twice; choose one",
    negotiation: active && m >= 5,
    custom: active && m >= 10
  };
}
