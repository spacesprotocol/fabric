import * as crypto from 'hypercore-crypto';
import { BootstrapNode, BootstrapNodes } from './types';

export const BOOTSTRAP_NODES = {
  mainnet: [
    { host: '44.209.201.250', port: 40357 }
  ],
  testnet4: [
    { host: '107.152.45.120', port: 22253 }
  ]
};

// Extend the existing COMMANDS from hyperdht/lib/constants
export const COMMANDS = {
  PEER_HANDSHAKE: 0,
  PEER_HOLEPUNCH: 1,
  FIND_PEER: 2,
  LOOKUP: 3,
  ANNOUNCE: 4,
  UNANNOUNCE: 5,
  MUTABLE_PUT: 6,
  MUTABLE_GET: 7,
  IMMUTABLE_PUT: 8,
  IMMUTABLE_GET: 9,
  ZONE_PUT: 20,
  ZONE_GET: 21
};

const [NS_ZONE_PUT] = crypto.namespace('hyperswarm/dht', [
  COMMANDS.ZONE_PUT
]);

export const NS = {
  ZONE_PUT: NS_ZONE_PUT
};
