// hyperdht.d.ts
import {DHT, DHTOptions, Query, Node} from 'dht-rpc';
import EventEmitter from 'node:events';
import {Duplex} from 'streamx';

declare module 'hyperdht' {
    export interface HyperDHTOptions extends DHTOptions {
        keyPair?: KeyPair;
        seed?: Buffer;
        connectionKeepAlive?: number | boolean;
    }

    export interface MutableGetResult {
        token: Buffer;
        from: Node;
        to: Node;
        seq: number;
        value: Buffer;
        signature: Buffer;
    }

    export interface ImmutableGetResult {
        token: Buffer;
        from: Node;
        to: Node;
        value: Buffer;
    }


    export default class HyperDHT extends DHT {
      public tracer: any;
      public listening: Set<any>;
      public stats: Record<string, any>;

      constructor(opts?: HyperDHTOptions);

      connect(remotePublicKey: Buffer | string, opts?: any): NoiseSecretStream;

      createServer(opts?: any, onconnection?: (socket: any) => void): Server;

      pool(): any;

      resume(): Promise<void>;

      suspend(): Promise<void>;

      destroy(opts?: { force?: boolean }): Promise<void>;

      validateLocalAddresses(addresses: Address[]): Promise<Address[]>;

      findPeer(publicKey: Buffer, opts?: any): Query;

      lookup(target: Buffer, opts?: any): Query;

      lookupAndUnannounce(target: Buffer, keyPair: KeyPair, opts?: any): Query;

      unannounce(target: Buffer, keyPair: KeyPair, opts?: any): Promise<any>;

      announce(target: Buffer, keyPair: KeyPair, relayAddresses?: Address[], opts?: any): Query;

      immutableGet(target: Buffer, opts?: any): Promise<ImmutableGetResult | null>;

      immutablePut(value: Buffer, opts?: any): Promise<{ hash: Buffer; closestNodes: Node[] }>;

      mutableGet(publicKey: Buffer, opts?: any): Promise<MutableGetResult | null>;

      mutablePut(keyPair: KeyPair, value: Buffer, opts?: any): Promise<{
            publicKey: Buffer;
            closestNodes: Node[];
            seq: number;
            signature: Buffer
        }>;

      createRawStream(opts?: any): any;

      static keyPair(seed?: Buffer): KeyPair;

      static hash(data: Buffer): Buffer;

      static connectRawStream(encryptedStream: any, rawStream: any, remoteId: any): void;

      static BOOTSTRAP: string[];
      static FIREWALL: any;
    }

    export class Server extends EventEmitter {
      constructor(dht: HyperDHT, opts?: any);

      on(event: 'connection', listener: (socket: any) => void): this;

      close(): Promise<void>;

      refresh(): void;

      notifyOnline(): void;

      resume(): Promise<void>;

      suspend(): Promise<void>;

      listen(keypair): Promise<this>;
    }


    interface NoiseSecretStreamOptions {
        publicKey?: Uint8Array | null;
        remotePublicKey?: Uint8Array | null;
        keepAlive?: number;
        pattern?: string;
        autoStart?: boolean;
        data?: Uint8Array;
        ended?: boolean;
        handshake?: any;
        keyPair?: any;
    }

    interface NoiseSecretStreamJSON {
        isInitiator: boolean;
        publicKey: string | null;
        remotePublicKey: string | null;
        connected: boolean;
        destroying: boolean;
        destroyed: boolean;
        rawStream: any | null;
    }

    interface KeyPair {
        publicKey: Uint8Array;
        secretKey: Uint8Array;
    }

    export class NoiseSecretStream extends Duplex {
      public isInitiator: boolean;
      public publicKey: Uint8Array | null;
      public remotePublicKey: Uint8Array | null;
      public connected: boolean;
      public keepAlive: number;
      public timeout: number;
      public userData: any | null;
      public relay: any | null;
      public puncher: any | null;

      constructor(isInitiator: boolean, rawStream: any, opts?: NoiseSecretStreamOptions);

      public static keyPair(seed?: Uint8Array): KeyPair;

      public static id(handshakeHash: Uint8Array, isInitiator: boolean, id?: Uint8Array): Uint8Array;

      public setTimeout(ms: number): void;

      public setKeepAlive(ms: number): void;

      public sendKeepAlive(): void;

      public start(rawStream: any, opts?: NoiseSecretStreamOptions): void;

      public flush(): Promise<boolean>;

      public toJSON(): NoiseSecretStreamJSON;

      // Additional event listeners specific to NoiseSecretStream
      public on(event: 'data', listener: (chunk: Buffer) => void): this;
      public on(event: 'open', listener: () => void): this;
      public on(event: 'end', listener: () => void): this;
      public on(event: 'error', listener: (err: Error) => void): this;
      public on(event: 'close', listener: () => void): this;
      public on(event: 'connect', listener: () => void): this;
      public on(event: 'handshake', listener: () => void): this;

    }
}

