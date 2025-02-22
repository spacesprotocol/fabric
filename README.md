


| <img src="./logo.png" width="340"/> | <h1 align="left">Fabric</h1> <p align="left">Fabric is a trustless, distributed DNS resolver for [spaces](https://spacesprotocol.org), enabling spaces to publish Bitcoin-signed zone files on a permissionless DHT without storing anything on-chain!</p><br /> |
|-------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|


Fabric is a trustless, distributed DNS resolver built on top of [hyperdht](https://github.com/holepunchto/hyperdht), extending its capabilities to allow publishing signed zone files using [spaces](https://spacesprotocol.org) as keys authenticated by Bitcoin. [Spaces](https://spacesprotocol.org) are sovereign Bitcoin identities and serve as a trust anchor, while Fabric DHT enables publishing records off-chain without adding any unnecessary on-chain bloat.


## Installation


```shell
npm install -g @spacesprotocol/fabric
```


## How to query spaces?

Use `beam` it's like a distributed `dig`!

```
beam @buffrr TXT  --remote-anchors http://127.0.0.1:7225/root-anchors.json
```

`--remote-anchors http://127.0.0.1:7225/root-anchors.json`: will load trust anchors file from your local spaces client connected to Bitcoin core.

You may also specify a local anchors file e.g. `--local-anchors /path/to/root-anchors.json`

## How to publish records for a space?

1. Create a DNS zone file (e.g., example.zone) with an SOA record and the records you want to publish:


```
@example. 3600 CLASS2  SOA  . . ( 1 3600 600 604800 3600 )
@example. 3600 CLASS2  A    127.0.0.1
@example. 3600 CLASS2  TXT "hello world"
```



2. Sign it with `space-cli`

```shell
space-cli signzone example.zone
```

It will create `example.packet.json` that you can publish!


3. Publish the file using `beam`:


```shell
beam publish example.packet.json
```

The network will keep it for up to 48 hours, then it will become stale and will be removed. 

To refresh, and re-publish it:

```shell
space-cli refreshpacket example.packet.json
beam publish example.packet.json
```


Alternatively, distribute the signed packet file (`example.packet.json`) to a Fabric service operator to continue to publish it for you. The packet is signed with your keys so you don't need to trust them!


## Running a Fabric node

Run a node to contribute to the network. Specify a reachable ip/port:

```
fabric --host <ip-address> --port <public-port> --remote-anchors http://127.0.0.1/root-anchors.json
```

or you could use `--local-anchors /path/to/root-anchors.json`. Fabric will continue to watch changes to this file.


After about 30 minutes of uptime, your node will become persistent and contribute to the network's storage.


## Contributing Bootstrap Nodes

**Note:** If you do not intened to submit a pull request you should ignore these instructions.

We could use more bootstrap nodes:

1. Run a node with a reachable IP/Port specifying `--bootstrap` option

```shell
fabric --host <ip-address> --port <port> --bootstrap --remote-anchors http://127.0.0.1/root-anchors.json
```

2. Create a pull request updating `constants.js` to include your bootstrap node.


## Encrypted Noise Connections

Basic support for encrypted connections over named spaces is available. Use `beam serve` and `beam connect` and follow the CLI instructions.

## Contributing
We welcome contributions to Fabric! Please feel free to submit issues, feature requests, or pull requests to help improve the project.

## License
This project is licensed under the Apache 2.0 License. See the LICENSE file for details.
