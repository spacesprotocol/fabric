import test from 'brittle'
import {swarm} from './helpers'
import {serializeEvent} from '../utils';
import {toEvent} from '../messages';

const event1 = {
  created_at: 10000,
  kind: 0,
  content: 'Hello Fabric',
  tags: [],
  pubkey: 'dd14827a2311c54edd52fafae604bf0c1f6000febeb18833f58e10e92a2415e9',
  id: '523cd93df6b1d9240d8199f38bc99c00941f0c3a576646aa4524e69651b40ced',
  sig: 'd3abd6ca21a1bc6915d0309c2d1b6cc9df8c1318b88f33ed8d15e2faa7d9c29004dc36b9247433e421997fa7ae56de29d4250e36cb63786ea369c3d6760ad462'
}

const event2 = {
  created_at: 10001,
  kind: 0,
  content: 'Hello Fabric 2',
  tags: [],
  pubkey: 'dd14827a2311c54edd52fafae604bf0c1f6000febeb18833f58e10e92a2415e9',
  id: '55aff77beab3a92a84dd8a4ffc28e76b02a280f69ec1445313e7b5a6f1007491',
  sig: '297a1077719bef43071720b303b5f589da68760c736eb503dfa0a5cd66cc72343ffbfc0be99ce0d5efb570887b25aaf564ea46e31e166c2ba2b4b3d7b929b35f'
}

test('nostr put - get', async function (t) {
  const {nodes} = await swarm(t, 4)

  // bad sig
  {
    let evt = JSON.parse(JSON.stringify(event1));
    evt.sig = '297a1077719bef43071720b303b5f589da68760c736eb503dfa0a5cd66cc72343ffbfc0be99ce0d5efb570887b25aaf564ea46e31e166c2ba2b4b3d7b929b35f';

    await t.exception (
      nodes[0].eventPut(evt, {skipVerify: true})
    );
  }

  {
    let evt = JSON.parse(JSON.stringify(event1));
    const put = await nodes[0].eventPut(evt);

    t.is(serializeEvent(toEvent(put.event)), serializeEvent(evt));

    const res = await nodes[1].eventGet(evt.pubkey, evt.kind);

    t.is(serializeEvent(toEvent(res.event)), serializeEvent(evt));
  }

  // higher timestamp should override
  {
    let evt = JSON.parse(JSON.stringify(event2));
    const put = await nodes[0].eventPut(evt);

    t.is(serializeEvent(toEvent(put.event)), serializeEvent(event2));
    const res = await nodes[1].eventGet(evt.pubkey, evt.kind);
    t.is(serializeEvent(toEvent(res.event)), serializeEvent(event2));
  }

  // now publish stale event
  {
    await t.exception(nodes[0].eventPut(event1));
  }
})
