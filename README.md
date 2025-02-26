


| <img src="./logo.png" width="340"/> | <h1 align="left">Fabric</h1> <p align="left">Fabric is a trustless, distributed DNS resolver for [spaces](https://spacesprotocol.org), enabling spaces to publish Bitcoin-signed zone files on a permissionless DHT without storing anything on-chain!</p><br /> |
|-------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|


Fabric is a trustless, distributed DNS resolver built on top of [hyperdht](https://github.com/holepunchto/hyperdht). It lets you publish signed DNS zone files for [spaces](https://spacesprotocol.org)—sovereign Bitcoin identities—off-chain, without adding on-chain bloat.


## Installation


```shell
npm install -g @spacesprotocol/fabric
```


## Querying Spaces with beam


The `beam` tool is your distributed `dig` and publisher.

```
beam @buffrr TXT
```

By default, `beam` loads trust anchors from `http://127.0.0.1:7225/root-anchors.json` to verify responses (assuming a [spaces](https://github.com/spacesprotocol/spaces) client is running & connected to Bitcoin core). You can override this with:

- A local anchors file: `--local-anchors /path/to/root-anchors.json`
- A remote anchors URL: `--remote-anchors https://example.com/root-anchors.json`
  (or by setting `FABRIC_REMOTE_ANCHORS` environment variable)


## Publishing Records for a Space

1. **Create a DNS zone file** (e.g., `example.zone`):

       @example. 3600 CLASS2 SOA . . ( 1 3600 600 604800 3600 )
       @example. 3600 CLASS2 A   127.0.0.1
       @example. 3600 CLASS2 TXT "hello world"

2. **Sign the zone file** with `space-cli`:

       space-cli signzone example.zone

   This produces `example.packet.json`.

3. **Publish the packet** with beam:

       beam publish example.packet.json

The network retains records for up to 48 hours. To refresh, run:

       space-cli refreshpacket example.packet.json
       beam publish example.packet.json

You can also distribute the signed packet (`example.packet.json`) to a Fabric service operator for continuous publication.

## Running a Fabric Node

To contribute to the network, run a Fabric node by specifying a reachable IP and port:

    fabric --host <ip-address> --port <public-port>

After about 30 minutes of uptime, your node becomes persistent.

## Contributing Bootstrap Nodes

We welcome more bootstrap nodes. To contribute:

1. Run a node with a reachable IP/port using the `--bootstrap` flag:

       fabric --host <ip-address> --port <port> --bootstrap

2. Submit a pull request updating `constants.js` with your node’s details.

## Encrypted Noise Connections

Basic support for encrypted connections over named spaces is available. Use `beam serve` and `beam connect`—follow the CLI instructions.

## Contributing

Contributions are welcome! Please submit issues, feature requests, or pull requests to help improve Fabric.

## License

This project is licensed under the Apache 2.0 License. See the LICENSE file for details.