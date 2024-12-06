import * as bitcoin from 'bitcoinjs-lib';
import * as ecc from 'tiny-secp256k1';
import {BIP32Factory, BIP32Interface} from 'bip32';
import {bech32m} from 'bech32';

bitcoin.initEccLib(ecc);
const prefix = "200'";
const bip32 = BIP32Factory(ecc);

interface TweakedKeyPair {
    privateKey: Buffer;
    publicKey: Buffer;
}

// Finds the tweaked private key from an extended private key matching a given address
export function findTweakedPair(xprv: string, derivedAddress: string): TweakedKeyPair | null {
   const network = xprv.startsWith('tprv') ? bitcoin.networks.testnet : bitcoin.networks.bitcoin;
   const path = `86'/0'/0'/0/*`;
   
   const rootNode: BIP32Interface = bip32.fromBase58(xprv, network);
   const pathComponents = path.split('/').filter(component => component !== '*');
   const baseNode: BIP32Interface = pathComponents.reduce((acc: BIP32Interface, component: string) => {
   const isHardened = component.endsWith('\'');
   const index = parseInt(component, 10);

   return isHardened ? acc.deriveHardened(index) : acc.derive(index);
   }, rootNode);

   const MAX_DERIVATIONS = 1000;
   for (let i = 0; i < MAX_DERIVATIONS; i++) {
       const child = baseNode.derive(i);
       const pubkey = child.publicKey.slice(1, 33);
       const {address} = bitcoin.payments.p2tr({
           internalPubkey: pubkey,  
           network,
       });
       if (!address) continue;
        const tweakHash = bitcoin.crypto.taggedHash('TapTweak', pubkey);
      	const tweakedPriv = child.tweak(tweakHash) as BIP32Interface;

        if (address === derivedAddress || spaceAddress(address) === derivedAddress) {
    	    return {
                privateKey: tweakedPriv.privateKey!,
                publicKey: tweakedPriv.publicKey!.slice(1),
            };
        }
    }

    return null;
}

// Converts ScriptPubKey to an address
export function scriptPubKeyToAddress(scriptPubKey: string, network: string = 'mainnet'): string {
    if (!scriptPubKey.startsWith('5120') || scriptPubKey.length !== 68) {
        throw new Error('Invalid P2TR ScriptPubKey');
    }

    const pubkeyHex = scriptPubKey.slice(4);
    const pubkeyBytes = Buffer.from(pubkeyHex, 'hex');

    const hrp = network === 'mainnet' ? 'bcs' : 'tbs';
    const pubkeyBits = bech32m.toWords(pubkeyBytes);
    return bech32m.encode(hrp, [1].concat(pubkeyBits));
}

// Adjusts address prefix for the space network
function spaceAddress(address: string): string {
    const decoded = bech32m.decode(address);
    // Handle bc -> bcs for spaces
    if (decoded.prefix === 'bc') {
        return bech32m.encode('bcs', decoded.words);
    }
    return address;
}

// Schnorr signing
export function sign(digest: Buffer | Uint8Array, privateKey: Buffer): Buffer {
    return Buffer.from(ecc.signSchnorr(digest, privateKey));
}

// Schnorr verification
export function verify(digest: Buffer | Uint8Array, publicKey: Buffer, signature: Buffer): boolean {
    return ecc.verifySchnorr(digest, publicKey, signature);
}

