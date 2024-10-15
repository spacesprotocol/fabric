import {program} from 'commander';
import {Spaces, ResolverOptions} from '../spaces';
import {FabricOptions} from "../index";

interface MainOptions {
    seeds?: string[];
    peers?: string[];
    chain?: string;
    spacesRpcUrl?: string;
    port?: string;
}

interface Address {
    host?: string;
    port?: number;
}

export function defineMainOptions() {
    program
        .version('0.1.0')
        .option('--seeds <nodes...>', 'Connect to the following bootstrap nodes')
        .option('--peers <nodes...>', 'Include the following known peers')
        .option('--chain <chain>', 'Bitcoin network', 'testnet4')
        .option('--spaces-rpc-url <url>', 'Specify a spaces rpc url (default based on chain)');
}

export function nodeOpts(opts: MainOptions): FabricOptions {
    return {
        port: Number(opts.port) || 0,
        anyPort: !opts.port,
        bootstrap: opts.seeds,
        nodes: opts.peers ? opts.peers.map(p => {
            const hostPort = p.split(':')
            if (hostPort.length != 2) throw new Error(`invalid peer ${p}, expected host:port format`);
            const port = parseInt(hostPort[1]);
            if (!port) throw new Error(`invalid port ${hostPort[1]} must be a number`)
            return {
                host: hostPort[0],
                port
            }
        }) : [],
        spaces: spacesFromOpts(opts)
    };
}

export function spacesFromOpts(opts: MainOptions): Spaces {
    const resolverOpts: ResolverOptions = {
        chain: opts.chain,
        rpcUrl: opts.spacesRpcUrl
    };
    return new Spaces({resolver: resolverOpts});
}

export function joinHostPort(address: Address): string {
    return `${address?.host}:${address?.port}`;
}
