import c from 'compact-encoding';

export interface ZoneSignable {
  seq: number;
  value: Uint8Array | null;
}

export interface ZonePutRequest {
  seq: number;
  value: Uint8Array | null;
  signature: Uint8Array;
}

export interface ZoneGetResponse {
  seq: number;
  value: Uint8Array | null;
  signature: Uint8Array;
}

// ZoneSignable encoding/decoding structure
export const zoneSignable = {
  preencode(state: any, m: ZoneSignable): void {
    c.uint.preencode(state, m.seq);
    c.buffer.preencode(state, m.value);
  },
  encode(state: any, m: ZoneSignable): void {
    c.uint.encode(state, m.seq);
    c.buffer.encode(state, m.value);
  },
  decode(state: any): ZoneSignable {
    return {
      seq: c.uint.decode(state),
      value: c.buffer.decode(state),
    };
  },
};

// ZonePutRequest encoding/decoding structure
export const zonePutRequest = {
  preencode(state: any, m: ZonePutRequest): void {
    c.uint.preencode(state, m.seq);
    c.buffer.preencode(state, m.value);
    c.fixed64.preencode(state, m.signature);
  },
  encode(state: any, m: ZonePutRequest): void {
    c.uint.encode(state, m.seq);
    c.buffer.encode(state, m.value);
    c.fixed64.encode(state, m.signature);
  },
  decode(state: any): ZonePutRequest {
    return {
      seq: c.uint.decode(state),
      value: c.buffer.decode(state),
      signature: c.fixed64.decode(state),
    };
  },
};

// ZoneGetResponse encoding/decoding structure
export const zoneGetResponse = {
  preencode(state: any, m: ZoneGetResponse): void {
    c.uint.preencode(state, m.seq);
    c.buffer.preencode(state, m.value);
    c.fixed64.preencode(state, m.signature);
  },
  encode(state: any, m: ZoneGetResponse): void {
    c.uint.encode(state, m.seq);
    c.buffer.encode(state, m.value);
    c.fixed64.encode(state, m.signature);
  },
  decode(state: any): ZoneGetResponse {
    return {
      seq: c.uint.decode(state),
      value: c.buffer.decode(state),
      signature: c.fixed64.decode(state),
    };
  },
};
