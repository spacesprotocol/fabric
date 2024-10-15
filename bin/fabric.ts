#!/usr/bin/env node

import {InvalidOptionArgumentError, program} from 'commander';
import { Fabric } from '../index';
import { defineMainOptions, spacesFromOpts, nodeOpts, joinHostPort } from './common';
import { ZoneWatcher } from '../zones';
import path from 'path';
import {DHT} from "dht-rpc";


defineMainOptions();

program
    .name('fabric')
    .option('--host <host>', 'Host to bind to')
    .option('--port <port>', 'Port to bind to')
    .option('--bootstrap', 'Start a bootstrap node')
    .option('--watch <directory>', 'Watch a directory for signed zone files to publish');

program.parse();

const opts = program.opts();

interface FabricOptions {
  bootstrap?: boolean;
  host?: string;
  port?: string;
  watch?: string;
}

async function main(opts: FabricOptions): Promise<void> {
  let node: Fabric | DHT;
  let watcher: ZoneWatcher | undefined;

  if (opts.bootstrap) {
    if (!opts.host) throw new InvalidOptionArgumentError('You need to specify a public --host <node ip> for the bootstrap node');
    if (!opts.port || isNaN(Number(opts.port))) throw new InvalidOptionArgumentError('You need to specify a valid --port <port> for the bootstrap node');

    const spaces = spacesFromOpts(opts);
    console.log('Starting Fabric bootstrap node...');
    node = Fabric.bootstrapper(Number(opts.port) || 0, opts.host, { spaces });
  } else {
    console.log('Starting Fabric node...');
    node = new Fabric(nodeOpts(opts));
  }

  try {
    // @ts-ignore
    const anchor = await node.spaces.checkAnchor()
    console.log(`Trust anchor chain is ${anchor.chain} configured at height ${anchor.tip.height} block ${anchor.tip.hash}`)
  } catch (e : any) {
    console.error(`Trust anchor check failed: ${e.message}`)
    node.destroy();
    if (watcher) await watcher.destroy();
    return;
  }

  if (opts.watch) {
    const directory = path.resolve(opts.watch);
    console.log(`Watching directory for zone files: ${directory}`);
    watcher = new ZoneWatcher(directory);

    watcher.on('updated', async ({ filename, payload }) => {
      if (!(node instanceof Fabric)) return
      await node.ready();
      try {
        await node.zonePutSigned(payload.target, payload.value, payload.signature, {
          seq: payload.seq,
        });
        console.log(`Published updated zone: ${filename} with serial=${payload.seq}`);
      } catch (e) {
        console.error(`Error publishing updated zone: ${filename}: ${(e as Error).message}`);
      }
    });
  }

  node.on('ephemeral', function () {
    console.log('Node is ephemeral', node.address());
  });

  node.on('persistent', function () {
    console.log('Node is persistent, joining remote routing tables');
  });

  node.on('close', function () {
    console.log('Node closed');
  });

  await node.ready();
  console.log(`Listening at ${joinHostPort(node.address())}`);

  process.once('SIGINT', function () {
    node.destroy();
    if (watcher) watcher.destroy();
  });
}

main(opts as FabricOptions).then(() => {}).catch((err: Error) => {
  console.error(err.message);
});

function splitHostPort(value: string): { host: string; port: number | null } {
  const hostPort = value.split(':');
  const host = hostPort[0];
  const port = hostPort.length === 1 ? null : parseInt(hostPort[1], 10);

  if (port !== null && isNaN(port)) {
    throw new InvalidOptionArgumentError('Expected a valid port number');
  }
  return { host, port };
}
