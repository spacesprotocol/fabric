import b4a from 'b4a';
import {CompactEvent, TargetInfo} from './messages';
import {Veritas} from '@spacesprotocol/veritas';
import {DNS_EVENT_KIND} from './constants';

// from nostr-tools:
// https://github.com/nbd-wtf/nostr-tools/blob/160987472fd4922dd80c75648ca8939dd2d96cc0/event.ts#L42
export type NostrEvent = {
  id?: string
  sig?: string
  kind: number
  tags: string[][]
  pubkey: string
  content: string
  created_at: number
  proof?: string
}

// from nostr-tools:
// https://github.com/nbd-wtf/nostr-tools/blob/160987472fd4922dd80c75648ca8939dd2d96cc0/event.ts#L61
export function validateEvent(event: NostrEvent): boolean {
  if (typeof event.content !== 'string') return false
  if (typeof event.created_at !== 'number') return false
  if (typeof event.pubkey !== 'string') return false
  if (!event.pubkey.match(/^[a-f0-9]{64}$/)) return false

  if (!Array.isArray(event.tags)) return false
  for (let i = 0; i < event.tags.length; i++) {
    let tag = event.tags[i]
    if (!Array.isArray(tag)) return false
    for (let j = 0; j < tag.length; j++) {
      if (typeof tag[j] === 'object') return false
    }
  }
  return true
}

// from nostr-tools:
// https://github.com/nbd-wtf/nostr-tools/blob/160987472fd4922dd80c75648ca8939dd2d96cc0/event.ts#L42
export function serializeEvent(evt : NostrEvent) {
  if (!validateEvent(evt))
    throw new Error("can't serialize event with wrong or missing properties");

  return JSON.stringify([
    0,
    evt.pubkey,
    evt.created_at,
    evt.kind,
    evt.tags,
    evt.content,
  ]);
}

export function nostrTarget(key: string, kind: number, d : string = '') : string {
  if (key.length != 64 || !key.match(/^[a-f0-9]{64}$/)) throw new Error('must be a 32-byte hex encoded key string');
  if (isNaN(kind)) throw new Error(`kind must be a number, got ${kind}`);
  return `${key}.${kind}.${d}`;
}

export function isAcceptableEvent(evtKind: number) : boolean {
  return evtKind == DNS_EVENT_KIND || isReplaceableEvent(evtKind) || isAddressableEvent(evtKind)
}

export function isReplaceableEvent(evtKind: number): boolean {
  return evtKind === 0 || evtKind === 3 || (evtKind >= 10000 && evtKind < 20000);
}

export function isAddressableEvent(evtKind: number): boolean {
  return evtKind >= 30000 && evtKind < 40000;
}

export function computeSpaceTarget(space : string, kind : number, d : string = '') : Uint8Array {
  if (!space.startsWith('@')) throw new Error('space name must start with @')

  const key = Veritas.sha256(b4a.from(space, 'utf-8'));
  const targetString = nostrTarget(b4a.toString(key, 'hex'), kind, d);
  return Veritas.sha256(b4a.from(targetString, 'utf-8'));
}

export function computePubkeyTarget(pubkey: string | Uint8Array, kind : number, d : string = '') : Uint8Array {
  let pub : string = pubkey instanceof Uint8Array ? b4a.from(pubkey).toString('hex') : pubkey;
  if (pub.length !== 64 || !pub.match(/^[a-f0-9]{64}$/)) throw new Error('invalid pubkey');
  const targetString = nostrTarget(pub, kind, d);
  return Veritas.sha256(b4a.from(targetString, 'utf-8'));
}

export function computeTarget(evt: CompactEvent) : TargetInfo {
  const anchored = evt.proof.length !== 0;
  if (isNaN(evt.kind)) throw new Error('Invalid event kind must be a number');

  let space, d;

  for (const tag of evt.tags) {
    if (tag.length < 2) continue;
    if (!space && anchored && tag[0] === 'space') {
      space = tag[1];
      continue;
    }
    if (!d && tag[0] === 'd') {
      d = tag[1];
    }
    if (space && d) break;
  }

  if (anchored && !space) throw new Error('Anchored event must have a space tag');
  if (isAddressableEvent(evt.kind) && !d) throw new Error('Addressable events must have a d tag');

  d = d || '';
  const target = space ? computeSpaceTarget(space, evt.kind, d) :
    computePubkeyTarget(evt.pubkey, evt.kind, d);

  return {
    d, space, target
  }
}

export function verifyTarget(evt: CompactEvent, target: Uint8Array): TargetInfo | null {
  try {
    const expected = computeTarget(evt);
    if (b4a.compare(target, expected.target) !== 0) return null;
    return expected
  } catch (e) {
    return null
  }
}

export function log(...args: any[]): void {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}]`, ...args);
}
