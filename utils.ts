import crypto from 'crypto';
import b4a from 'b4a';

export function spaceHash(spaceName: string): Buffer {
  const label = spaceName.startsWith('@') ? spaceName.slice(1) : spaceName;
  const byteArray = Buffer.from(label, 'utf8');
  const lengthPrefix = Buffer.from([byteArray.length]);
  const finalByteArray = Buffer.concat([lengthPrefix, byteArray]);
  const base = Buffer.from(crypto.createHash('sha256').update(finalByteArray).digest('hex'), 'hex');
  base[0] &= 0x7f;
  base[31] &= 0xfe;
  return base;
}

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

export function deserializeEvent(serialized: string): NostrEvent {
  let arr: any;
  try {
    arr = JSON.parse(serialized);
  } catch (e) {
    throw new Error('Invalid Nostr event JSON string');
  }

  if (!Array.isArray(arr) || arr.length !== 6 || arr[0] !== 0) {
    throw new Error('Serialized event has an invalid format');
  }
  const [, pubkey, created_at, kind, tags, content] = arr;
  return { pubkey, created_at, kind, tags, content };
}


export function nostrDTag(tags : any) : string {
  if (!Array.isArray(tags)) return ''
  const tag = (tags as any[]).find(tag => Array.isArray(tag) && tag[0] === 'd' && typeof tag[1] === 'string')
  if (!tag) return '';
  return tag
}

export function nostrTarget(pubkey: string, kind: number, d : string = '') : string {
  return `${pubkey}${kind}${d}`;
}
