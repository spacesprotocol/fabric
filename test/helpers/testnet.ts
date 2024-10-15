import { Fabric } from '../../index';
import { Spaces } from '../../spaces';

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
  const spaceHashes: Record<string, string> = {
    '567cbb189afb9514650149eca3ba063eb6736021cac684734cf2e357bae56676': '@example',
    '1b80f8ef1b9f805982ced81b758ea53f94c82402bdb4ebb39d99b363732d0774': '@test',
    '2cd454a0ff910a2f0ba0f3e8c5fe3183bb835da83ef6e02aec058166c654b594': '@local'
  };

  const spaces = new Spaces();
  // @ts-ignore
  spaces.resolver.call_rpc = async (method: string, params: string[]) => {
    if (method !== 'getspace') throw new Error('Unknown method');
    if (!spaceHashes[params[0]]) {
      throw new Error('No such space');
    }

    return {
      outpoint: '7d4f115ddc587be2e4f9d9add3826645672e0c92244964ee05633c0245af353d:1',
      value: 662,
      script_pubkey: '512052e7deb0abaed6d894c936c50ca30aed0d523836c8ba1fc8db8001785900bf1a',
      name: spaceHashes[params[0]],
      covenant: {
        type: 'transfer',
        expire_height: 100684,
        data: null
      }
    };
  };

  // @ts-ignore
  spaces.dummyHashes = {};
  for (const [key, value] of Object.entries(spaceHashes)) {
    // @ts-ignore
    spaces.dummyHashes[value] = key;
  }
  // @ts-ignore
  spaces.dummyDesc = 'tr(tprv8ZgxMBicQKsPeUUxV746bQ9JmsytoSEeioAd8L962bQxcq7PfK8vRbFkSR7JD7ySoBoyswHX5vQvnhS95dHKUxW2maG2Tt7bJcCHsY66gNF/200\'/86\'/1\'/0\'/0/*)';

  if (size === 0) return new Testnet(swarm);

  const first = new Fabric({
    spaces,
    ephemeral: false,
    // @ts-ignore
    firewalled: false,
    bootstrap,
    port
  });

  await first.ready();

  if (bootstrap.length === 0) bootstrap.push({ host, port: first.address().port });

  swarm.push(first);

  while (swarm.length < size) {
    const node = new Fabric({
      spaces,
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
  teardown(() => testnet.destroy(), { order: Infinity });

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

function noop(): void {}
