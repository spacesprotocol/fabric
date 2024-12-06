import http from 'http';
import * as schnorr from './schnorr';

let sodium: any;
sodium = require('sodium-universal');
import b4a from 'b4a';

export interface ResolverOptions {
    chain?: string;
    rpcUrl?: string;
}

export interface ChainInfo {
    chain: string;
    tip: {
        hash: string,
        height: number
    }
}

export interface SpacesOptions {
    resolver?: ResolverOptions;
}

interface SpaceInfo {
    address: string;
    publicKey: Buffer;
    script_pubkey: string;
}

export class Spaces {
    resolver: Resolver;

    constructor(opts: SpacesOptions = {}) {
        opts.resolver = opts.resolver || {};
        this.resolver = new Resolver(opts.resolver);
    }

    async checkAnchor() : Promise<ChainInfo> {
        const info = await this.resolver.getChainInfo();
        if (!info)  throw new Error(`Unable to connect to ${this.resolver.rpcUrl.toString()}`)

        if (info.chain !== this.resolver.chain)
            throw new Error(`Trust anchor chain '${info.chain}' != '${this.resolver.chain}' (configured chain)`)

        return info
    }

    async verify(spacehash: Buffer, message: Buffer | Uint8Array, signature: Buffer): Promise<boolean> {
        const info = await this.resolve(spacehash);
        if (!info) throw new Error('Space not found');

        const digest = b4a.allocUnsafe(32);
        sodium.crypto_generichash(digest, message);

        return schnorr.verify(digest, info.publicKey, signature);
    }

    async sign(spacehash: Buffer, message: Buffer, privateDescriptor: any): Promise<Buffer> {
        const info = await this.resolve(spacehash);
        if (!info) {
            throw new Error('Space not found');
        }

        const pair = schnorr.findTweakedPair(privateDescriptor, info.address);
        if (!pair) throw new Error('Cannot find corresponding key for the space - are you the owner?');
        const {privateKey, publicKey} = pair;
        const digest = b4a.allocUnsafe(32);
        sodium.crypto_generichash(digest, message);

        const signature = Buffer.from(schnorr.sign(digest, privateKey));
        if (!schnorr.verify(digest, publicKey, signature)) {
            throw new Error('Failed to verify signature after signing');
        }

        return signature;
    }

    async resolve(spaceHash: Buffer): Promise<SpaceInfo | null> {
        return this.resolver.resolve(spaceHash);
    }
}

export class Resolver {
    chain: string;
    rpcUrl: URL;

    constructor(opts: ResolverOptions = {}) {
        this.chain = opts.chain || 'mainnet';
        this.rpcUrl = new URL(opts.rpcUrl || `http://localhost:${this.default_rpc_port()}`);
    }

    async resolve(spaceHash: Buffer): Promise<SpaceInfo | null> {
        if (!Buffer.isBuffer(spaceHash) || spaceHash.length !== 32) {
            throw new Error('spaceHash must be a 32-byte Buffer');
        }

        const info = await this.call_rpc('getspace', [spaceHash.toString('hex').trim()]);
        if (!info) return null;

        info.address = schnorr.scriptPubKeyToAddress(info.script_pubkey, this.chain);
        info.publicKey = Buffer.from(info.script_pubkey.slice(4), 'hex');

        return info as SpaceInfo;
    }

    async getChainInfo(): Promise<ChainInfo | null> {
        const info = await this.call_rpc('getserverinfo', []);
        if (!info) return null;
        return info as ChainInfo
    }

    private call_rpc(method: string, params: any[]): Promise<any> {
        return new Promise((resolve, reject) => {
            const data = JSON.stringify({
                jsonrpc: '2.0',
                id: 1,
                method,
                params
            });

            const options = {
                hostname: this.rpcUrl.hostname,
                port: this.rpcUrl.port,
                path: this.rpcUrl.pathname,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': data.length
                }
            };

            const req = http.request(options, (res) => {
                let responseData = '';

                res.on('data', (chunk) => {
                    responseData += chunk;
                });

                res.on('end', () => {
                    if (res.statusCode !== 200) {
                        reject(new Error(`HTTP error! status: ${res.statusCode}`));
                        return;
                    }

                    try {
                        const parsedData = JSON.parse(responseData);
                        if (parsedData.error) {
                            reject(new Error(`RPC error: ${parsedData.error.message}`));
                        } else {
                            resolve(parsedData.result);
                        }
                    } catch (error) {
                        reject(new Error('Failed to parse JSON response'));
                    }
                });
            });

            req.on('error', (error) => {
                reject(error);
            });

            req.write(data);
            req.end();
        });
    }

    private default_rpc_port(): number {
        switch (this.chain) {
            case 'mainnet':
                return 7225;
            case 'testnet4':
                return 7224;
            case 'testnet':
                return 7223;
            case 'regtest':
                return 7218;
            default:
                throw new Error('Unknown chain');
        }
    }
}
