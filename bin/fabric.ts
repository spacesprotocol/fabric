#!/usr/bin/env node

import {InvalidOptionArgumentError, program} from 'commander';
import { Fabric } from '../index';
import { defineMainOptions, veritasFromOpts, nodeOpts, joinHostPort } from './common';
import {DHT} from 'dht-rpc';

defineMainOptions();

program
  .name('fabric')
  .option('--host <host>', 'Host to bind to')
  .option('--port <port>', 'Port to bind to')
  .option('--bootstrap', 'Start a bootstrap node');

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

  if (opts.bootstrap) {
    if (!opts.host) throw new InvalidOptionArgumentError('You need to specify a public --host <node ip> for the bootstrap node');
    if (!opts.port || isNaN(Number(opts.port))) throw new InvalidOptionArgumentError('You need to specify a valid --port <port> for the bootstrap node');

    console.log('Starting Fabric bootstrap node...');

    const veritas = await veritasFromOpts(opts);
    node = Fabric.bootstrapper(Number(opts.port) || 0, opts.host, { veritas });
  } else {
    console.log('Starting Fabric node...');
    node = new Fabric(await nodeOpts(opts));
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
  });
}

main(opts as FabricOptions).then(() => {

}).catch((err: Error) => {
  console.error(err.message);
});

