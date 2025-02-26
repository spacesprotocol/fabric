import {Fabric} from '../../index';
import {VeritasSync} from '../../veritas';
import {staticAnchors} from './anchors';

interface TestnetOptions {
    teardown?: () => void;
    host?: string;
    port?: number;
    bootstrap?: any[];
}

export default async function createTestnet(size = 10, opts: TestnetOptions = {}): Promise<Testnet> {
  const swarm: Fabric[] = [];
  const teardown = typeof opts === 'function' ? opts : (opts.teardown ? opts.teardown.bind(opts) : noop);
  const host = opts.host || '127.0.0.1';
  const port = opts.port || 0;
  const bootstrap = opts.bootstrap ? [...opts.bootstrap] : [];

  if (size === 0) return new Testnet(swarm);

  const veritas = await VeritasSync.create({staticAnchors})

  const first = new Fabric({
    veritas: veritas,
    ephemeral: false,
    // @ts-ignore
    firewalled: false,
    bootstrap,
    port
  });

  await first.ready();

  if (bootstrap.length === 0) bootstrap.push({host, port: first.address().port});

  swarm.push(first);

  while (swarm.length < size) {
    const node = new Fabric({
      // @ts-ignore
      veritas: veritas,
      ephemeral: false,
      // @ts-ignore
      firewalled: false,
      bootstrap
    });

    await node.ready();
    swarm.push(node);
  }

  const testnet = new Testnet(swarm, bootstrap);

  // @ts-ignore
  teardown(() => testnet.destroy(), {order: Infinity});

  return testnet;
}

class Testnet {
  nodes: Fabric[];
  bootstrap: any[];

  constructor(nodes: Fabric[], bootstrap: any[] = []) {
    this.nodes = nodes;
    this.bootstrap = bootstrap;
  }

  createNode(opts: any = {}): Fabric {
    const node = new Fabric({
      ephemeral: true,
      bootstrap: this.bootstrap,
      ...opts
    });

    this.nodes.push(node);

    return node;
  }

  async destroy(): Promise<void> {
    for (const node of this.nodes) {
      for (const server of node.listening) await server.close();
    }

    for (let i = this.nodes.length - 1; i >= 0; i--) {
      await this.nodes[i].destroy();
    }
  }

  [Symbol.iterator](): Iterator<Fabric> {
    return this.nodes[Symbol.iterator]();
  }
}

function noop(): void {
}
