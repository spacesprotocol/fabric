import {Fabric} from '../index';
import {VeritasSync} from '../veritas';
import dns from 'dns-packet';

async function main() {
  const fabric = new Fabric({
    // Load trust anchors
    veritas: await VeritasSync.create({
      remoteUrls: ['http://127.0.0.1:7225/root-anchors.json'],
      // Alternatively specify static ones
      // staticAnchors: [
      //   {
      //     root: 'c9395f0256c5f665f30f191af459836f92073901f609d1dc6db0bc8787d82dbf',
      //     block: {
      //       hash: '00000000000000000001491cc9a1da165e4d2f1b248cbc0ae024b9ad8f8e9a07',
      //       height: 885060
      //     }
      //   },
      //   ...
      // ]
    })
  });

  const {value : dnsPacket} = await fabric.zoneGet('@buffrr');
  const records = dns.decode(dnsPacket);
  console.log('records: ', records);
  await fabric.destroy();
}

main();
