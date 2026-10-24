// Saved assistant conversations: one row per message.
import { query, fromJson } from '../db.js';
import { notFound } from '../errors.js';

const KEEP = 100; // messages shown when the chat opens

const toMessage = (r) => ({ id: r.msg_id, from: r.sender, text: r.text, ...fromJson(r.meta, {}) });

export async function listMessages(userId) {
  const rows = await query('SELECT * FROM chat_messages WHERE user_id = ? ORDER BY id DESC LIMIT ?', [userId, KEEP]);
  return rows.reverse().map(toMessage);
}

export async function saveMessages(userId, messages) {
  for (const { id, from, text, ...meta } of messages) {
    await query('INSERT INTO chat_messages (user_id, msg_id, sender, text, meta) VALUES (?, ?, ?, ?, ?)',
      [userId, id, from, text, JSON.stringify(meta)]);
  }
  return { saved: messages.length };
}

/** Marks a preview as confirmed, cancelled or saving. */
export async function setMessageStatus(userId, msgId, status) {
  const [row] = await query('SELECT * FROM chat_messages WHERE user_id = ? AND msg_id = ?', [userId, msgId]);
  if (!row) throw notFound('Message');
  const meta = { ...fromJson(row.meta, {}), status };
  if (['done', 'cancelled'].includes(status)) delete meta.token; // a used or cancelled preview can't be confirmed again
  await query('UPDATE chat_messages SET meta = ? WHERE id = ?', [JSON.stringify(meta), row.id]);
  return { ok: true };
}

export async function clearMessages(userId) {
  await query('DELETE FROM chat_messages WHERE user_id = ?', [userId]);
  return { cleared: true };
}
