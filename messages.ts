import c from 'compact-encoding';

export interface ZoneSignable {
  serial: number;
  value: Uint8Array | null;
}

export interface ZonePutRequest {
  serial: number;
  value: Uint8Array | null;
  signature: Uint8Array;
  proof: Uint8Array |  null;
}

export interface ZoneRecord {
  serial: number;
  value: Uint8Array | null;
  signature: Uint8Array;
  root: Uint8Array;
  publicKey: Uint8Array;
  proof: Uint8Array | null;
}

export interface NostrPutRequest {
  value: Uint8Array | null;
  publicKey: Uint8Array;
  signature: Uint8Array;
}

export interface NostrRecord {
  createdAt: number;
  value: Uint8Array | null;
  publicKey: Uint8Array;
  signature: Uint8Array;
}

// ZoneSignable encoding/decoding structure
export const zoneSignable = {
  preencode(state: any, m: ZoneSignable): void {
    c.uint.preencode(state, m.serial);
    c.buffer.preencode(state, m.value);
  },
  encode(state: any, m: ZoneSignable): void {
    c.uint.encode(state, m.serial);
    c.buffer.encode(state, m.value);
  },
  decode(state: any): ZoneSignable {
    return {
      serial: c.uint.decode(state),
      value: c.buffer.decode(state),
    };
  },
};

// ZonePutRequest encoding/decoding structure
export const zonePutRequest = {
  preencode(state: any, m: ZonePutRequest): void {
    c.uint.preencode(state, m.serial);
    c.buffer.preencode(state, m.value);
    c.fixed64.preencode(state, m.signature);
    c.buffer.preencode(state, m.proof);
  },
  encode(state: any, m: ZonePutRequest): void {
    c.uint.encode(state, m.serial);
    c.buffer.encode(state, m.value);
    c.fixed64.encode(state, m.signature);
    c.buffer.encode(state, m.proof)
  },
  decode(state: any): ZonePutRequest {
    return {
      serial: c.uint.decode(state),
      value: c.buffer.decode(state),
      signature: c.fixed64.decode(state),
      proof: c.buffer.decode(state),
    };
  },
};

// ZoneRecord encoding/decoding structure
export const zoneRecord = {
  preencode(state: any, m: ZoneRecord): void {
    c.uint.preencode(state, m.serial);
    c.buffer.preencode(state, m.value);
    c.fixed64.preencode(state, m.signature);
    c.fixed32.preencode(state, m.root);
    c.fixed32.preencode(state, m.publicKey);
    c.buffer.preencode(state, m.proof);
  },
  encode(state: any, m: ZoneRecord): void {
    c.uint.encode(state, m.serial);
    c.buffer.encode(state, m.value);
    c.fixed64.encode(state, m.signature);
    c.fixed32.encode(state, m.root);
    c.fixed32.encode(state, m.publicKey);
    c.buffer.encode(state, m.proof);
  },
  decode(state: any): ZoneRecord {
    return {
      serial: c.uint.decode(state),
      value: c.buffer.decode(state),
      signature: c.fixed64.decode(state),
      root: c.fixed32.decode(state),
      publicKey: c.fixed32.decode(state),
      proof: c.buffer.decode(state),
    };
  },
};

// NostrPutRequest encoding/decoding structure
export const nostrPutRequest = {
  preencode(state: any, m: NostrPutRequest): void {
    c.buffer.preencode(state, m.value);
    c.fixed32.preencode(state, m.publicKey);
    c.fixed64.preencode(state, m.signature);
  },
  encode(state: any, m: NostrPutRequest): void {
    c.buffer.encode(state, m.value);
    c.fixed32.encode(state, m.publicKey);
    c.fixed64.encode(state, m.signature);
  },
  decode(state: any): NostrPutRequest {
    return {
      value: c.buffer.decode(state),
      publicKey: c.fixed32.decode(state),
      signature: c.fixed64.decode(state),
    };
  },
};

// NostrRecord encoding/decoding structure
export const nostrRecord = {
  preencode(state: any, m: NostrRecord): void {
    c.uint.preencode(state, m.createdAt);
    c.buffer.preencode(state, m.value);
    c.fixed32.preencode(state, m.publicKey);
    c.fixed64.preencode(state, m.signature);
  },
  encode(state: any, m: NostrRecord): void {
    c.uint.encode(state, m.createdAt);
    c.buffer.encode(state, m.value);
    c.fixed32.encode(state, m.publicKey);
    c.fixed64.encode(state, m.signature);
  },
  decode(state: any): NostrRecord {
    return {
      createdAt: c.uint.decode(state),
      value: c.buffer.decode(state),
      publicKey: c.fixed32.decode(state),
      signature: c.fixed64.decode(state),
    };
  },
};
