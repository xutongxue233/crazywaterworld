import { toNumber } from './client.mjs';
import { uidText } from './hero-equipment.mjs';

// A queue update can arrive before the resource snapshot reflects its debit.
// Keep this barrier by role/world (not connection) until a later gold read has
// accounted for that write. Only an attributed server refusal cancels it.
const pending = new Map();

export function goldAccountKey(player) {
  const uid = uidText(player?.playerId);
  const world = toNumber(player?.worldId);
  if (!uid || !Number.isSafeInteger(world) || world <= 0) throw new Error('无法确认金币操作的账号和区服');
  return JSON.stringify([uid, world]);
}

function balanceNumber(value) {
  const balance = value == null ? NaN : toNumber(value);
  if (!Number.isSafeInteger(balance) || balance < 0) throw new Error('无法确认金币余额');
  return balance;
}

export function reconcileGold(player, value) {
  const key = goldAccountKey(player);
  const balance = balanceNumber(value);
  const saved = pending.get(key);
  if (saved && balance <= saved.expectedAfter) pending.delete(key);
  return !pending.has(key);
}

export function reserveGold(player, value, cost, request) {
  const key = goldAccountKey(player);
  const balance = balanceNumber(value);
  if (!Number.isSafeInteger(cost) || cost <= 0 || balance < cost || typeof request !== 'string' || !request) {
    throw new Error('无法确认本次金币消耗');
  }
  if (!reconcileGold(player, balance)) throw new Error('上次操作的金币扣款尚未同步，等待余额更新');
  const ticket = { key, request, expectedAfter: balance - cost };
  pending.set(key, ticket);
  return ticket;
}

export function rejectGold(ticket, error) {
  if (ticket && error?.prompt && error.request === ticket.request && pending.get(ticket.key) === ticket) {
    pending.delete(ticket.key);
  }
}

// Only the caller that still owns this reservation may cancel a write it has
// proved was never sent. A later reservation must survive stale cancellation.
export function cancelUnsentGold(ticket) {
  if (ticket && pending.get(ticket.key) === ticket) pending.delete(ticket.key);
}
