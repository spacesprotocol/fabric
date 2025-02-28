import HyperDHT, {HyperDHTOptions} from 'hyperdht';
import Cache, {MaxCacheOptions} from 'xache';
import c from 'compact-encoding';
import {BOOTSTRAP_NODES, COMMANDS} from './constants';
import b4a from 'b4a';
import * as m from './messages';
import {DHT} from 'dht-rpc';
import {Receipt, VeritasSync} from './veritas';
import {nostrTarget, NostrEvent, serializeEvent, spaceHash, nostrDTag} from './utils';
import {Buffer} from 'buffer';


const defaultCacheMaxSize = 32768;
const defaultMaxAge = 48 * 60 * 60 * 1000; // 48 hours

export interface SignedPacket {
  space: string;
  serial: number;
  signature: Buffer;
  value: Buffer;
  proof: Buffer;
}

export interface FabricOptions extends HyperDHTOptions {
  maxSize?: number;
  maxAge?: number;
  zones?: MaxCacheOptions;
  nostr?: MaxCacheOptions;
  veritas?: VeritasSync;
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
  INVALID_SIGNATURE: 25,
  NO_MATCHING_TRUST_ANCHOR: 26,
  NON_STALE_ANCESTOR_EXISTS: 27,
  STALE_PROOF: 28,
  // nostr related
  EVENT_MALFORMED: 40,
  EVENT_UNSUPPORTED: 41,
  EVENT_TOO_NEW: 42,
  EVENT_TOO_OLD: 43,
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
  [ERROR.INVALID_SIGNATURE]: 'invalid signature',
  [ERROR.NO_MATCHING_TRUST_ANCHOR]: 'no matching trust path',
  [ERROR.NON_STALE_ANCESTOR_EXISTS]: 'non-stale ancestor trust path exists',
  [ERROR.STALE_PROOF]: 'stale trust path',
  // nostr related
  [ERROR.EVENT_MALFORMED]: 'event malformed',
  [ERROR.EVENT_UNSUPPORTED]: 'event unsupported',
  [ERROR.EVENT_TOO_NEW]: 'event too far in the future',
  [ERROR.EVENT_TOO_OLD]: 'event too old',
};


export class Fabric extends HyperDHT {
  private _zones: Cache | null = null;
  private _nostr: Cache | null = null;
  public veritas: VeritasSync;

  constructor(opts: FabricOptions = {}) {
    opts.bootstrap = opts.bootstrap || BOOTSTRAP_NODES
    super(opts);

    this.once('persistent', () => {
      this._zones = new Cache(opts.zones || {
        maxSize: opts.maxSize || defaultCacheMaxSize,
        maxAge: opts.maxAge || defaultMaxAge,
      });
      this._nostr = new Cache(opts.nostr || {
        maxSize: opts.maxSize || defaultCacheMaxSize,
        maxAge: opts.maxAge || defaultMaxAge,
      });
    });

    if (!opts.veritas) throw new Error('Veritas options are required');
    this.veritas = opts.veritas;
  }

  static bootstrapper(port: number, host: string, opts?: FabricOptions): DHT {
    return super.bootstrapper(port, host, opts)
  }

  async nostrPublish(evt: NostrEvent, opts: any = {}) {
    const value = b4a.from(serializeEvent(evt), 'utf-8');
    if (!evt.sig) throw new Error('must be a signed nostr event');
    let signature = b4a.from(evt.sig, 'hex');
    const targetString = nostrTarget(evt.pubkey, evt.kind, nostrDTag(evt.tags));
    if (!targetString) throw new Error('invalid nostr event - could not find target string')
    const target = this.veritas.sha256(b4a.from(targetString));
    const publicKey = b4a.from(evt.pubkey, 'hex');

    if (!opts.skipVerify)
      this.veritas.verifySchnorr(publicKey, this.veritas.sha256(value), signature);

    const signed = c.encode(m.nostrPutRequest, {publicKey, signature, value})
    opts = {
      ...opts,
      map: mapNostr,
      commit(reply: any, dht: any) {
        const q = async () => {
          const q = await dht.request({
            token: reply.token,
            target,
            command: COMMANDS.NOSTR_PUT,
            value: signed,
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

    const query = this.query({target, command: COMMANDS.NOSTR_GET, value: c.encode(c.uint, 0)}, opts);
    await query.finished();

    return {target, closestNodes: query.closestNodes, signature};
  }

  async zonePublish(packet: SignedPacket, opts: any = {}) {
    const target = spaceHash(packet.space);
    const signable = c.encode(m.zoneSignable, {serial: packet.serial, value: packet.value});
    // Throws on failure
    this.veritas.verifyZone(target, signable, packet.signature, packet.proof);
    const signed = c.encode(m.zonePutRequest, {serial: packet.serial, value: packet.value, signature: packet.signature, proof: packet.proof});
    opts = {
      ...opts,
      map: mapZone,
      commit(reply: any, dht: any) {
        const q = async () => {
          const q = await dht.request({
            token: reply.token,
            target,
            command: COMMANDS.ZONE_PUT,
            value: signed,
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

    const query = this.query({target, command: COMMANDS.ZONE_GET, value: c.encode(c.uint, 0)}, opts);
    await query.finished();

    return {target, closestNodes: query.closestNodes, serial: packet.serial, signature: packet.signature};
  }

  async zoneGet(space: string, opts: any = {}) {
    const target = spaceHash(space);
    let refresh = opts.refresh || null;
    let signed: Buffer | Uint8Array | null = null;
    let result: any = null;
    opts = {...opts, map: mapZone, commit: refresh ? commit : null};

    const userSerial = opts.serial || 0;
    const query = this.query({target, command: COMMANDS.ZONE_GET, value: c.encode(c.uint, userSerial)}, opts);
    const latest = opts.latest !== false;
    const closestNodes: Buffer[] = [];

    for await (const node of query) {
      closestNodes.push(node.from);
      if (result && node.serial <= result.serial) continue;
      if (node.serial < userSerial) continue;
      const msg = c.encode(m.zoneSignable, {serial: node.serial, value: node.value});
      try {
        const receipt = this.veritas.verifyZone(target, msg, node.signature, node.proof);
        if (!latest) {
          result = node;
          result.trustpoint = receipt.trustpoint;
          break;
        }
        if (!result || (receipt.trustpoint > result.trustpoint && node.serial > result.serial)) result = node;
      } catch (e) {
        console.warn(`Could not verify from peer ${node.from.host}:${node.from.port}: ${e}`);
      }
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
          signed = c.encode(m.zonePutRequest, {
            serial: result.serial,
            value: result.value,
            signature: result.signature,
            proof: result.proof
          });
        } else {
          refresh = null;
        }
      }

      return signed
        ? dht.request({
          token: reply.token,
          target,
          command: COMMANDS.ZONE_PUT,
          value: signed,
        }, reply.from)
        : Promise.resolve(null);
    }
  }

  async nostrGet(npub: string, kind: number, d : string = '', opts: any = {}) {
    if (npub.length !== 64 || !npub.match(/^[a-f0-9]{64}$/)) throw new Error(`expected a hex encoded npub`)
    const targetString = nostrTarget(npub, kind, d);
    const target = this.veritas.sha256(b4a.from(targetString));
    let refresh = opts.refresh || null;
    let signed: Buffer | Uint8Array | null = null;
    let result: any = null;
    opts = {...opts, map: mapNostr, commit: refresh ? commit : null};

    const userCreatedAt = opts.createdAt || 0;
    const query = this.query({target, command: COMMANDS.NOSTR_GET, value: c.encode(c.uint, userCreatedAt)}, opts);
    const latest = opts.latest !== false;
    const closestNodes: Buffer[] = [];
    const pubkey = b4a.from(npub, 'hex');

    for await (const node of query) {
      closestNodes.push(node.from);
      if (result && node.createdAt <= result.createdAt) continue;
      if (node.createdAt < userCreatedAt) continue;
      try {
        this.veritas.verifyNostr(target, node.value, pubkey, node.signature);
        if (!latest) {
          result = node;
          break;
        }
        if (!result || (node.createdAt > result.createdAt)) result = node;
      } catch (e) {
        console.warn(`Could not verify from peer ${node.from.host}:${node.from.port}: ${e}`);
      }
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
          signed = c.encode(m.nostrPutRequest, {
            value: result.value,
            publicKey: result.publicKey,
            signature: result.signature,
          });
        } else {
          refresh = null;
        }
      }

      return signed
        ? dht.request({
          token: reply.token,
          target,
          command: COMMANDS.NOSTR_PUT,
          value: signed,
        }, reply.from)
        : Promise.resolve(null);
    }
  }

  onnostrput(req: any) {
    if (!req.target || !req.token || !req.value) return;

    const p = decode(m.nostrPutRequest, req.value);
    if (!p) return;

    const {value, publicKey, signature} = p;
    if (!value) return;

    if (req.target.length !== 32) return;
    let evtCreatedAt : number;
    try {
      evtCreatedAt = this.veritas.verifyNostr(req.target, value, publicKey, signature);
    } catch (e) {
      console.error(e)
      req.error(ERROR.EVENT_MALFORMED)
      return;
    }

    const k = b4a.toString(req.target, 'hex');
    const local = this._nostr?.get(k);
    if (local) {
      const existing = c.decode(m.nostrRecord, local);
      if (existing.createdAt > evtCreatedAt) {
        req.error(ERROR.EVENT_TOO_OLD);
        return;
      }
    }

    console.log(`nostrPut: storing ${req.target.toString('hex')}`);
    this._nostr?.set(k, c.encode(m.nostrRecord, {
      value,
      signature,
      publicKey,
      createdAt: evtCreatedAt
    }));
    req.reply(null);
  }

  onnostrget(req: any) {
    if (!req.target || !req.value) return;

    let createdAt = 0;
    try {
      createdAt = c.decode(c.uint, req.value);
    } catch {
      return;
    }

    const k = b4a.toString(req.target, 'hex');
    const value = this._nostr?.get(k);

    if (!value) {
      req.reply(null);
      return;
    }

    const localCreatedAt = c.decode(c.uint, value);
    req.reply(localCreatedAt < createdAt ? null : value);
  }

  onzoneput(req: any) {
    if (!req.target || !req.token || !req.value) return;

    const p = decode(m.zonePutRequest, req.value);
    if (!p) return;

    const {serial, value, signature, proof} = p;
    if (!value) return;

    const msg = c.encode(m.zoneSignable, {serial, value});
    let receipt: Receipt | null = null;
    let publicKey : Uint8Array | undefined;
    try {
      // Validate the proof first.
      receipt = this.veritas.verifyZone(req.target, msg, signature, proof);
      publicKey = receipt.spaceout.getPublicKey();
      if (!publicKey) throw new Error('Expected a public key');
    } catch (e: any) {
      console.error(e);
      req.error(typeof e == 'string' && e.includes('NoMatchingAnchor') ?
        ERROR.NO_MATCHING_TRUST_ANCHOR : ERROR.INVALID_SIGNATURE
      );
      return;
    }

    const k = b4a.toString(req.target, 'hex');
    const local = this._zones?.get(k);
    if (local) {
      const existing = c.decode(m.zoneRecord, local);
      const identical = existing.value && b4a.compare(value, existing.value) === 0;
      const localTrustpoint = this.veritas.getTrustPoint(existing.root);

      // Prevent reuse of a sequence when the value has changed.
      if (existing.value && !identical && existing.serial === serial) {
        req.error(ERROR.SEQ_REUSED);
        return;
      }
      // New updates must have a higher sequence.
      if (serial < existing.serial) {
        req.error(ERROR.SEQ_TOO_LOW);
        return;
      }

      const pubkey_changed = b4a.compare(publicKey , existing.publicKey) !== 0;
      if (pubkey_changed) {
        // We only require that the new proof is higher than the stored proof.
        if (localTrustpoint && receipt.trustpoint <= localTrustpoint) {
          req.error(ERROR.STALE_PROOF);
          return;
        }
      } else {
        // Pubkeys still the same, we prefer older but non-stale proofs
        if (localTrustpoint && receipt.trustpoint !== localTrustpoint) {
          // If the submitted proof is stale and older than the stored proof, reject it.
          // Note: this still allows older proofs to take priority over recent ones as long
          // as they're not stale.
          if (this.veritas.isStale(receipt.trustpoint) && receipt.trustpoint < localTrustpoint) {
            req.error(ERROR.STALE_PROOF);
            return;
          }
          // If the stored proof is still valid (non-stale) and the new proof is more recent,
          // we reject the new proof since the value (and pubkey) hasn't changed.
          //
          // This ensures:
          // 1. Clients with older trust anchors can continue to validate.
          // 2. Someone can't publish very recent proofs for spaces they don't own to block older clients.
          if (!this.veritas.isStale(localTrustpoint) && receipt.trustpoint > localTrustpoint) {
            req.error(ERROR.NON_STALE_ANCESTOR_EXISTS);
            return;
          }
        }
      }
    }

    console.log(`zonePut: storing ${req.target.toString('hex')}`);
    this._zones?.set(k, c.encode(m.zoneRecord, {
      serial,
      value,
      signature,
      root: receipt.root,
      publicKey,
      proof
    }));
    req.reply(null);
  }


  onzoneget(req: any) {
    if (!req.target || !req.value) return;

    let serial = 0;
    try {
      serial = c.decode(c.uint, req.value);
    } catch {
      return;
    }

    const k = b4a.toString(req.target, 'hex');
    const value = this._zones?.get(k);

    if (!value) {
      req.reply(null);
      return;
    }

    const localSerial = c.decode(c.uint, value);
    req.reply(localSerial < serial ? null : value);
  }

  onrequest(req: any): boolean {
    if (!this._zones) return super.onrequest(req);

    switch (req.command) {
    case COMMANDS.ZONE_PUT:
      this.onzoneput(req);
      return true;
    case COMMANDS.ZONE_GET:
      this.onzoneget(req);
      return true;
    case COMMANDS.NOSTR_PUT:
      this.onnostrput(req);
      return true;
    case COMMANDS.NOSTR_GET:
      this.onnostrget(req);
      return true;
    default:
      return super.onrequest(req);
    }
  }

  destroy(opts?: { force?: boolean }): Promise<void> {
    super.destroy(opts);
    this.veritas.destroy()
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

function mapZone(node: any) {
  if (!node.value) return null;

  try {
    const {serial, value, signature, proof} = c.decode(m.zoneRecord, node.value);

    return {
      token: node.token,
      from: node.from,
      to: node.to,
      serial,
      value,
      signature,
      proof
    };
  } catch {
    return null;
  }
}

function mapNostr(node: any) {
  if (!node.value) return null;

  try {
    const {createdAt, value, publicKey, signature} = c.decode(m.nostrRecord, node.value);

    return {
      token: node.token,
      from: node.from,
      to: node.to,
      publicKey,
      createdAt,
      value,
      signature,
    };
  } catch {
    return null;
  }
}
