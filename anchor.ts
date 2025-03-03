import fs from 'fs';
import {Veritas, SLabel} from '@spacesprotocol/veritas';
import b4a from 'b4a';
import {EventRecord, CompactEvent, signableCompactEvent, TargetInfo} from './messages';
import {log} from './utils';

interface Anchor {
    root: string;
    block: {
        hash: string;
        height: number;
    };
}

interface UpdateOptions {
    localPath?: string;        // Local file
    remoteUrls?: string[];     // Remote endpoints to fetch anchor file
    staticAnchors?: Anchor[];  // Use the following static anchors
    checkIntervalMs?: number;  // Periodic refresh
}

export class AnchorStore {
  private veritas: Veritas;
  private trustPoints: Map<string, number>;
  private fileWatcher: fs.FSWatcher | null = null;
  private intervalId: NodeJS.Timeout | null = null;
  private destroyed = false;
  // A block height/version number where proofs below are considered stale
  private staleThreshold: number = 0;

  public static async create(options: UpdateOptions): Promise<AnchorStore> {
    const obj = new AnchorStore(options);
    if (!options.staticAnchors) {
      await obj.refreshAnchors(true);
    }
    return obj;
  }

  private constructor(private options: UpdateOptions) {
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
            log(`Error refreshing anchors on file change: ${err}`);
          });
        }
      });
    }

    if (!usingStaticAnchors) {
      const defaultCheckInterval = 10 * 60000;
      const interval = this.options.checkIntervalMs ?? defaultCheckInterval;
      this.intervalId = setInterval(() => {
        this.refreshAnchors().catch(err => {
          log(`Error during periodic refresh: ${err}`);
        });
      }, interval);
    }
  }

  public getTrustPoint(root: Uint8Array): number | undefined {
    return this.trustPoints.get(b4a.toString(root, 'hex'))
  }

  public verifySig(evt: CompactEvent): boolean {
    const digest = Veritas.sha256(signableCompactEvent(evt));
    return this.veritas.verifySchnorr(evt.pubkey, digest, evt.sig)
  }

  public verifyAnchor(evt: CompactEvent, targetInfo: TargetInfo, prev?: EventRecord) : EventRecord | undefined {
    try {
      return this.assertAnchored(evt, targetInfo, prev);
    } catch (e) {
      return undefined;
    }
  }

  public assertAnchored(evt: CompactEvent, targetInfo: TargetInfo, prev?: EventRecord): EventRecord {
    if (!targetInfo.space) throw new Error('Not a space anchored')
    if (evt.proof.length === 0) throw new Error('Proof needed')

    const proof = this.veritas.verifyProof(evt.proof);
    const space = new SLabel(targetInfo.space);
    const utxo = proof.findSpace(space);
    if (!utxo) throw new Error('No space utxo found in proof');
    const taproot_pubkey = utxo.getPublicKey();
    if (!taproot_pubkey) throw new Error('Expected a P2TR space utxo');
    if (b4a.compare(taproot_pubkey, evt.pubkey) !== 0) throw new Error('Anchored event must be signed with utxo pubkey');

    // Valid anchored event
    const a: EventRecord = {
      event: evt,
      root: proof.getRoot()
    };

    // If we have an existing one stored, we need to do other
    // checks to see which takes priority.
    if (!prev) return a;

    // local one might have become outdated/removed from anchors list
    const localPoint = this.getTrustPoint(prev.root);
    if (typeof localPoint !== 'number') return a;

    const evtPoint = this.getTrustPoint(a.root);
    if (typeof evtPoint !== 'number') throw new Error('point not in the anchors list');
    if (evtPoint === localPoint) return a;
      
    const pubkey_changed = b4a.compare(a.event.pubkey, prev.event.pubkey) !== 0;

    // Space was transferred, we only require that the new proof is higher than the stored proof.
    if (pubkey_changed) {
      if (evtPoint < localPoint) throw new Error('stale proof');
      return a;
    }

    // Pubkeys match, we prefer older but non-stale proofs (stale proofs are below staleThreshold)
    // If the submitted proof is stale and older than the stored proof, reject it.
    // Note: this still allows older proofs to take priority over recent ones as long
    // as they're not stale.
    if (this.isStale(evtPoint) && evtPoint < localPoint)  throw new Error('stale proof');

    // If the stored proof is still valid (non-stale) and the new proof is more recent,
    // we reject the new proof since the pubkey hasn't changed.
    //
    // This ensures:
    // 1. Clients with older trust anchors can continue to validate.
    // 2. Someone can't publish very recent proofs for spaces they don't own to block older clients.
    if (!this.isStale(localPoint) && evtPoint > localPoint) throw new Error('non-stale ancestor exists')
    return a
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
        log(`Failed to read or parse local anchors file: ${err}`);
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
        log(`${err}.` + (attempts < maxRetries ? ` Retrying in ${delayMs}ms...` : ''));
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
    return null;
  }

  private async fetchAnchorsFromRemotes(remoteUrls: string[]): Promise<Anchor[]> {
    const responses = await Promise.all(
      remoteUrls.map(async url => {
        log(`Fetching anchors from: ${url}`);
        try {
          const res = await fetch(url);
          if (!res.ok) {
            throw new Error(`Status: ${res.status}`);
          }
          return res.json();
        } catch (err) {
          log(`Error fetching ${url}: ${err}`);
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

    log(`Anchors refreshed, latest block ${anchors[0].block.height}`);
  }
}
