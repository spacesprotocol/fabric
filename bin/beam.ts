#!/usr/bin/env node

import { program } from 'commander';
import { defineMainOptions, nodeOpts } from './common';
import fs from 'fs';
import { Fabric } from '../index';
import { parseZoneFile } from '../zones';
import dns, {Answer} from 'dns-packet';
import { resolve, basename } from 'node:path';
import b4a from 'b4a';
import {KeyPair} from "hypercore-crypto";

const beamTitle = '<<>> Beam 0.1 <<>>';


interface ResolveZoneResponse {
  zone: dns.Packet;
  space: string;
  closestNodes: any[];
  size: number;
  signature: Buffer;
  peer: any;
  qname?: string,
  qtypes?: string[];
  qtime: string;
  elapsed: number;
}

class Beam {
  fabric: Fabric;

  constructor(opts: any) {
    this.fabric = createFabric(opts);
  }

  async ready(): Promise<void> {
    await this.fabric.ready();
  }

  async connect(space: string, path: string): Promise<void> {
    try {
      const { zone } = await this.resolveZone(space, true);
      if (!zone.answers) throw new Error('Expected an answer section in the packet');
      const dnslink = zone.answers.find(a => a.type === 'TXT' && a.name === '_dnslink.' + space);
      // @ts-ignore
      let data = dnslink?.data.toString();
      const prefix = 'dnslink=/fabric/';
      if (!data || data.length !== prefix.length + 64 || !data.startsWith(prefix)) {
        console.error('Unsupported dnslink record:', data);
        return;
      }
      data = data.slice(prefix.length);

      const pubkey = Buffer.from(data, 'hex');
      const encryptedSocket = this.fabric.connect(pubkey);

      encryptedSocket.on('open', () => {
        console.log('; ENCRYPTED NOISE CONNECTION ESTABLISHED');
        console.log(`; GET ${path}`);
        encryptedSocket.write(`GET ${path} HTTP/1.1\r\n\r\n`);
      });

      encryptedSocket.on('error', (err: Error) => {
        console.log('; CONNECTION ERROR:', err);
      });

      encryptedSocket.on('close', () => {
        console.log('; CONNECTION TERMINATED');
        process.exit(0);
      });

      let head: Buffer | null = null;
      encryptedSocket.on('data', (data: Buffer) => {
        if (!head) {
          const idx = data.indexOf('\r\n\r\n');
          if (idx === -1) {
            console.error('; GOT MALFORMED RESPONSE');
            encryptedSocket.end();
            return;
          }

          head = data.slice(0, idx);
          data = data.slice(idx);

          const extractProto = () => {
            const idx = head!.indexOf('\r\n');
            if (idx === -1) return null;
            const [proto, statusCode, ...statusMessage] = head!.slice(0, idx).toString().split(' ');
            return { proto, statusCode, message: statusMessage.join(' ') };
          };

          const header = (key: string) => {
            const kIdx = head!.indexOf(`${key}:`);
            let vIdx = kIdx !== -1 ? head!.indexOf('\r\n', kIdx) : -1;
            return vIdx !== -1 ? head!.slice(head!.indexOf(':', kIdx) + 1, vIdx).toString().trim() : null;
          };

          const { proto, statusCode, message } = extractProto()!;
          if (!proto || proto !== 'HTTP/1.1') {
            console.error('; GOT MALFORMED RESPONSE');
            encryptedSocket.end();
            return;
          }
          if (statusCode !== '200') {
            console.error(`; GOT STATUS: ${statusCode} ${message}`);
            encryptedSocket.end();
            return;
          }
        }

        console.log(data.toString());
        encryptedSocket.end();
      });

      encryptedSocket.on('end', () => {
        encryptedSocket.end();
      });

    } catch (e) {
      console.error('; ERROR connecting: ', (e as Error).message);
    }
  }

  async serve(dir: string): Promise<any> {
    let keypair: KeyPair | null;
    dir = resolve(dir);
    console.log(`; ${beamTitle} serving dir=${dir}`);
    const first = !fs.existsSync('beam.keypair.json');

    if (first) {
      console.log('; No beam.keypair.json file found - creating one...');
      await this.keyGen();
    }

    try {
      const keypairJson = JSON.parse(fs.readFileSync('beam.keypair.json').toString());
      if (first) {
        console.log('; KEYPAIR PUBKEY:', keypairJson.publicKey);
        console.log('; Add this record to your zone file and publish it to the network:');
        console.log('_dnslink 300 CLASS2 TXT "dnslink=/fabric/' + keypairJson.publicKey + '"');
      }
      keypair = {
        publicKey: Buffer.from(keypairJson.publicKey, 'hex'),
        secretKey: Buffer.from(keypairJson.secretKey, 'hex')
      };
    } catch (e) {
      console.error('Failed to read beam.keypair.json file:', (e as Error).message);
      return;
    }

    const firewall = (pub: Buffer, remotePayload: any, addr: any): boolean => {
      return false;
    };

    const server = this.fabric.createServer({ firewall }, async (socket: any) => {
      const log = (level: string, message: string) => {
        console.log(`[${new Date().toISOString()} ${level} server] ${socket.rawStream?.remoteHost}:${socket.rawStream?.remotePort} ${message}`);
      };

      const info = (message: string) => log('INFO', message);
      const error = (message: string) => log('ERR', message);

      info('Connection established');
      try {
        socket.on('error', error);
        socket.on('data', (data: Buffer) => {
          const response = (status: string, body: string | Buffer): string => {
            info(`${status}`);
            return `HTTP/1.1 ${status}\r\nContent-Type: text/plain\r\nContent-Length: ${body.length}\r\n\r\n${body}`;
          };

          const request = data.toString();
          const [requestLine, ...headers] = request.split('\r\n');
          let [method, path, protocol] = requestLine.split(' ');
          info(`${method} ${path}`);
          if (protocol !== 'HTTP/1.1') {
            socket.write(response('400 Bad Request', ''));
            socket.end();
            return;
          }
          if (path === '') path = 'index.txt';
          path = basename(path);
          if (method !== 'GET') {
            socket.write(response('405 Method Not Allowed', ''));
            socket.end();
            return;
          }
          path = resolve(dir, path);
          if (!path.startsWith(dir)) {
            socket.write(response('403 Forbidden', ''));
            socket.end();
            return;
          }
          if (!fs.existsSync(path)) {
            socket.write(response('404 Not Found', ''));
            socket.end();
            return;
          }
          const content = fs.readFileSync(path);

          socket.write(response('200 OK', content));
          socket.end();
        });
      } catch (e) {
        console.error('Error writing to connection:', (e as Error).message);
      }
    });

    await server.listen(keypair);
    return server;
  }

  async destroy(): Promise<void> {
    await this.fabric.destroy();
  }

  async keyGen(): Promise<void> {
    const pair = Fabric.keyPair();
    const beamPair = {
      publicKey: Buffer.from(pair.publicKey).toString('hex'),
      secretKey: Buffer.from(pair.secretKey).toString('hex')
    };

    fs.writeFileSync('beam.keypair.json', JSON.stringify(beamPair, null, 2));
  }

  async resolveZone(space: string, latest: boolean = false): Promise<ResolveZoneResponse> {
    await this.fabric.spaces.checkAnchor();
    const start = performance.now();
    const qtime = now();
    const res = await this.fabric.zoneGet(space, { latest });
    const elapsed = performance.now() - start;

    if (!res) throw new Error('Zone not found');

    const { value, signature, from } = res;
    const zone = dns.decode(value);
    if (!zone) {
      throw new Error('Failed to decode zone');
    }

    return {
      zone,
      space,
      closestNodes: res.closestNodes,
      size: value.length + signature.length,
      signature,
      peer: from,
      qtime,
      elapsed,
    };
  }
}

defineMainOptions();

program.name('beam');

program
    .command('@example [options...]')
    .option('--latest', 'Fine the latest version of a zone')
    .description('Query space\'s records')
    .action(async (options: string[], _: any, cmd: any) => {
      const opts = cmd.optsWithGlobals();
      let beam: Beam;

      try {
        beam = new Beam(opts);
        await beam.ready();

        const qname = options.shift()!;
        const labels = qname.split('.');
        const space = labels[labels.length - 1];
        if (!space.startsWith('@')) {
          console.error(`space names must start with @, got '${space}'`);
          return;
        }

        const qtypes = options.length > 0 ? options : ['AXFR'];
        const response = await beam.resolveZone(space, opts.latest);
        response.qname = qname;
        response.qtypes = qtypes.map(t => t.toUpperCase());

        printDigStyleResponse(response, opts.latest);
      } catch (e) {
        console.error((e as Error).message);
      } finally {
        try {
          // @ts-ignore
          await beam.destroy();
        } catch (_) {}
      }
    });

program
    .command('sign <zone>')
    .description('Sign a space zone file')
    .requiredOption('--private-key <xpriv>', 'Wallet extended private key')
    .action(async (zonePath: string, _: any, cmd: any) => {
      const opts = cmd.optsWithGlobals();
      const { privateKey } = opts;
      const signedPath = `${zonePath}.signed`;

      let fabric: Fabric;
      try {
        fabric = createFabric(opts);
        let content = fs.readFileSync(zonePath).toString()
        const parsedZone = parseZoneFile(content.toString());

        const soa = parsedZone.find(r => r.type === 'SOA');
        if (!soa) {
          console.error('SOA record is required');
          return;
        }
        const space = soa.name.slice(0, -1);
        if (!space.startsWith('@')) {
          console.error(`space names must start with @, got '${space}'`);
          return;
        }

        const version = soa.data.serial;
        const value = dns.encode({
          type: 'response',
          answers: parsedZone as Answer[]
        });

        const { msg, signature } = await fabric.zoneSign(space, value, privateKey, { seq: version });

        content += `\n; signature\n`;
        content += `_witness   ${soa.data.minimum} CLASS2 NULL \\# ${signature.length} ${Buffer.from(signature).toString('hex')}\n`;
        fs.writeFileSync(signedPath, content);

        const verified = await fabric.spaces.verify(space, msg, signature);
        if (!verified) {
          console.error('Failed to verify signature after signing');
          return;
        }

        console.log(`Signed zone file saved to ${signedPath} (size: ${msg.length} bytes)`);
      } catch (e) {
        console.error((e as Error).message);
      } finally {
        try {
          // @ts-ignore
          await fabric.destroy();
        } catch (_) {}
      }
    });

program
    .command('connect <space-uri>')
    .description('Connect to a space over encrypted Noise connection')
    .action(async (space: string, _: any, cmd: any) => {
      const opts = cmd.optsWithGlobals();
      let beam: Beam;
      try {
        if (!space.startsWith('@')) {
          console.error(`space names must start with @, got '${space}'`);
          return;
        }
        beam = new Beam(opts);
        const [name, ...parts] = space.split('/');
        const path = parts.join('/');
        await beam.connect(name, path);
        await new Promise(() => {});
      } catch (e) {
        console.error('error', (e as Error).message);
      } finally {
        try {
          // @ts-ignore
          await beam.destroy();
        } catch (_) {}
      }
    });

program
    .command('serve <space>')
    .requiredOption('--dir <path>', 'Directory to serve')
    .description('Establish an encrypted Noise connection')
    .action(async (space: string, _: any, cmd: any) => {
      const opts = cmd.optsWithGlobals();
      let beam: Beam;

      try {
        if (!space.startsWith('@')) {
          console.error(`space names must start with @, got '${space}'`);
          return;
        }
        beam = new Beam(opts);
        await beam.ready();
        const server = await beam.serve(opts.dir);
        const address = server.address();
        console.log(`; Listening Address: ${address.host}:${address.port}(${Buffer.from(server.publicKey).toString('hex')})`);
        process.once('SIGINT', async () => {
          await server.close();
          await beam.destroy();
          process.exit(0);
        });
        await new Promise(() => {});
      } catch (e) {
        console.error('error', (e as Error).message);
      } finally {
        try {
          // @ts-ignore
          await beam.destroy();
        } catch (_) {}
      }
    });

const args = process.argv;

for (let i = 0; i < args.length; i++) {
  if (args[i].includes('@') && i > 0 && args[i - 1].includes('beam')) {
    const command = '@example';
    const argWithAt = args[i];

    args.splice(i, 1);
    args.splice(i, 0, command, argWithAt);
    break;
  }
}

program.parse(args);

function createFabric(opts: any): Fabric {
  const fabricOpts = nodeOpts(opts);
  return new Fabric(fabricOpts);
}

function printDigStyleResponse(res: any, latest: boolean = false): void {
  const answers = res.zone.answers;
  const axfr = res.qtypes.filter((q: string) => q === 'AXFR').length > 0;
  const relevantAnswers = axfr ? answers : answers.filter((a: any) => a.name === res.qname &&
      (!axfr ? res.qtypes.includes(a.type) : true)
  );

  const authority = !axfr && relevantAnswers.length === 0 ? [answers.find((a: any) => a.type === 'SOA')] : [];
  const additional: any[] = [];

  const witnessOwner = '_witness.' + res.space;
  additional.push({
    name: witnessOwner,
    ttl: answers.find((a: any) => a.type === 'SOA').data.minimum,
    class: 'CLASS2',
    type: 'NULL',
    data: res.signature,
  });

  if (axfr) {
    const index = answers.findIndex((a: any) => a.type === 'SOA');
    if (index !== -1) {
      const soa = answers[index];
      answers.splice(index, 1);
      relevantAnswers.unshift(soa);
      relevantAnswers.push(soa);
    }
  }

  console.log(`; ${beamTitle} ${res.qname} ${res.qtypes.join(' ')}`);
  console.log(';; Got answer:');
  console.log(';; ->>HEADER<<- opcode: QUERY, status: NOERROR');
  console.log(`;; flags: qr rd ra ad; QUERY: ${res.qtypes.length}, ANSWER: ${relevantAnswers.length}, AUTHORITY: ${authority.length}, ADDITIONAL: ${additional.length}`);
  console.log(';; QUESTION SECTION:');
  console.log(`;${res.qname}.\t\tCLASS2\t${res.qtypes.join(' ')}\t`);
  console.log('');

  const longestName = Math.max(...answers.map((a: any) => a.name.length), witnessOwner.length);
  const printRecord = (a: any) => {
    if (a.class === 'CS') a.class = 'CLASS2';
    const owner = a.name + '.' + ' '.repeat(longestName - a.name.length);

    let data = '';
    switch (a.type) {
      case 'SOA':
        data = `${a.data.mname} ${a.data.rname} ${a.data.serial} ${a.data.refresh} ${a.data.retry} ${a.data.expire} ${a.data.minimum}`;
        break;
      case 'TXT':
        data = a.data.map((txt: string) => `"${txt}"`).join(' ');
        break;
      case 'A':
      case 'AAAA':
        data = a.data;
        break;
      case 'NULL':
        data = `\\# ${a.data.length} ${a.data.toString('hex')}`;
        break;
      default:
        if (Buffer.isBuffer(a.data)) {
          data = a.data.toString('hex');
        } else {
          data = JSON.stringify(a.data);
        }
    }

    console.log(`${owner}\t${a.ttl}\t${a.class}\t${a.type}\t${data}`);
  };

  if (relevantAnswers.length > 0) {
    console.log(';; ANSWER SECTION:');
    relevantAnswers.forEach((a: any) => printRecord(a));
    console.log('');
  }

  if (authority.length > 0) {
    console.log(';; AUTHORITY SECTION:');
    authority.forEach((a: any) => printRecord(a));
    console.log('');
  }

  if (additional.length > 0) {
    console.log(';; ADDITIONAL SECTION:');
    additional.forEach((a: any) => printRecord(a));
    console.log('');
  }

  console.log(`;; ->>RESPONSE FROM<<- target: ${res.space}`);
  console.log(`;; ${res.peer.host}#${res.peer.port}(${Buffer.from(res.peer.id).toString('hex')})`);

  if (res.closestNodes.length > 0) {
    res.closestNodes.forEach((peer: any) => {
      console.log(`;; ${peer.host}#${peer.port}(${Buffer.from(peer.id).toString('hex')})`);
    });
  }

  if (!latest)
    console.log(`;; Use --latest to find most up to date zone (compares valid responses from other peers)`);

  console.log('');
  console.log(`;; Query time: ${parseInt(res.elapsed)} msec`);
  console.log(`;; WHEN: ${res.qtime}`);
  console.log(`;; MSG SIZE rcvd: ${res.size}`);
}

function now(): string {
  return new Date().toLocaleString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short',
  });
}
