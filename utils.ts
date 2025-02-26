import crypto from 'crypto';

export function spaceHash(spaceName: string): Buffer {
  const label = spaceName.startsWith('@') ? spaceName.slice(1) : spaceName;
  const byteArray = Buffer.from(label, 'utf8');
  const lengthPrefix = Buffer.from([byteArray.length]);
  const finalByteArray = Buffer.concat([lengthPrefix, byteArray]);
  const base = Buffer.from(crypto.createHash('sha256').update(finalByteArray).digest('hex'), 'hex');
  base[0] &= 0x7f;
  base[31] &= 0xfe;
  return base;
}

