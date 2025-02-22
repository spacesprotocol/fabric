declare module 'dht-rpc' {
    import EventEmitter from 'node:events';

    export interface DHTOptions {
        bootstrap?: (string | Node)[];
        udx?: any; // UDX native binding
        concurrency?: number;
        filterNode?: (node: Node) => boolean;
        ephemeral?: boolean;
        adaptive?: boolean;
        quickFirewall?: boolean;
        port?: number;
        anyPort?: boolean,
        host?: string;
        nodes?: Node[];
    }

    export interface Node {
        host: string;
        port: number;
        id?: Buffer;
    }

    export interface QueryOptions {
        concurrency?: number;
        map?: (m: any) => any;
        maxSlow?: number;
        commit?: boolean | ((reply: any, dht: any, query: Query) => Promise<any>);
        session?: any;
        nodes?: Array<{ id?: Buffer; host: string; port: number }>;
        closestNodes?: Array<{ id?: Buffer; host: string; port: number }>;
        replies?: Array<{ from: { id: Buffer; host: string; port: number } }>;
        closestReplies?: Array<{ from: { id: Buffer; host: string; port: number } }>;
        onlyClosestNodes?: boolean;
    }


    export interface RequestOptions {
        token?: Buffer | Uint8Array | null;
        command: number;
        target?: Buffer | Uint8Array | null;
        value?: Buffer | Uint8Array | null;
    }

    export class Query {
      constructor(
            dht: DHT,
            target: Buffer | Uint8Array,
            findClosest: boolean,
            command: number,
            value: Buffer | Uint8Array | null,
            opts?: QueryOptions
        );

      get closestNodes(): Array<Node>;
      finished(): Promise<void>;
      destroy(error?: Error): void;

      [Symbol.asyncIterator]();

      on(event: 'data', listener: (data: any) => void): this;
      on(event: 'error', listener: (error: Error) => void): this;

      finished(): Promise<void>;
    }

    export class DHT extends EventEmitter {
      constructor(opts?: DHTOptions);

      static bootstrapper(port: number, host: string, opts?: DHTOptions): DHT;

      id: Buffer | null;
      online: boolean;
      bootstrapped: boolean;
      firewalled: boolean;
      destroyed: boolean;
      stats: Record<string, any>;

      address(): Address;

      localAddress(): Address | null;

      remoteAddress(): Address | null;

      bind(): Promise<void>;

      destroy(): Promise<void>;

      suspend(): Promise<void>;

      resume(): Promise<void>;

      findNode(target: Buffer | Uint8Array | null, opts?: QueryOptions): Query;

      query(request: { target: Buffer | Uint8Array | null; command: number; value?: Buffer | Uint8Array | null }, opts?: QueryOptions): Query;

      request(opts: RequestOptions, from: Node, opts?: any): Promise<any>;

      onrequest(req: any) : boolean;

      ping(node: Node, opts?: { size?: number; session?: any; ttl?: number }): Promise<any>;

      addNode(node: Node): void;

      toArray(opts?: { limit?: number }): Node[];

      session(): Session;

      ready(): Promise<void>;

      fullyBootstrapped(): Promise<void>;

      static OK: number;
      static ERROR_UNKNOWN_COMMAND: number;
      static ERROR_INVALID_TOKEN: number;
    }

    export interface Address {
        host: string;
        port: number;
    }

    export class Session {
      constructor(dht: DHT);
    }
}

