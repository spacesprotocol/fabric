export const BOOTSTRAP_NODES = [
  '107.152.45.120@fabric.buffrr.dev:22253',
  '100.28.101.97:22253',
  '44.208.222.14:22253',
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
  EVENT_PUT: 22,
  EVENT_GET: 24,
};

export const DNS_EVENT_KIND = 871222;
