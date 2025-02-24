import HyperDHT, {HyperDHTOptions} from 'hyperdht';
import Cache, {MaxCacheOptions} from 'xache';
import c from 'compact-encoding';
import {BOOTSTRAP_NODES, COMMANDS} from './constants';
import b4a from 'b4a';
import * as m from './messages';
import {DHT} from 'dht-rpc';
import {Receipt, VeritasSync} from './veritas';
import {spaceHash} from './utils';

const defaultMaxSize = 32768;
const defaultMaxAge = 48 * 60 * 60 * 1000; // 48 hours

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
};

export interface FabricOptions extends HyperDHTOptions {
    maxSize?: number;
    maxAge?: number;
    zones?: MaxCacheOptions;
    veritas?: VeritasSync;
}

export class Fabric extends HyperDHT {
  private _zones: Cache | null = null;
  public veritas: VeritasSync;

  constructor(opts: FabricOptions = {}) {
    opts.bootstrap = opts.bootstrap || BOOTSTRAP_NODES
    super(opts);

    this.once('persistent', () => {
      this._zones = new Cache(opts.zones || {
        maxSize: opts.maxSize || defaultMaxSize,
        maxAge: opts.maxAge || defaultMaxAge,
      });
    });

    if (!opts.veritas) throw new Error('Veritas options are required');
    this.veritas = opts.veritas;
  }

  static bootstrapper(port: number, host: string, opts?: FabricOptions): DHT {
    return super.bootstrapper(port, host, opts)
  }

  async zonePublish(space: string, value: Buffer, signature: Buffer, proof: Buffer, opts: any = {}) {
    const target = spaceHash(space);
    const seq = opts.seq || 0;
    const signed = c.encode(m.zonePutRequest, {seq, value, signature, proof});
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

    return {target, closestNodes: query.closestNodes, seq, signature};
  }

  async zoneGet(space: string, opts: any = {}) {
    const target = spaceHash(space);
    let refresh = opts.refresh || null;
    let signed: Buffer | Uint8Array | null = null;
    let result: any = null;
    opts = {...opts, map: mapZone, commit: refresh ? commit : null};

    const userSeq = opts.seq || 0;
    const query = this.query({target, command: COMMANDS.ZONE_GET, value: c.encode(c.uint, userSeq)}, opts);
    const latest = opts.latest !== false;
    const closestNodes: Buffer[] = [];

    for await (const node of query) {
      closestNodes.push(node.from);
      if (result && node.seq <= result.seq) continue;
      if (node.seq < userSeq) continue;
      const msg = c.encode(m.zoneSignable, {seq: node.seq, value: node.value});
      try {
        const receipt = this.veritas.verifyPut(target, msg, node.signature, node.proof);
        if (!latest) {
          result = node;
          result.proofSeq = receipt.proofSeq;
          break;
        }
        if (!result || (receipt.proofSeq > result.proofSeq && node.seq > result.seq)) result = node;
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
            seq: result.seq,
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

  destroy(opts?: { force?: boolean }): Promise<void> {
    super.destroy(opts);
    this.veritas.destroy()
    return Promise.resolve()
  }



  onzoneput(req: any) {
    if (!req.target || !req.token || !req.value) return;

    const p = decode(m.zonePutRequest, req.value);
    if (!p) return;

    const {seq, value, signature, proof} = p;
    if (!value) return;

    const msg = c.encode(m.zoneSignable, {seq, value});
    let receipt: Receipt | null = null;
    let publicKey : Uint8Array | undefined;
    try {
      // Validate the proof first.
      receipt = this.veritas.verifyPut(req.target, msg, signature, proof);
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
      const existing = c.decode(m.zoneGetResponse, local);
      const identical = existing.value && b4a.compare(value, existing.value) === 0;
      const existingProofSeq = this.veritas.getProofSeq(existing.root);

      // Prevent reuse of a sequence when the value has changed.
      if (existing.value && !identical && existing.seq === seq) {
        req.error(ERROR.SEQ_REUSED);
        return;
      }
      // New updates must have a higher sequence.
      if (seq < existing.seq) {
        req.error(ERROR.SEQ_TOO_LOW);
        return;
      }

      const pubkey_changed = b4a.compare(publicKey , existing.publicKey) !== 0;
      if (pubkey_changed) {
        // We only require that the new proof is higher than the stored proof.
        if (existingProofSeq && receipt.proofSeq <= existingProofSeq) {
          req.error(ERROR.STALE_PROOF);
          return;
        }
      } else {
        // Pubkeys still the same, we prefer older but non-stale proofs
        if (existingProofSeq && receipt.proofSeq !== existingProofSeq) {
          // If the submitted proof is stale and older than the stored proof, reject it.
          // Note: this still allows older proofs to take priority over recent ones as long
          // as they're not stale.
          if (this.veritas.isStale(receipt.proofSeq) && receipt.proofSeq < existingProofSeq) {
            req.error(ERROR.STALE_PROOF);
            return;
          }
          // If the stored proof is still valid (non-stale) and the new proof is more recent,
          // we reject the new proof since the value (and pubkey) hasn't changed.
          //
          // This ensures:
          // 1. Clients with older trust anchors can continue to validate.
          // 2. Someone can't publish very recent proofs for spaces they don't own to block older clients.
          if (!this.veritas.isStale(existingProofSeq) && receipt.proofSeq > existingProofSeq) {
            req.error(ERROR.NON_STALE_ANCESTOR_EXISTS);
            return;
          }
        }
      }
    }

    console.log(`zonePut: storing ${req.target.toString('hex')}`);
    this._zones?.set(k, c.encode(m.zoneGetResponse, {
      seq,
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

    let seq = 0;
    try {
      seq = c.decode(c.uint, req.value);
    } catch {
      return;
    }

    const k = b4a.toString(req.target, 'hex');
    const value = this._zones?.get(k);

    if (!value) {
      req.reply(null);
      return;
    }

    const localSeq = c.decode(c.uint, value);
    req.reply(localSeq < seq ? null : value);
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
    default:
      return super.onrequest(req);
    }
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
    const {seq, value, signature, proof} = c.decode(m.zoneGetResponse, node.value);

    return {
      token: node.token,
      from: node.from,
      to: node.to,
      seq,
      value,
      signature,
      proof
    };
  } catch {
    return null;
  }
}
