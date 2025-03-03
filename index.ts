import HyperDHT, {HyperDHTOptions} from 'hyperdht';
import Cache, {MaxCacheOptions} from 'xache';
import c from 'compact-encoding';
import {BOOTSTRAP_NODES, COMMANDS} from './constants';
import b4a from 'b4a';
import * as m from './messages';
import {DHT} from 'dht-rpc';
import {AnchorStore} from './anchor';
import {
  NostrEvent,
  verifyTarget,
  computeTarget,
  computeSpaceTarget, computePubkeyTarget, isAcceptableEvent
} from './utils';
import {Buffer} from 'buffer';
import {CompactEvent, toCompactEvent} from './messages';

const defaultCacheMaxSize = 32768;
const defaultMaxAge = 48 * 60 * 60 * 1000; // 48 hours

interface NodeResposne {
  token: any
  from: any,
  to: any,
  event: CompactEvent
}

export interface FabricOptions extends HyperDHTOptions {
    maxSize?: number;
    maxAge?: number;
    spaces?: MaxCacheOptions;
    pubkeys?: MaxCacheOptions;
    anchor?: AnchorStore;
}

export const ERROR = {
  // hyperdht errors
  // noise / connection related
  NONE: 0,
  ABORTED: 1,
  VERSION_MISMATCH: 2,
  TRY_LATER: 3,
  // dht related
  SEQ_REUSED: 16,
  SEQ_TOO_LOW: 17,
  // space related
  EVENT_ANCHOR_REJECTED: 40,
  EVENT_UNSUPPORTED: 42,
  EVENT_TOO_NEW: 44,
  EVENT_TOO_OLD: 45,
};

export const ERROR_STRING: Record<number, string> = {
  // noise / connection related
  [ERROR.NONE]: 'none',
  [ERROR.ABORTED]: 'aborted',
  [ERROR.VERSION_MISMATCH]: 'version mismatch',
  [ERROR.TRY_LATER]: 'try later',
  // dht related
  [ERROR.SEQ_REUSED]: 'sequence reused',
  [ERROR.SEQ_TOO_LOW]: 'sequence too low',
  // fabric related
  [ERROR.EVENT_ANCHOR_REJECTED]: 'event anchor rejected',
  [ERROR.EVENT_TOO_NEW]: 'event too far in the future',
  [ERROR.EVENT_TOO_OLD]: 'event too old',
};

export class Fabric extends HyperDHT {
  private _spaces: Cache | null = null;
  private _pubkeys: Cache | null = null;
  public anchor: AnchorStore;

  constructor(opts: FabricOptions = {}) {
    opts.bootstrap = opts.bootstrap || BOOTSTRAP_NODES
    super(opts);

    this.once('persistent', () => {
      this._spaces = new Cache(opts.spaces || {
        maxSize: opts.maxSize || defaultCacheMaxSize,
        maxAge: opts.maxAge || defaultMaxAge,
      });
      this._pubkeys = new Cache(opts.pubkeys || {
        maxSize: opts.maxSize || defaultCacheMaxSize,
        maxAge: opts.maxAge || defaultMaxAge,
      });
    });

    if (!opts.anchor) throw new Error('Anchor setup is required');
    this.anchor = opts.anchor;
  }

  static bootstrapper(port: number, host: string, opts?: FabricOptions): DHT {
    return super.bootstrapper(port, host, opts)
  }

  async eventPut(evt: NostrEvent, opts: any = {}) : Promise<any> {
    if (!isAcceptableEvent(evt.kind)) throw new Error('Event kind not supported');
    const raw = toCompactEvent(evt, opts.binary || false);
    const p: CompactEvent | null = c.decode(m.compactEvent, raw);
    if (!p) throw new Error('Could not decode event');

    const targetInfo = computeTarget(p);
    if (!opts.skipVerify) {
      if (!this.anchor.verifySig(p)) throw new Error('signature verification failed');
    }
    if (targetInfo.space) this.anchor.assertAnchored(p, targetInfo);

    opts = {
      ...opts,
      map: mapEvent,
      commit(reply: any, dht: any) {
        const q = async () => {
          const q = await dht.request({
            token: reply.token,
            target: targetInfo.target,
            command: COMMANDS.EVENT_PUT,
            value: raw,
          }, reply.from);
          if (q.error !== 0) {
            const err = ERROR_STRING[q.error] || 'unknown';
            throw new Error(`put request failed - ${err} (code: ${q.error})`);
          }
          return q;
        };
        return q();
      },
    };

    const query = this.query({target: targetInfo.target, command: COMMANDS.EVENT_GET, value: c.encode(c.uint, 0)}, opts);
    await query.finished();

    return {target: targetInfo.target, closestNodes: query.closestNodes, event: p};
  }
  
  async eventGet(spaceOrPubkey : string, kind : number, d : string = '', opts : any = {}) : Promise<any> {
    if (!isAcceptableEvent(kind)) throw new Error('Event kind not supported');
    const target = spaceOrPubkey.startsWith('@') ? computeSpaceTarget(spaceOrPubkey, kind, d) :
      computePubkeyTarget(spaceOrPubkey, kind, d);

    let refresh = opts.refresh || null;
    let signed: Buffer | Uint8Array | null = null;
    let result: any = null;
    opts = {...opts, map: mapEvent, commit: refresh ? commit : null};

    const userCreatedAt = opts.created_at || 0;
    const query = this.query({target, command: COMMANDS.EVENT_GET, value: c.encode(c.uint, userCreatedAt)}, opts);
    const latest = opts.latest !== false;
    const closestNodes: Buffer[] = [];

    for await (const node of query) {
      closestNodes.push(node.from);
      if (result && node.createdAt <= result.createdAt) continue;
      if (node.createdAt < userCreatedAt) continue;
      const targetInfo = verifyTarget(node.event, target);
      if (!targetInfo) continue;
      if (!this.anchor.verifySig(node.event)) continue;
      if (targetInfo.space && !this.anchor.verifyAnchor(node.event, targetInfo)) continue;
      if (!latest) {
        result = node;
        break;
      }
      if (!result || (node.event.created_at > result.event.created_at)) result = node;
    }
    if (!result) {
      return null;
    }

    closestNodes.splice(closestNodes.indexOf(result.from), 1);
    result.closestNodes = closestNodes;

    return result;

    function commit(reply: any, dht: Fabric) {
      if (!signed && result && refresh) {
        if (refresh(result)) {
          signed = c.encode(m.compactEvent, result.event);
        } else {
          refresh = null;
        }
      }

      return signed
        ? dht.request({
          token: reply.token,
          target,
          command: COMMANDS.EVENT_PUT,
          value: signed,
        }, reply.from)
        : Promise.resolve(null);
    }
  }

  onEventPut(req: any) {
    if (!req.target || !req.token || !req.value) return;
    const p: CompactEvent = decode(m.compactEvent, req.value);
    if (!p) return;
    if (!isAcceptableEvent(p.kind)) return;

    const targetInfo = verifyTarget(p, req.target);
    if (!targetInfo) return;
    if (!this.anchor.verifySig(p)) return;

    const isAnchored = !!targetInfo.space;
    const k = b4a.toString(req.target, 'hex');

    const local = isAnchored ? this._spaces?.get(k) : this._pubkeys?.get(k);
    let existing: any = local ? decode(isAnchored ? m.eventRecord : m.compactEvent, local) : undefined;

    if (existing) {
      if (existing.created_at > p.created_at) {
        req.error(ERROR.EVENT_TOO_OLD);
        return;
      }
      const now = Math.floor(Date.now() / 1000);
      const max = now + 30 * 24 * 60 * 60; // 30 days in future
      if (p.created_at > max) {
        req.error(ERROR.EVENT_TOO_NEW);
        return;
      }
    }

    if (isAnchored) {
      try {
        const store = this.anchor.assertAnchored(p, targetInfo, existing);
        this._spaces?.set(k, c.encode(m.eventRecord, store));
        req.reply(null);
      } catch (e) {
        req.error(ERROR.EVENT_ANCHOR_REJECTED);
      }
      return;
    }

    this._pubkeys?.set(k, c.encode(m.compactEvent, p))
    req.reply(null);
  }

  onEventGet(req: any) {
    if (!req.target || !req.value) return;

    let createdAt = 0;
    try {
      createdAt = c.decode(c.uint, req.value);
    } catch {
      return;
    }

    const k = b4a.toString(req.target, 'hex');
    const value = this._spaces?.get(k) || this._pubkeys?.get(k);

    if (!value) {
      req.reply(null);
      return;
    }

    const localCreatedAt = c.decode(c.uint, value);
    req.reply(localCreatedAt < createdAt ? null : value);
  }

  onrequest(req: any): boolean {
    if (!this._spaces || !this._pubkeys) return super.onrequest(req);

    switch (req.command) {
    case COMMANDS.EVENT_PUT:
      this.onEventPut(req);
      return true;
    case COMMANDS.EVENT_GET:
      this.onEventGet(req);
      return true;
    default:
      return super.onrequest(req);
    }
  }

  destroy(opts?: { force?: boolean }): Promise<void> {
    super.destroy(opts);
    this.anchor.destroy()
    return Promise.resolve()
  }
}

function decode(enc: any, val: any) {
  try {
    return val && c.decode(enc, val);
  } catch (err) {
    return null;
  }
}

function mapEvent(node: any) : NodeResposne | null  {
  if (!node.value) return null;

  try {
    const event = c.decode(m.compactEvent, node.value);

    return {
      token: node.token,
      from: node.from,
      to: node.to,
      event
    };
  } catch {
    return null;
  }
}
