import { program } from 'commander';
import { FabricOptions } from '../index';
import { AnchorStore } from '../anchor';

export interface MainOptions {
    host?: string;
    seeds?: string[];
    peers?: string[];
    localAnchors?: string;
    remoteAnchors?: string[];
    port?: string;
}

interface Address {
    host?: string;
    port?: number;
}

export function defineMainOptions() {
  program
    .version('0.0.6')
    .option('--host <host>', 'The host to bind to')
    .option('--port <port>', 'The port to bind to')
    .option('--seeds <nodes...>', 'Connect to the following bootstrap nodes')
    .option('--peers <nodes...>', 'Include the following known peers')
    .option('--local-anchors <local>', 'Specify a local file to load anchors')
    .option('--remote-anchors <remote...>', 'Specify remote urls to load anchors');
}

export async function nodeOpts(opts: MainOptions): Promise<FabricOptions> {
  const host = opts.host || process.env.FABRIC_HOST;
  const port = opts.port || process.env.FABRIC_PORT;
  const seeds = opts.seeds || (process.env.FABRIC_SEEDS ? process.env.FABRIC_SEEDS.split(',') : undefined);

  return {
    host,
    port: Number(port) || 0,
    anyPort: !port,
    bootstrap: seeds,
    nodes: opts.peers
      ? opts.peers.map(p => {
        const hostPort = p.split(':');
        if (hostPort.length !== 2)
          throw new Error(`invalid peer ${p}, expected host:port format`);
        const port = parseInt(hostPort[1]);
        if (!port) throw new Error(`invalid port ${hostPort[1]} must be a number`);
        return {
          host: hostPort[0],
          port,
        };
      })
      : [],
    anchor: await anchorFromOpts(opts),
  };
}

export async function anchorFromOpts(opts: MainOptions): Promise<AnchorStore> {
  const localAnchors = opts.localAnchors || process.env.FABRIC_LOCAL_ANCHORS;
  const remoteAnchors =
        opts.remoteAnchors ||
        (process.env.FABRIC_REMOTE_ANCHORS
          ? process.env.FABRIC_REMOTE_ANCHORS.split(',')
          : ['http://127.0.0.1:7225/root-anchors.json']);

  return AnchorStore.create({
    localPath: localAnchors,
    remoteUrls: remoteAnchors,
  });
}

export function joinHostPort(address: Address | null): string {
  if (!address) return '--';
  return `${address?.host}:${address?.port}`;
}
