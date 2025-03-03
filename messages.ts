import c from 'compact-encoding';
import b4a from 'b4a';
import {NostrEvent} from './utils';

export interface CompactEvent {
  created_at: number;
  kind: number;
  pubkey: Uint8Array;
  tags: string[][];
  // Whether to base64 encode it or keep it as utf-8 string
  // when converting it back to a canonical nostr event
  binary_content: boolean,
  content: Uint8Array,
  sig: Uint8Array,
  proof: Uint8Array
}

export interface EventRecord {
  event: CompactEvent,
  root: Uint8Array
}

export interface TargetInfo {
  target: Uint8Array,
  space?: string,
  d?: string,
}

export function toCompactEvent(evt: NostrEvent, binary_content: boolean) : Uint8Array {
  if (!evt.sig) throw new Error('must be a signed event');

  return c.encode(compactEvent, {
    created_at: evt.created_at,
    kind: evt.kind,
    tags: evt.tags,
    binary_content: binary_content,
    content:  b4a.from(evt.content, binary_content ? 'base64' : 'utf-8'),
    sig: b4a.from(evt.sig, 'hex'),
    pubkey: b4a.from(evt.pubkey, 'hex'),
    proof: evt.proof ? b4a.from(evt.proof, 'base64') : null,
  });
}

export function signableCompactEvent(evt: CompactEvent) : Uint8Array {
  return b4a.from(JSON.stringify([
    0,
    b4a.toString(evt.pubkey, 'hex'),
    evt.created_at,
    evt.kind,
    evt.tags,
    b4a.toString(evt.content || new Uint8Array(), evt.binary_content ? 'base64' : 'utf-8'),
  ]), 'utf-8')
}

export function toEvent(evt: CompactEvent) : NostrEvent {
  return {
    pubkey: b4a.toString(evt.pubkey, 'hex'),
    created_at: evt.created_at,
    kind: evt.kind,
    tags: evt.tags,
    content: b4a.toString(evt.content || new Uint8Array(), evt.binary_content ? 'base64' : 'utf-8'),
    sig: b4a.toString(evt.sig, 'hex'),
    proof: evt.proof ? b4a.toString(evt.proof, 'base64') : undefined
  }
}


export const compactEvent = {
  preencode (state: any, m: CompactEvent): void {
    c.uint.preencode(state, m.created_at)
    c.uint.preencode(state, m.kind)
    c.fixed32.preencode(state, m.pubkey)
    c.array(c.array(c.utf8)).preencode(state, m.tags)
    c.bool.preencode(state, m.binary_content)
    c.buffer.preencode(state, m.content)
    c.fixed64.preencode(state, m.sig)
    c.buffer.preencode(state, m.proof)
  },
  encode (state: any, m: CompactEvent): void {
    c.uint.encode(state, m.created_at)
    c.uint.encode(state, m.kind)
    c.fixed32.encode(state, m.pubkey)
    c.array(c.array(c.utf8)).encode(state, m.tags)
    c.bool.encode(state, m.binary_content)
    c.buffer.encode(state, m.content)
    c.fixed64.encode(state, m.sig)
    c.buffer.encode(state, m.proof)
  },
  decode (state: any): CompactEvent {
    return {
      created_at: c.uint.decode(state),
      kind: c.uint.decode(state),
      pubkey: c.fixed32.decode(state),
      tags: c.array(c.array(c.utf8)).decode(state),
      binary_content: c.bool.decode(state),
      content: c.buffer.decode(state) || new Uint8Array,
      sig: c.fixed64.decode(state),
      proof: c.buffer.decode(state) || new Uint8Array
    }
  }
}

export const eventRecord = {
  preencode (state: any, m: EventRecord): void {
    compactEvent.preencode(state, m.event)
    c.fixed32.preencode(state, m.root)
  },
  encode (state: any, m: EventRecord): void {
    compactEvent.encode(state, m.event)
    c.fixed32.encode(state, m.root)
  },
  decode (state: any): EventRecord {
    return {
      event: compactEvent.decode(state),
      root: c.fixed32.decode(state)
    }
  }
};
