import test from 'brittle';
import { swarm } from './helpers';

test('zone put - get', async function (t) {
  const { nodes } = await swarm(t, 100);

  const target = Buffer.from(nodes[0].spaces.dummyHashes['@example'], 'hex');
  const descriptor = nodes[0].spaces.dummyDesc;
  const put = await nodes[30].zonePut(target, Buffer.from('testing'), descriptor);

  t.is(put.signature.length, 64);
  t.is(put.seq, 0);

  const res = await nodes[3].zoneGet(target);

  t.is(res.seq, 0);
  t.is(Buffer.isBuffer(res.value), true);
  t.is(Buffer.compare(res.signature, put.signature), 0);
  t.is(res.value.toString(), 'testing');
  t.is(typeof res.from, 'object');
  t.is(typeof res.from.host, 'string');
  t.is(typeof res.from.port, 'number');
  t.is(typeof res.to, 'object');
  t.is(typeof res.to.host, 'string');
  t.is(typeof res.to.port, 'number');
});

test('zone put - put - get', async function (t) {
  const { nodes } = await swarm(t, 100);
  const target = Buffer.from(nodes[0].spaces.dummyHashes['@example'], 'hex');
  const descriptor = nodes[0].spaces.dummyDesc;
  const put = await nodes[30].zonePut(target, Buffer.from('testing'), descriptor);

  t.is(put.signature.length, 64);
  t.is(put.seq, 0);

  const put2 = await nodes[25].zonePut(target, Buffer.from('testing two'), descriptor, { seq: 2 });

  t.is(put2.signature.length, 64);
  t.is(put2.seq, 2);

  const res = await nodes[3].zoneGet(target);

  t.is(res.seq, 2);
  t.is(Buffer.isBuffer(res.value), true);
  t.is(Buffer.compare(res.signature, put2.signature), 0);
  t.is(res.value.toString(), 'testing two');
});
