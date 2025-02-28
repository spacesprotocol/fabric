import fs from 'fs';
import {Veritas, SpaceOut} from '@spacesprotocol/veritas';
import b4a from 'b4a';
import {nostrDTag, nostrTarget} from './utils';

interface Anchor {
    root: string;
    block: {
        hash: string;
        height: number;
    };
}

export interface Receipt {
    trustpoint: number,
    root: Uint8Array,
    spaceout: SpaceOut,
}

interface SyncOptions {
    localPath?: string;        // Local file
    remoteUrls?: string[];     // Optional remote endpoints to fetch anchor file
    staticAnchors?: Anchor[];   // Optional use the following static anchors instead
    checkIntervalMs?: number;  // Periodic refresh
}

export class VeritasSync {
  private veritas: Veritas;
  private trustPoints: Map<string, number>;
  private fileWatcher: fs.FSWatcher | null = null;
  private intervalId: NodeJS.Timeout | null = null;
  private destroyed = false; // Flag to stop retry loop

  // A block height/version number where proofs below are considered stale
  private staleThreshold: number = 0;

  public static async create(options: SyncOptions): Promise<VeritasSync> {
    const obj = new VeritasSync(options);
    if (!options.staticAnchors) {
      await obj.refreshAnchors(true);
    }
    return obj;
  }

  private constructor(private options: SyncOptions) {
    const usingLocal = !!options.localPath;
    const usingRemote = !!options.remoteUrls;
    const usingStaticAnchors = !!options.staticAnchors;

    if ([usingLocal, usingRemote, usingStaticAnchors].filter(Boolean).length != 1) {
      throw new Error('Must specify exactly one of local, remote, or static anchors.');
    }

    this.veritas = new Veritas();
    this.trustPoints = new Map();

    if (options.staticAnchors) {
      this.updateAnchors(options.staticAnchors);
    }

    if (usingLocal) {
      this.fileWatcher = fs.watch(this.options.localPath!, (eventType) => {
        if (eventType === 'change') {
          this.refreshAnchors().catch(err => {
            console.error(`Error refreshing anchors on file change: ${err}`);
          });
        }
      });
    }

    if (!usingStaticAnchors) {
      const defaultCheckInterval = 10 * 60000;
      const interval = this.options.checkIntervalMs ?? defaultCheckInterval;
      this.intervalId = setInterval(() => {
        this.refreshAnchors().catch(err => {
          console.error(`Error during periodic refresh: ${err}`);
        });
      }, interval);
    }
  }

  public getTrustPoint(root: Uint8Array): number | undefined {
    return this.trustPoints.get(b4a.toString(root, 'hex'))
  }

  public verifySchnorr(pubkey: Uint8Array, digest: Uint8Array, signature: Uint8Array): void {
    this.veritas.verifySchnorr(pubkey, digest, signature)
  }

  public sha256(data: Uint8Array): Uint8Array {
    return this.veritas.sha256(data)
  }

  public verifyNostr(target: Uint8Array, value: Uint8Array, publicKey: Uint8Array, signature: Uint8Array): number {
    const digest = this.veritas.sha256(value);

    // Throws on failure
    this.veritas.verifySchnorr(publicKey, digest, signature);

    let evt;
    try {
      const jsonString = new TextDecoder().decode(value);
      evt = JSON.parse(jsonString);
    } catch (e) {
      throw new Error('malformed event');
    }
    if (evt.length < 5) throw new Error('bad event: expected at least 5 items');

    const [version, evtPubkey, evtCreatedAt, evtKind, tags] = evt;
    const publicKeyHex = b4a.toString(publicKey, 'hex');
    if (version !== 0 || publicKeyHex !== evtPubkey || typeof evtCreatedAt !== 'number' || typeof evtKind !== 'number') {
      throw new Error('malformed event');
    }

    const isAddressable = this.isAddressableEvent(evtKind);
    if (!isAddressable && !this.isReplaceableEvent(evtKind)) {
      throw new Error('unsupported event');
    }

    // Extract 'd' tag for addressable events
    let d = '';
    if (isAddressable) {
      const dTag = nostrDTag(tags);
      if (!dTag || dTag == '') throw new Error('addressable event missing required "d" tag');
      d = dTag[1];
    }

    const targetString = nostrTarget(publicKeyHex, evtKind, d);
    const expectedTarget = this.veritas.sha256(b4a.from(targetString));
    if (b4a.compare(target, expectedTarget) !== 0) {
      throw new Error('unexpected target');
    }

    const now = Math.floor(Date.now() / 1000);
    const maxCreatedAt = now + 30 * 24 * 60 * 60; // 30 days in future
    if (evtCreatedAt > maxCreatedAt) {
      throw new Error('event too far in the future');
    }

    return evtCreatedAt;
  }

  public verifyZone(
    target: Uint8Array,
    msg: Uint8Array,
    signature: Uint8Array,
    proof: Uint8Array
  ): Receipt {
    const subtree = this.veritas.verifyProof(proof);
    const spaceout = subtree.findSpace(target);
    if (!spaceout) {
      throw new Error('No UTXO associated with target');
    }

    // Throws on failure
    this.veritas.verifyMessage(spaceout, msg, signature);
    const root = subtree.getRoot();
    const rootKey = b4a.toString(subtree.getRoot(), 'hex');
    const trustpoint = this.trustPoints.get(rootKey);
    if (!trustpoint) {
      throw new Error('Could not find proof version');
    }

    return {
      trustpoint,
      root,
      spaceout
    };
  }

  private isReplaceableEvent(evtKind: number): boolean {
    return evtKind === 0 || evtKind === 3 || (evtKind >= 10000 && evtKind < 20000);
  }

  private isAddressableEvent(evtKind: number): boolean {
    return evtKind >= 30000 && evtKind < 40000;
  }

  public destroy(): void {
    if (this.fileWatcher) {
      this.fileWatcher.close();
      this.fileWatcher = null;
    }
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.destroyed = true;
  }

  private async refreshAnchors(isInitial: boolean = false): Promise<void> {
    if (this.options.localPath) {
      try {
        const data = fs.readFileSync(this.options.localPath, 'utf8');
        const anchors: Anchor[] = JSON.parse(data);
        this.updateAnchors(anchors);
        return;
      } catch (err) {
        console.error(`Failed to read or parse local anchors file: ${err}`);
      }
    }

    if (!this.options.remoteUrls) {
      throw new Error('Expected either local or remote anchors option set');
    }

    const maxRetries = isInitial ? 1 : Infinity;
    const anchors = await this.tryFetchAnchors(maxRetries, 5000);
    if (isInitial && !anchors) {
      this.destroy();
      throw new Error('A valid anchors source is required');
    }

    if (anchors) {
      this.updateAnchors(anchors);
    }
  }

  private async tryFetchAnchors(maxRetries: number, delayMs: number): Promise<Anchor[] | null> {
    let attempts = 0;
    while (!this.destroyed && (maxRetries === Infinity || attempts < maxRetries)) {
      try {
        return await this.fetchAnchorsFromRemotes(this.options.remoteUrls!);
      } catch (err) {
        attempts++;
        console.error(`${err}.` + (attempts < maxRetries ? ` Retrying in ${delayMs}ms...` : ''));
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
    return null;
  }

  private async fetchAnchorsFromRemotes(remoteUrls: string[]): Promise<Anchor[]> {
    const responses = await Promise.all(
      remoteUrls.map(async url => {
        console.log(`Fetching anchors from: ${url}`);
        try {
          const res = await fetch(url);
          if (!res.ok) {
            throw new Error(`Status: ${res.status}`);
          }
          return res.json();
        } catch (err) {
          console.error(`Error fetching ${url}: ${err}`);
          return null;
        }
      })
    );

    const validResponses = responses.filter((res): res is Anchor[] => res !== null);
    if (validResponses.length === 0) {
      throw new Error('No valid remote anchors found');
    }

    const groups = new Map<string, { count: number; anchors: Anchor[] }>();
    for (const anchors of validResponses) {
      if (!anchors.length) continue;
      const key = anchors[0].root;
      const group = groups.get(key);
      if (!group) {
        groups.set(key, {count: 1, anchors});
      } else {
        group.count++;
      }
    }

    // Choose the group with the highest matches.
    // In case of a tie, pick the one whose first anchor has the highest block height.
    let chosen: { count: number; anchors: Anchor[] } | null = null;
    for (const group of groups.values()) {
      if (
        !chosen ||
                group.count > chosen.count ||
                (group.count === chosen.count &&
                    group.anchors[0].block.height > chosen.anchors[0].block.height)
      ) {
        chosen = group;
      }
    }
    if (!chosen) {
      throw new Error('No anchors selected');
    }
    return chosen.anchors;
  }

  public isStale(version: number): boolean {
    return version < this.staleThreshold;
  }

  private updateAnchors(anchors: Anchor[]) {
    this.veritas = new Veritas();
    this.trustPoints = new Map();

    if (anchors.length === 0) {
      return;
    }

    // Sort anchors descending by block height (most recent first)
    anchors.sort((a, b) => b.block.height - a.block.height);

    // Set stale threshold: if more than 8 anchors, the threshold is the block height of the 9th oldest.
    this.staleThreshold = anchors.length > 9 ? anchors[anchors.length - 9].block.height : 0;

    for (const anchor of anchors) {
      const root = Buffer.from(anchor.root, 'hex');
      this.veritas.addAnchor(root);
      this.trustPoints.set(anchor.root, anchor.block.height);
    }

    console.log(`Anchors refreshed, latest block ${anchors[0].block.height}`);
  }
}
