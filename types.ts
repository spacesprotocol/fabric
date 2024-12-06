export interface BootstrapNode {
  host: string;
  port: number;
}

export interface BootstrapNodes {
  mainnet: BootstrapNode[];
  testnet4: BootstrapNode[];
}
