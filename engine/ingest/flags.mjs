// System flags: what the engine notices in a file on its own, with no model involved (engine-api.md 2.9). Each one
// is a Relationship with method "system", which the Timeline tags as such. The ends are candidates on the passage
// that states the fact, built with the same ids extraction uses, so resolution merges them with what the model
// later pulls from the same file. Deterministic: the same file writes the same flag once.
import { createHash } from 'node:crypto';
import { toServerObject } from '../faux.mjs';
import { objectId } from '../extract/index.mjs';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2026-09-14T09:24:00+08:00" in the file's own clock: { date: "14 Sep 2026", time: "09:24" }. */
function clockOf(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(String(s ?? ''));
  if (!m) return null;
  return { date: `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}`, time: `${m[4]}:${m[5]}` };
}

const iso = (s) => {
  const t = Date.parse(s ?? '');
  return Number.isNaN(t) ? undefined : new Date(t).toISOString();
};

/** The passage whose character range holds the start of row `i` of the parsed text (one line per row). */
function passageOfRow(parsed, passages, i) {
  const lines = parsed.text.split('\n');
  let offset = 0;
  for (let k = 0; k < i && k < lines.length; k++) offset += lines[k].length + 1;
  return passages.find((p) => p.charStart <= offset && offset < p.charEnd) ?? null;
}

/**
 * The bulk deletion in a chat export: an audit log row shaped like Discord's MESSAGE_BULK_DELETE. From the deleting
 * account to the account whose messages went; observed at the window start; the label says what and when.
 */
function bulkDelete({ meta, scenario, documentId, parsed, passages, row, i }) {
  if (!/^MESSAGE_BULK_DELETE$/i.test(String(row.action ?? ''))) return null;
  const user = String(row.user ?? '').trim();
  const target = String(row.target_user ?? '').trim();
  const guild = String(row.guild ?? '').trim();
  if (!user || (!target && !guild)) return null;
  const passage = passageOfRow(parsed, passages, i);
  if (!passage) return null;
  const passageId = `${documentId}-p${passage.index}`;
  const recordId = `${documentId}-r${i}`;
  const start = row.window_start ?? row.timestamp;
  const end = row.window_end ?? row.timestamp;
  const count = Number(row.count) > 0 ? Number(row.count) : 1;
  const from = clockOf(start);
  const to = clockOf(end);
  const when = from ? `${from.date} ${from.time}${to && to.time !== from.time ? ` to ${to.time}` : ''}` : '';

  const objects = [];
  const account = (handle) => {
    const pk = objectId('DigitalAccount', passageId, handle);
    objects.push(toServerObject(meta, 'DigitalAccount', { accountId: pk, handle, platform: 'Discord', passageId, scenario }));
    return pk;
  };
  const fromId = account(user);
  let toType = 'DigitalAccount';
  let toId;
  if (target) toId = account(target);
  else {
    toType = 'OnlineGroup';
    toId = objectId('OnlineGroup', passageId, guild);
    objects.push(toServerObject(meta, 'OnlineGroup', { groupId: toId, name: guild, platform: 'Discord', channels: [], passageId, scenario }));
  }
  const kind = 'deleted_messages_of';
  const relationshipId = `R-${createHash('sha1').update(`${passageId}|${fromId}|${kind}|${toId}`).digest('hex').slice(0, 8)}`;
  const label = `${count} message${count === 1 ? '' : 's'}${target ? ` by ${target}` : guild ? ` in ${guild}` : ''} deleted by ${user}${when ? `, ${when}` : ''}`;
  objects.push(
    toServerObject(meta, 'Relationship', {
      relationshipId,
      label,
      kind,
      fromType: 'DigitalAccount',
      fromId,
      toType,
      toId,
      fromDigitalAccountId: fromId,
      [`to${toType}Id`]: toId,
      observedAt: iso(start),
      confidence: 1,
      method: 'system',
      status: 'observed',
      passageIds: [passageId],
      recordIds: [recordId],
      scenario,
    }),
  );
  return { objects, flag: { relationshipId, label, observedAt: iso(start) ?? null, passageId, recordId, objectIds: [`Relationship:${relationshipId}`, `DigitalAccount:${fromId}`, `${toType}:${toId}`] } };
}

const DETECTORS = [bulkDelete];

/**
 * Every system flag in one parsed file.
 * @returns {{ objects: object[], flags: Array<{ relationshipId, label, observedAt, passageId, recordId, objectIds }> }}
 */
export function systemFlags({ meta, scenario, documentId, parsed, passages }) {
  const objects = [];
  const flags = [];
  const rows = parsed.rows ?? [];
  rows.forEach((row, i) => {
    for (const detect of DETECTORS) {
      const found = detect({ meta, scenario, documentId, parsed, passages, row, i });
      if (!found) continue;
      for (const o of found.objects) if (!objects.some((x) => x.__apiName === o.__apiName && x.__primaryKey === o.__primaryKey)) objects.push(o);
      flags.push(found.flag);
    }
  });
  return { objects, flags };
}
