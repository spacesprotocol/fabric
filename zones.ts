import fs from 'fs';
import path from 'path';
import { EventEmitter } from 'events';
import dns, {Answer} from 'dns-packet';
import { spaceHash } from './utils';

const INTERVAL = 12 * 3600000;

interface Payload {
  space: string;
  target: Buffer;
  seq: number;
  signature: Buffer;
  value: Buffer;
}

interface DNSRecord {
  name: string;
  type: string;
  class: string;
  ttl: number;
  data: any;
}

export class ZoneWatcher extends EventEmitter {
  private directory: string;
  private watcher: fs.FSWatcher | null;
  private debounceTimers: { [key: string]: NodeJS.Timeout } | null;

  constructor(directory: string) {
    super();
    this.directory = directory;
    this.watcher = null;
    this.debounceTimers = null;
    this.init();
  }

  private init(): void {
    this.refresh().catch(err => {
      console.error(`Error during initial refresh: ${err.message}`);
    });
    setInterval(() => {
      this.refresh().catch(err => {
        console.error(`Error during periodic refresh: ${err.message}`);
      });
    }, INTERVAL);

    // Start watching the directory
    this.watch();
  }

  private async refresh(): Promise<void> {
    try {
      const files = await fs.promises.readdir(this.directory);
      const zoneFiles = files.filter(file => path.extname(file) === '.signed');
      await Promise.all(zoneFiles.map(file => this.processFile(file)));
    } catch (err) {
      console.error(`Error reading directory '${this.directory}': ${(err as Error).message}`);
    }
  }

  private watch(): void {
    this.watcher = fs.watch(this.directory, (eventType, filename) => {
      if (!filename || path.extname(filename) !== '.signed') return;
      this.debounceProcessFile(filename);
    });
  }

  private debounceProcessFile(filename: string): void {
    if (this.debounceTimers == null) {
      this.debounceTimers = {};
    }
    clearTimeout(this.debounceTimers[filename]);

    this.debounceTimers[filename] = setTimeout(() => {
      this.processFile(filename).catch(err => {
        console.error(`Error processing file '${filename}': ${(err as Error).message}`);
      });
    }, 1000);
  }

  private async processFile(filename: string): Promise<void> {
    const filePath = path.join(this.directory, filename);
    try {
      const data = await fs.promises.readFile(filePath, 'utf8');
      const answers = parseZoneFile(data);
      const soa = answers.find(r => r.type === 'SOA');
      if (!soa) {
        console.error(`SOA record not found in file '${filename}'`);
        return;
      }
      const origin = soa.name;
      const witness = answers.find(r => r.name === '_witness.' + origin);
      if (!witness) {
        console.error(`Witness record not found in file '${filename}'`);
        return;
      }

      const signature = witness.data;
      answers.splice(answers.indexOf(witness), 1);
      const space = origin.slice(0, -1);
      if (!space.startsWith('@')) {
        console.error(`space names must start with @, got '${space}'`);
        return;
      }

      const target = spaceHash(space.slice(1));
      const value = dns.encode({
        type: 'response',
        answers: answers as Answer[]
      });
      const payload: Payload = {
        space,
        target,
        seq: (soa.data as { serial: number }).serial,
          signature: Buffer.from(signature as string),
      value
    };

      this.emit('updated', { filename, payload });
    } catch (err) {
      console.error(`Error processing file '${filename}': ${(err as Error).message}`);
    }
  }

  async destroy(): Promise<void> {
    if (this.watcher) this.watcher.close();
    if (!this.debounceTimers) return;
    for (const timer in this.debounceTimers) {
      clearTimeout(this.debounceTimers[timer]);
    }
  }
}

function parseZoneFile(zoneFile: string): DNSRecord[] {
  const lines = zoneFile.split(/\r?\n/);
  let origin = '';
  let defaultTTL = 3600;
  let currentName = '';
  const records: DNSRecord[] = [];

  let currentLine = '';
  let inParen = false;

  for (let line of lines) {
    line = line.trim();
    if (!line) continue;
    if (line.includes('(') && !line.includes(')')) inParen = true;
    if (line.includes(')')) inParen = false;
    currentLine += ' ' + line;
    if (inParen || line.endsWith('(') || line.endsWith('\\')) continue;
    line = currentLine.trim();
    currentLine = '';
    line = removeComments(line);

    if (!line || line.startsWith(';')) continue;

    if (line.startsWith('$ORIGIN') || line.startsWith('@ORIGIN')) {
      const tokens = line.split(/\s+/);
      origin = tokens[1];
      if (!origin.endsWith('.')) origin += '.';
      continue;
    }

    if (line.startsWith('$TTL') || line.startsWith('@TTL')) {
      const tokens = line.split(/\s+/);
      defaultTTL = parseInt(tokens[1], 10);
      continue;
    }

    const tokens = tokenizeLine(line);
    let idx = 0;

    let name = tokens[idx];

    if (name === '' || name === undefined || name === null) {
      name = currentName;
    } else if (/^\d+$/.test(name)) {
      // Name is omitted, use currentName
      name = currentName;
    } else if (name === '@') {
      name = origin;
      currentName = name;
      idx++;
    } else {
      // Update currentName
      currentName = name;
      idx++;
    }

    if (!name.endsWith('.')) {
      name = name + '.' + origin;
    }

    let ttl = defaultTTL;
    if (/^\d+$/.test(tokens[idx])) {
      ttl = parseInt(tokens[idx], 10);
      idx++;
    }

    // Check if next token is class
    let rrClass: string = 'CLASS2';
    if (tokens[idx] === 'IN' || tokens[idx] === 'CH' || tokens[idx] === 'HS' || tokens[idx] === 'CLASS2') {
      rrClass = tokens[idx];
      idx++;
    }
    if (rrClass === 'CLASS2') rrClass = 'CS'; // dns-packet uses 'CS' for CLASS2

    // Type
    const type = tokens[idx].toUpperCase();
    idx++;

    // Data: rest of the tokens
    const dataTokens = tokens.slice(idx);
    let data: any;

    switch (type) {
      case 'A':
      case 'AAAA':
        data = dataTokens[0];
        break;
      case 'TXT':
        data = dataTokens.join(' ').trim();
        data = parseTXTData(data);
        break;
      case 'SOA':
        const mname = dataTokens[0];
        const rname = dataTokens[1];
        const rest = dataTokens.slice(2).join(' ');
        const paramsStr = rest.replace(/[()]/g, '');
        const paramsTokens = paramsStr.split(/\s+/).filter(Boolean);
        const [serial, refresh, retry, expire, minimum] = paramsTokens.map(s => parseInt(s, 10));
        data = {
          mname: mname.endsWith('.') ? mname : mname + '.' + origin,
          rname: rname.endsWith('.') ? rname : rname + '.' + origin,
          serial,
          refresh,
          retry,
          expire,
          minimum
        };
        break;
      case 'NULL':
        // NULL record data in hex format
        data = parseNULLData(dataTokens);
        break;
      default:
        // Skip unsupported record types
        continue;
    }

    const record: DNSRecord = {
      name,
      type,
      class: rrClass,
      ttl,
      data
    };

    records.push(record);
  }

  return records;
}

// Remove comments in a zone file line
function removeComments(line: string): string {
  let inQuote = false;
  let result = '';
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuote = !inQuote;
    }
    if (char === ';' && !inQuote) {
      break;
    }
    result += char;
  }
  return result.trim();
}

function tokenizeLine(line: string): string[] {
  const tokens: string[] = [];
  let token = '';
  let inQuote = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuote = !inQuote;
      token += char;
    } else if (/\s/.test(char) && !inQuote) {
      if (token) {
        tokens.push(token);
        token = '';
      }
    } else {
      token += char;
    }
  }

  if (token) {
    tokens.push(token);
  }

  return tokens;
}

// Function to parse TXT data, handling quoted strings
function parseTXTData(data: string): string[] {
  const result: string[] = [];
  let inQuote = false;
  let token = '';

  for (let i = 0; i < data.length; i++) {
    const char = data[i];
    if (char === '"') {
      inQuote = !inQuote;
      if (!inQuote) {
        // End of a quoted string
        result.push(token);
        token = '';
      }
    } else if (inQuote) {
      token += char;
    }
  }

  return result;
}

function parseNULLData(dataTokens: string[]): Buffer {
  if (dataTokens[0] !== '\\#') throw new Error('Invalid NULL record format; expected \\# indicator');
  const rdlength = parseInt(dataTokens[1], 10);
  const hexData = dataTokens.slice(2).join('').replace(/\s+/g, '');
  if (hexData.length / 2 !== rdlength) throw new Error('Invalid NULL record data length');
  return Buffer.from(hexData, 'hex');
}

export { parseZoneFile };