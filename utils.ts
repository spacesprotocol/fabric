import crypto from 'crypto';

export function spaceHash(spaceName: string): Buffer {
  const nameWithAt = spaceName.startsWith('@') ? spaceName : '@' + spaceName;
  const byteArray = Buffer.from(nameWithAt, 'utf8');
  const lengthPrefix = Buffer.from([byteArray.length]);
  const lengthPrefixedByteArray = Buffer.concat([lengthPrefix, byteArray]);
  const finalByteArray = Buffer.concat([lengthPrefixedByteArray, Buffer.from([0])]);

  const base = Buffer.from(crypto.createHash('sha256').update(finalByteArray).digest('hex'), 'hex');
  base[0] &= 0x7f;
 
  return base;
}
