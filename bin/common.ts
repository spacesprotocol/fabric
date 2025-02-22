import {program} from 'commander';
import {FabricOptions} from '../index';
import {VeritasSync} from '../veritas';

interface MainOptions {
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
    .version('0.0.2')
    .option('--seeds <nodes...>', 'Connect to the following bootstrap nodes')
    .option('--peers <nodes...>', 'Include the following known peers')
    .option('--local-anchors <local>', 'Specify a local file to sync anchors')
    .option('--remote-anchors <remote...>', 'Specify remote urls to sync anchors');
}

export async function nodeOpts(opts: MainOptions): Promise<FabricOptions> {
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
    veritas: await veritasFromOpts(opts)
  };
}

export async function veritasFromOpts(opts: MainOptions): Promise<VeritasSync> {
  return VeritasSync.create({
    localPath: opts.localAnchors,
    remoteUrls: opts.remoteAnchors
  });
}

export function joinHostPort(address: Address): string {
  return `${address?.host}:${address?.port}`;
}
