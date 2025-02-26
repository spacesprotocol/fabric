declare module 'hypercore-crypto' {
    import { Buffer } from 'buffer';

    // Define the key pair object
    export interface KeyPair {
        publicKey: Buffer;
        secretKey: Buffer;
    }
    
    // Generates a key pair, optionally seeded
    export function keyPair(seed?: Buffer): KeyPair;

    // Validates a key pair by checking the public key derived from the secret key
    export function validateKeyPair(keyPair: KeyPair): boolean;

    // Signs a message with the secret key
    export function sign(message: Buffer, secretKey: Buffer): Buffer;

    // Verifies the signature of a message
    export function verify(message: Buffer, signature: Buffer, publicKey: Buffer): boolean;

    // Generates a cryptographic hash of data
    export function data(data: Buffer): Buffer;

    // Generates a parent hash from two child nodes in a Merkle tree
    export function parent(a: MerkleNode, b: MerkleNode): Buffer;

    // Generates a root hash for a tree of Merkle roots
    export function tree(roots: MerkleNode[], out?: Buffer): Buffer;

    // Generic hash function, hashing arbitrary data
    export function hash(data: Buffer | Buffer[], out?: Buffer): Buffer;

    // Generates a secure random buffer of a given size
    export function randomBytes(size: number): Buffer;

    // Generates a discovery key from a public key
    export function discoveryKey(publicKey: Buffer): Buffer;

    // Frees a secure buffer if sodium supports freeing memory
    export function free(secureBuf: Buffer): void;

    // Creates a namespace based on a name and a count of elements
    export function namespace(name: string | Buffer, count: number | number[]): Buffer[];

    // Merkle Node interface for parent and tree hashing
    export interface MerkleNode {
        index: number;
        size: number;
        hash: Buffer;
    }
}

