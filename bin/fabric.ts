#!/usr/bin/env node

import {InvalidOptionArgumentError, program} from 'commander';
import {Fabric, FabricOptions} from '../index';
import {defineMainOptions, MainOptions, nodeOpts, joinHostPort} from './common';
import {DHT} from 'dht-rpc';
import {log} from '../utils';

defineMainOptions();

program
  .name('fabric')
  .option('--bootstrap', 'Start a bootstrap node');

program.parse();

const opts = program.opts();

async function main(opts: FabricOptions): Promise<void> {
  let node: Fabric | DHT;
  const bootstrap = opts.bootstrap;
  opts = await nodeOpts(opts as MainOptions);

  if (bootstrap) {
    if (!opts.host) throw new InvalidOptionArgumentError('You need to specify a public --host <node ip> for the bootstrap node');
    if (!opts.port || isNaN(Number(opts.port))) throw new InvalidOptionArgumentError('You need to specify a valid --port <port> for the bootstrap node');

    log('Starting Fabric bootstrap node...');
    node = Fabric.bootstrapper(Number(opts.port) || 0, opts.host, opts);
  } else {
    log('Starting Fabric node...');
    if (typeof opts.port === 'number' && opts.port !== 0) {
      // @ts-ignore
      opts.firewalled = false;
    }
    node = new Fabric(opts);
  }

  node.on('ephemeral', function () {
    log('Node is ephemeral', node.address());
  });

  node.on('persistent', function () {
    log('Node is persistent, joining remote routing tables');
  });

  node.on('close', function () {
    log('Node closed');
  });

  await node.ready();
  log('Listening at:', joinHostPort(node.address()));

  process.once('SIGINT', function () {
    node.destroy();
  });
}

main(opts as FabricOptions).then(() => {

}).catch((err: Error) => {
  console.error(err.message);
});

