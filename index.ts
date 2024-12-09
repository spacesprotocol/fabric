
import HyperDHT, { HyperDHTOptions } from 'hyperdht';
import Cache, {MaxCacheOptions} from 'xache';
import c from 'compact-encoding';
import {BOOTSTRAP_NODES, COMMANDS} from './constants';
import b4a from 'b4a';
import {Spaces} from './spaces';
import * as m from './messages';
import {DHT} from "dht-rpc";
import { BootstrapNode, BootstrapNodes } from './types';

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
    UNKNOWN_SPACE: 201,
    INVALID_SIGNATURE: 202,
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
    [ERROR.UNKNOWN_SPACE]: 'unknown space',
    [ERROR.INVALID_SIGNATURE]: 'invalid signature',
};

export interface FabricOptions extends HyperDHTOptions {
    maxSize?: number;
    maxAge?: number;
    zones?: MaxCacheOptions;
    spaces?: Spaces;
}

export class Fabric extends HyperDHT {
    private _zones: Cache | null = null;
    public spaces: Spaces;

    constructor(opts: FabricOptions = {}) {
        const chain = (opts.spaces?.resolver?.chain || 'mainnet') as keyof BootstrapNodes;
        opts.bootstrap = opts.bootstrap || BOOTSTRAP_NODES[chain].map((n: BootstrapNode) => `${n.host}:${n.port}`); 
        super(opts);
        this.once('persistent', () => {
            this._zones = new Cache(opts.zones || {
                maxSize: opts.maxSize || defaultMaxSize,
                maxAge: opts.maxAge || defaultMaxAge,
            });
        });

        this.spaces = opts.spaces || new Spaces();
    }

    static bootstrapper(port: number, host: string, opts?: FabricOptions): DHT {
        return super.bootstrapper(port, host, opts)
    }

    async zoneGet(target: Buffer, opts: any = {}) {
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
            const valid = await this.spaces.verify(target, msg, node.signature);
            if (!valid) continue;
            if (!latest) {
                result = node;
                break;
            }
            if (!result || node.seq > result.seq) result = node;
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

    async zonePutSigned(target: Buffer, value: Buffer, signature: Buffer, opts: any = {}) {
        const seq = opts.seq || 0;
        const signed = c.encode(m.zonePutRequest, {seq, value, signature});
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

    async zoneSign(target: Buffer, value: Buffer, xpriv: Buffer, opts: any = {}) {
        const seq = opts.seq || 0;
        const msg = c.encode(m.zoneSignable, {seq, value});
        const signature = await this.spaces.sign(target, Buffer.from(msg), xpriv);
        return {seq, value, msg, signature};
    }

    async zonePut(target: Buffer, value: Buffer, xpriv: Buffer, opts: any = {}) {
        const seq = opts.seq || 0;
        const msg = c.encode(m.zoneSignable, {seq, value});
        const signature = await this.spaces.sign(target, Buffer.from(msg), xpriv);
        return this.zonePutSigned(target, value, signature, opts);
    }

    onzoneput(req: any) {
        if (!req.target || !req.token || !req.value) return;

        const p = decode(m.zonePutRequest, req.value);
        if (!p) return;

        const {seq, value, signature} = p;
        if (!value) return;

        const msg = c.encode(m.zoneSignable, {seq, value});
        this.spaces.verify(req.target, msg, signature).then((verify) => {
            if (!verify) {
                req.error(ERROR.INVALID_SIGNATURE);
                return;
            }

            const k = b4a.toString(req.target, 'hex');
            const local = this._zones?.get(k);
            if (local) {
                const existing = c.decode(m.zoneGetResponse, local);
                if (existing.value && existing.seq === seq && b4a.compare(value, existing.value) !== 0) {
                    req.error(ERROR.SEQ_REUSED);
                    return;
                }
                if (seq < existing.seq) {
                    req.error(ERROR.SEQ_TOO_LOW);
                    return;
                }
            }

            console.log(`zonePut: storing ${req.target.toString('hex')}`);
            this._zones?.set(k, c.encode(m.zoneGetResponse, {seq, value, signature}));
            req.reply(null);
        }).catch((err) => {
            console.error(err);
        });
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
        const {seq, value, signature} = c.decode(m.zoneGetResponse, node.value);

        return {
            token: node.token,
            from: node.from,
            to: node.to,
            seq,
            value,
            signature,
        };
    } catch {
        return null;
    }
}

