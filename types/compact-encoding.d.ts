declare module 'compact-encoding' {
    interface State {
        start: number;
        end: number;
        buffer: Uint8Array | null;
        cache: any;
    }

    export function state(start?: number, end?: number, buffer?: Uint8Array | null): State;

    // Uint types
    export const uint: Encoding<number>;
    export const uint8: Encoding<number>;
    export const uint16: Encoding<number>;
    export const uint24: Encoding<number>;
    export const uint32: Encoding<number>;
    export const uint40: Encoding<number>;
    export const uint48: Encoding<number>;
    export const uint56: Encoding<number>;
    export const uint64: Encoding<number>;

    // Int types (zigzag encoded)
    export const int: Encoding<number>;
    export const int8: Encoding<number>;
    export const int16: Encoding<number>;
    export const int24: Encoding<number>;
    export const int32: Encoding<number>;
    export const int40: Encoding<number>;
    export const int48: Encoding<number>;
    export const int56: Encoding<number>;
    export const int64: Encoding<number>;

    // BigInt encodings
    export const biguint64: Encoding<bigint>;
    export const bigint64: Encoding<bigint>;
    export const biguint: Encoding<bigint>;
    export const bigint: Encoding<bigint>;

    // Float encodings
    export const float32: Encoding<number>;
    export const float64: Encoding<number>;

    // Other encodings
    export const buffer: Encoding<Uint8Array | null>;
    export const binary: Encoding<Uint8Array | string>;
    export const arraybuffer: Encoding<ArrayBuffer>;
    export const bool: Encoding<boolean>;
    export const fixed32: Encoding<Uint8Array>;
    export const fixed64: Encoding<Uint8Array>;
    export const none: Encoding<null>;
    export const json: Encoding<any>;
    export const ndjson: Encoding<any>;

    // Typed arrays
    export const uint8array: Encoding<Uint8Array>;
    export const uint16array: Encoding<Uint16Array>;
    export const uint32array: Encoding<Uint32Array>;
    export const int8array: Encoding<Int8Array>;
    export const int16array: Encoding<Int16Array>;
    export const int32array: Encoding<Int32Array>;
    export const biguint64array: Encoding<BigUint64Array>;
    export const bigint64array: Encoding<BigInt64Array>;
    export const float32array: Encoding<Float32Array>;
    export const float64array: Encoding<Float64Array>;

    // String encodings
    export const utf8: Encoding<string>;
    export const ascii: Encoding<string>;
    export const hex: Encoding<string>;
    export const base64: Encoding<string>;
    export const utf16le: Encoding<string>;
    export const ucs2: Encoding<string>;

    // Frame encoding
    export function frame<T>(enc: Encoding<T>): Encoding<T>;

    // Array encoding
    export function array<T>(enc: Encoding<T>): Encoding<T[]>;

    // Utility methods
    export function encode<T>(enc: Encoding<T>, value: T): Uint8Array;
    export function decode<T>(enc: Encoding<T>, buffer: Uint8Array): T;

    // "any" encoding (for dynamic structures)
    export const any: Encoding<any>;

    // Encoding interface
    export interface Encoding<T> {
        preencode(state: State, value: T): void;
        encode(state: State, value: T): void;
        decode(state: State): T;
    }
}