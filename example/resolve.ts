import {Fabric} from '../index';
import dns from 'dns-packet';
import {AnchorStore} from '../anchor';
import {DNS_EVENT_KIND} from '../constants';
import {toEvent} from '../messages';

async function main() {
  const fabric = new Fabric({
    // Load trust anchors
    anchor: await AnchorStore.create({
      remoteUrls: ['http://127.0.0.1:7225/root-anchors.json'],
      // OR use a public service e.g.
      // remoteUrls: ['https://bitpki.com/root-anchors.json']
    })
  });

  // Fetching by spaces/forward lookups
  const res = await fabric.eventGet('@buffrr', DNS_EVENT_KIND);
  const records = dns.decode(res.event.content);
  console.log('records: ', records);

  // Fetching by pubkeys/reverse lookups
  const RELAY_LIST_EVENT_KIND = 10002; // NIP-65
  const res2 = await fabric.eventGet('d85391f4c095368da0f40a16c3aa92ae4afd0bf9e4c5192ea8c003ed0a8ca83a', RELAY_LIST_EVENT_KIND);

  console.log(toEvent(res2.event))

  // Publishing events
  // const signedNostrEvent = { ... };
  // await fabric.eventPut(signedNostrEvent);

  await fabric.destroy();
}

main();
