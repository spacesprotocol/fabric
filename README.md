


| <img src="./logo.png" width="340"/> | <h1 align="left">Fabric</h1> <p align="left">Fabric is a trustless, distributed DNS resolver for [spaces](https://spacesprotocol.org), enabling spaces to publish Bitcoin-signed zone files on a permissionless DHT without storing anything on-chain!</p><br /> |
|-------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|


Fabric is a trustless, distributed DNS resolver built on top of [hyperdht](https://github.com/holepunchto/hyperdht), extending its capabilities to allow publishing signed zone files using [spaces](https://spacesprotocol.org) as keys authenticated by Bitcoin. [Spaces](https://spacesprotocol.org) are sovereign Bitcoin identities and serve as a trust anchor, while Fabric DHT enables publishing records off-chain without adding any unnecessary on-chain bloat.

**Note:** Fabric currently defaults to Bitcoin testnet4 since spaces are not yet on Bitcoin mainnet.

## Prerequisites
To use `fabric` and `beam`, you need to:

- Run Bitcoin Core on testnet4
- Install and sync spaces 

You may use [this guide](https://docs.spacesprotocol.org/getting-started/installation) to set these up.

## Installation

After [setting up spaces](https://docs.spacesprotocol.org/getting-started/installation), install Fabric:

```shell
npm install -g @spacesprotocol/fabric
```


## How to query spaces?

Use `beam` it's like a distributed `dig`!

```
beam @onion TXT
```

Space @now also has TXT records published.

**Note**: `beam` will automatically connect to a locally run spaces node using its default port for `testnet4` to verify answers from the DHT.


## How to publish records for a Space?

1. Create a zone file (e.g., example.zone) with an SOA record and the records you want to publish:


```
@ORIGIN @example.

; YOU MUST INCREMENT ZONE SERIAL WITH EACH UPDATE
@    3600 CLASS2  SOA  . . ( 1 3600 600 604800 3600 )
@    3600 CLASS2  TXT "Hello spaces!"
```

2. Find the space's private key using `space-cli`

```shell
space-cli --chain testnet4 exportwallet | grep '"spaces_descriptor"' | sed -E 's/.*(tprv[^\/]*).*/\1/'
```

it should look something like this:

```
tprv8ZgxMBicQKsPeUUxV746bQ9JmsytoyEeioAd9b962bQxcq7PfK8vRbFkSR7JD7ySoBoyswHX5vQvnhS95dHKUxW2maG2Tt7bJcCHsY66gNF
```


3. Use `beam` to sign your zone file `example.zone`:


```shell
beam sign example.zone --private-key <private-key>
```

Distribute the signed zone file (`example.zone.signed`) to the network:

You can either:
- Place it in the `--watch` directory of a running Fabric node
- OR Share it with other Fabric node operators to have them keep it alive


## Running a Fabric node

Run a node if you want to publish your own zones and also contribute to the network. Specify a reachable ip/port:

**Note**: Fabric will automatically connect to a locally run spaces node using its default port for testnet4.

```
fabric --host <ip-address> --port <public-port>
```

Specify a directory to watch for publishing space zones:

```shell
fabirc --host <ip-address> --port <public-port> --watch /path/to/signed/zone/files/directory
```

After about 30 minutes of uptime, your node will become persistent and contribute to the network's storage.


## Contributing Bootstrap Nodes

**Note:** If you do not intened to submit a pull request you should ignore these instructions.

We could use more bootstrap nodes:

1. Run a node with a reachable IP/Port specifying `--bootstrap` option

```shell
fabric --host <ip-address> --port <port> --bootstrap
```

2. Create a pull request updating `constants.js` to include your bootstrap node.


## Encrypted Noise Connections

Basic support for encrypted connections over named spaces is available. Use `beam serve` and `beam connect` and follow the CLI instructions.

## Contributing
We welcome contributions to Fabric! Please feel free to submit issues, feature requests, or pull requests to help improve the project.

## License
This project is licensed under the Apache 2.0 License. See the LICENSE file for details.
