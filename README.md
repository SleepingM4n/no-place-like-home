# No Place Like Home — Foundry Headquarters

Unofficial shared Headquarters sheet based on the **No Place Like Home** Cyberpunk RED DLC, August 2024. Targets **Foundry VTT 12 stable (user build 343)** with **Cyberpunk RED Core 0.92.4** (`cyberpunk-red-core`). This is an HQ record in Journals, not a replacement for an edgerunner Actor sheet.

## Install

In Foundry's **Add-on Modules → Install Module**, paste this manifest URL:

```text
https://github.com/SleepingM4n/no-place-like-home/releases/latest/download/module.json
```

For a manual installation:

1. Close Foundry. Extract `no-place-like-home.zip` into your Foundry user data `Data/modules/` folder.
2. Check that the result is `Data/modules/no-place-like-home/module.json` (no double nesting).
3. Start Foundry, open your Cyberpunk RED world, and enable **No Place Like Home - Headquarters** in **Manage Modules**.
4. Open **Journal Entries** and click **Create Headquarters** as GM.
5. Enter the HQ name, location, crew, description, original rent and original bed count. Award the crew's accumulated HQ IP, then purchase its improvements.
6. Right-click the journal entry, choose **Configure Ownership**, and give the appropriate players **Observer** access. New HQs are private until shared. Players can read and use benefit actions on characters they own; the GM makes crew-approved purchases.

## Updating to 0.5.1

Close Foundry and replace the existing `Data/modules/no-place-like-home/` module files with the folder in the new ZIP. Restart Foundry and reload each player's browser. Existing Headquarters data is retained; no migration or recreation is needed.

Version 0.3.1 displays character-sheet portraits in crew slots and places Active crew benefits before Improvements & upgrades.

## Tabbed sheet (0.5.1)

The HQ name and image banner stays visible above five tabs:

1. **HQ Info** — location, crew name/notes, description, rent, beds, access settings, HQ IP totals and Award HQ IP.
2. **Crew** — six portraits, drag-and-drop guidance, crew IP/money awards, garage and shared stash.
3. **Active Crew Benefits** — healing, Humanity, Hustle and other benefits, plus project/training notes.
4. **Improvements & Upgrades** — custom purchase cost and all improvement/upgrade cards.
5. **Recent Activity** — activity log and the GM's HQ destruction control.

Uses Foundry v12's native sheet tabs, starting on HQ Info. Existing HQ data, player permissions and action behavior are preserved. Tab labels also support Enter/Space keyboard activation.

## HQ image, crew and garage

### Award crew IP (0.4.0)

**Award crew money (0.4.1):** the adjacent GM-only button uses the same crew selection, Select all / Clear controls and reason field. Enter the Eurobucks amount **per selected character**. Each selected character receives the full award in their Eurobucks balance, with the reason in their ledger. Only characters linked in the crew slots are eligible; the garage vehicle is excluded. This awards new money rather than withdrawing from the stash. The IP button and other features retain their behavior.

As GM, click **Award crew IP** directly below the six crew slots. The popup lists only linked Character actors, with checkboxes, Select all / Clear controls, and a selected count. Enter a positive whole **IP per selected character** amount and a **reason**, then click **Award IP**. Each selected character receives the full amount, and the reason is saved in their Improvement Points ledger. The garage sheet, unlinked characters, deleted links and NPC mooks are excluded (mooks have no character IP ledger in this system).

The existing **Award HQ IP** button still manages the HQ pool separately. All other features, maker credit and Foundry v12 compatibility remain unchanged. If a character update fails, a notification lists successful and failed recipients so successful awards are not accidentally repeated. Use one GM award operation at a time across clients.

- **HQ image:** as GM, click **Choose image** at the top-right corner. Foundry's image picker lets you select an existing image or upload one if your host permits uploads. Removing an image clears the reference, not the image file.
- **Crew:** the GM drags Actors from the Actors directory into any of six slots. Each slot shows the Actor's character-sheet portrait. Character and mook Actors are supported, with one link per Actor. Clicking a portrait opens its sheet with the viewer's existing permissions. The × unlinks it without deleting the Actor. Existing crew text remains in the Crew name / notes field.
- **Garage:** drag a vehicle Item (from the Items directory or an actor's inventory), or an Actor representing a vehicle, onto the garage slot. Cyberpunk RED 0.92.4 uses vehicle Items rather than a separate vehicle Actor type. Clicking opens the linked sheet. This reference does not purchase the Garage improvement or transfer ownership of a vehicle.
- Links store world UUIDs; compendium documents must be imported first. Deleted links display a missing-sheet notice. Linking never grants access to a previously private character or vehicle.

## Shared item storage and Eurobucks

1. Give the crew **Observer** access to the HQ journal, then click **Create shared stash** as GM. This creates one native Cyberpunk RED **Container** Actor in Stash mode and links it to the HQ. Players with HQ Observer access receive Owner permission on that stash, as required by the system's inventory controls. Other players receive no access by default.
2. Click **Open item storage**. Players drag items from their character inventory into the native stash sheet. To retrieve items, select their character as the stash's trade partner and use the system's item transfer controls. Items are free in Stash mode. Quantity, attachments and installed-item restrictions use the native system workflow. This opens a separate native container sheet rather than copying inventory into journal flags.
3. Use **Deposit eb** or **Withdraw eb** on the HQ sheet to choose an owned character and transfer a positive whole amount. These buttons update both balances and both ledgers; they reject insufficient funds and attempt a refund if the recipient update fails. Use these controls for transfers rather than directly editing a balance in the container sheet.

HQ ownership changes synchronize stash access when an active GM is present. **Sync player access** repeats that synchronization manually. Storage remains a real Actor in the Actors directory, and is not deleted when the HQ is destroyed, unlinked or deleted. HQ access-loss flags do not lock the stash; the GM can restrict the stash's ownership separately. Members trusted with stash Owner permission can manage its entire inventory.

Use one money transfer at a time across players. The local client prevents overlapping stash transfers, but Foundry does not provide a transaction lock across different clients; simultaneous direct edits or transfers can conflict. No GM needs to be online for ordinary storage use after permissions are configured.

Version 0.3.0 adds unit coverage for slot limits, links, permission handling, stash creation, balanced deposits/withdrawals and refund failure. Browser simulation covers the new layout, player link opening and transfers, GM crew drops and image selection. Test native item transfers inside Foundry after updating; the actual Cyberpunk system container UI is not available in the browser simulation.

## Character benefit actions

The **Active crew benefits** section has three buttons. Players need Observer access to the HQ journal and Owner permission on a **Character** actor. Each action opens a character selector showing only owned characters; mooks and other actor types are excluded. Lost HQ access disables the actions.

- **Heal…**: choose a character and enter the number of completed healing days. Restores `(current BODY + active HQ healing bonus) × days`, capped at the character's maximum HP. Medbay and Morale healing bonuses stack. Stabilization, sufficient rest and critical injury treatment are still adjudicated normally.
- **Roll & restore…**: roll the current monthly Morale Humanity benefit and add it to the selected character. Uses the system's cyberware-adjusted maximum Humanity and updates EMP. Available from Morale upgrade 1; upgrades 4 and 9 replace the formula. This is an in-game monthly benefit: there is no automatic calendar or once-per-month lock, so use it once per eligible month.
- **Roll & earn…**: choose a character, then an owned Role item. Rank is read from the item. Standard core Roles are recognized by name, original translated name or compendium source; a table selector supports renamed/custom Roles. Rolls the core Hustle table for one seven-day period. Morale upgrades 6–7 let the player choose either of two results; upgrades 8–10 pay both. The money and a transaction are added together to the character's Eurobucks ledger. Cancelling the result choice pays nothing; the rolled dice remain in chat.

Dice and applied results are posted to chat. The buttons block double-clicks while an action runs, and character actions are serialized within a client. Avoid simultaneous edits to the same character from different clients. Downtime is not advanced automatically, and the module does not check whether healing days overlap a Hustle week.

You can also create a sheet with a Script macro:

```js
await game.modules.get("no-place-like-home").api.createHQ();
```

The optional sheet is registered only for Journal Entries. Ordinary journals retain their normal sheet. An existing empty journal can use it through its sheet configuration; existing journal pages are retained but are not displayed in the HQ sheet.

## Rules supported

**Custom purchase cost (0.5.0):** the GM can enter one price in **Cost for every improvement or upgrade (HQ IP)** under Improvements & upgrades. This price applies to every future improvement and upgrade on that HQ, including repeated upgrades. It defaults to 40 and accepts non-negative whole numbers (0 permits free purchases). Purchase buttons, confirmation dialogs, affordability checks, deductions and purchase logs use the chosen price. Previous spending and existing upgrades remain unchanged. Existing HQs automatically default to 40 without a migration.

- All twelve improvements default to 40 HQ IP, with a customizable shared purchase cost; ordinary improvements have one upgrade.
- Morale Boost permits ten upgrades. The benefits panel resolves Humanity and Hustle replacements, LUCK increases, and Medbay/healing stacking.
- Rent Reduction requires rent and caps extra beds at the original bed count. Enter the reduced monthly rent **manually**, using the core rulebook Real Estate categories and the GM's assessment of the space. The module does not infer a category from a rent amount.
- HQ IP is awarded once per crew, equal to the Group-column mission award. Character IP is untouched.
- Lost access suspends the benefits panel. The **Lost** button removes an improvement and its upgrades without refund. Use this for a Garage car destroyed beyond repair.
- Losing an upgraded Workstation blocks other purchases until both ranks are restored, or the GM records the Team Member's departure.
- HQ destruction removes all purchases and suspends access. Unspent IP stays with the crew; rename and update the record when establishing a replacement HQ.
- Faction HQ mode blocks crew IP spending. For a GM-authored faction record, populate improvements before enabling faction mode; availability remains the GM's decision.
- An activity log records awards, purchases and losses. Notes hold training expiry, project progress, NET Architecture details, selected Team Member and the custom tenth Morale benefit.

## Scope and validation

The module stores HQ data in JournalEntry flags and does not patch the Cyberpunk system. Character benefit actions write HP, Humanity/EMP and Eurobucks to the selected actor. It does not apply other effects, create vehicles/NET assets or automate housing payments. Training expiry and other role/skill/context conditions must be applied manually. Half-d6 Humanity recovery rounds down.

Only the GM edits the sheet. Use one GM editor at a time: Foundry flag updates are not database transactions across multiple clients. Back up your world before editing; losses have confirmation prompts but no built-in undo. Existing HQs can be set up by awarding their historical purchase cost plus current unspent IP and buying their existing improvements.

Automated tests cover HQ rules plus owned-character filtering, permission checks, capped healing, Humanity/EMP, all core Hustle payout rows/rank bands, Morale variants, cancellation, ledger preservation and failed writes. Character field paths and ledger format were checked against the system's v0.92.4 source. Browser checks use a simulated Foundry environment; a live Foundry world smoke test is still required for the new actions.

Run with Node.js:

```sh
node --test tests/*.test.mjs
node --check scripts/module.mjs
```

In Foundry, verify creating/reopening a record, metadata persistence, purchasing a Garage with 40 IP, player Observer access, access loss/restoration, and a browser reload. Check the browser console for errors. Test with a disposable HQ first.

For 0.2.0, test as a player with Observer HQ access: heal an owned damaged character for two days, restore Humanity near its cap, and Hustle with one of its Role items. Verify HP, Humanity, EMP and the Eurobucks ledger after reloading. An unowned character must not appear in the selector. Check that loss of HQ access disables the three buttons.

## Credits

Module maker: **Sleepingman**. The module manifest declares Foundry VTT 12 as its minimum, verified and maximum version.

Rules: **No Place Like Home**, writing/design by James Hutt and J Gray, © 2024 R. Talsorian Games. Cyberpunk is a registered trademark of CD Projekt Red S.A. This is an unofficial fan tool with original code and paraphrased reminders, not an endorsed product. The DLC PDF, artwork and fiction are not bundled. Consult your own DLC and Cyberpunk RED core rulebook for complete rules.

Foundry API references: https://foundryvtt.com/api/v12/classes/client.DocumentSheet.html and https://foundryvtt.com/api/v12/classes/client.DocumentSheetConfig.html.

System integration reference: https://gitlab.com/cyberpunk-red-team/fvtt-cyberpunk-red-core/-/tree/v0.92.4/src/modules/actor. Hustle payout mechanics were checked against the user's Cyberpunk RED core rulebook, pp. 382–385; the original table prose and PDF are not distributed.
