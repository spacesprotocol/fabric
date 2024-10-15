import * as crypto from 'hypercore-crypto';

export const BOOTSTRAP_NODES = [
  '107.152.45.120@testnet4.fabric.buffrr.dev:22253',
]

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
