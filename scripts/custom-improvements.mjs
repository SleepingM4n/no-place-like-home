export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

export function customDialog(entry = {}) {
  return new Promise(resolve => new Dialog({
    title: entry.id ? 'Edit custom improvement' : 'Add custom improvement',
    content: `<form><p>Define a custom improvement for this HQ. Acquire it and its upgrades using the normal purchase buttons.</p>
      <label>Name<input name="customName" maxlength="100" value="${escapeHTML(entry.name)}"></label>
      <label>Base benefit<textarea name="customBase" rows="3" maxlength="4000">${escapeHTML(entry.base)}</textarea></label>
      <label>Upgrade benefits — one upgrade per line, in purchase order<textarea name="customUpgrades" rows="7">${escapeHTML((entry.upgrades ?? []).join('\n'))}</textarea></label>
      <p>Leave upgrades blank for a base-only improvement. Effects are applied manually. Editing an acquired benefit changes its description immediately.</p></form>`,
    buttons: {
      save: {label: 'Save custom improvement', callback: html => resolve({name: html.find('[name="customName"]').val(), base: html.find('[name="customBase"]').val(), upgrades: html.find('[name="customUpgrades"]').val().split(/\r?\n/).map(x => x.trim()).filter(Boolean)})},
      cancel: {label: 'Cancel', callback: () => resolve(null)}
    }, default: 'save', close: () => resolve(null)
  }, {width: 520}).render(true));
}
