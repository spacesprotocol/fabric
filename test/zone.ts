import test from 'brittle'
import {swarm} from './helpers'
import {spaceHash} from '../utils'
import {Buffer} from 'buffer'
import b4a from 'b4a'

const test1 = {
  serial: 1739983316,
  space: '@buffrr',
  packet: 'AAAoAAAAAAAABgAAB0BidWZmcnIAAAYAAgAADhAAIgRzZWxmwAwEX2Ruc8AMZ7YJ1AAADhAAAAJYAAk6gAAADhDADAABAAIAAA4QAAQBAQEBwAwAEAACAAAOEAAMC2hlbGxvIHdvcmxkwAwAEAACAAAOEAAODWhlbGxvIHdvcmxkIDHADAAQAAIAAA4QAA4NaGVsbG8gd29ybGQgMsAMABAAAgAADhAADg1oZWxsbyB3b3JsZCAz',
  signature: '35b106c5ae422f23c0bec4d79e42d7e1cbbbb409f5462f81dc514067441bdbd3358e6e56b333a7bc8a0bea11a8784f6c4a31cf590d28f60c842020f32b6c7630',
  proofs: {
    recent: {
      proof: 'AQABAALkUiXR0Ys7Dgbf3d24RYC6k6cud0lNdjZpPhjKdoqaLQEAAQAC0dYmr8jBATLigQzg6yiM7Qqst3WVN3Kw6NEI64B4WZoBAAIb4BEKG4wvg8GsbrTrEXsTVwqNhVwleNW7X1TUWcirtwEAAhGDomlXC7T7mv+UD9hyqOyxJBL7PTOLdFlGA1dn+wHmAQABAAEAAQAC1PjNPC3hnCpnUUT/MBDAeh3slDCQPpju8u53fWOioHsBAAEAAQACHKUK+r0DOuVC4W7gdPnp/9i2Yz2/Hw2b4PUgWT/DXcoAXEoSg4yLJQq893Wxbas4OFoXrYyfMyOIxE52iWHVwf8ANgEBBmJ1ZmZycgH8SR8OAAD7mgIiUSBatL1eKAsh2d/wa1zVYXCUPidDpyXSk3L4L6B7KWIaAgIRpWmm8GGiixNhqPg6hwPyPww7cIId3JdYEzeLlGnKvAIj9IoYnOeetIY5LNTgHfeaT+iGMVAWfTM1ws5WbVQFagLsms0iB5ri/QL471VBjC0Bc4oD/mzNznPK69Hc/J0vEQKaL5AibV/uH1B6kTbgwB12WBcd1DS+FlmbnuD54ue2gwJTF7byw416cFqQ8U1KU8UpJaM0HCprc//zV5QS3sSG2QKBWTux1AA5DDrsdVzihM/+u20glHAiFmML034MoX+yLQJ3lltRZKI9HVZQIn1pItgY4Wdnk/bcrSYwZOE/ILGJPw==',
      root: 'b5be872a859411e754490d7573c7597fddae7e272166d4c4edf9c466b5ce258f',
    },
    optimal9th: {
      proof: 'AQABAAKRsmHj0wljPxHaf39lOWHA4BBnvYrXHsto/Uru/E8RDQEAAQACN6GsMzPbzVQpD5p1h6/Mn+cA1Ls+gSh3WBr/S4GA6P8BAAKZSRgL4nd4KcWfgtN8yu0fV45FcQIGGEZwvhARRcU96wEAAq1P4TM1YzIkancpRHdjX8AlwhKWpaN8l7hrPESf3sXVAQABAAEAAQAC/KUWXk9v1qjBzSzrwPkwbh4YSDEq7jfEM2kHpc2bqgIBAAEAAQACHKUK+r0DOuVC4W7gdPnp/9i2Yz2/Hw2b4PUgWT/DXcoAXEoSg4yLJQq893Wxbas4OFoXrYyfMyOIxE52iWHVwf8ANgEBBmJ1ZmZycgH8SR8OAAD7mgIiUSBatL1eKAsh2d/wa1zVYXCUPidDpyXSk3L4L6B7KWIaAgKZ+CbQrn8Gb2hJmGpiL6SUk1EgoXjWeiXO517V6NtyaQKaFZsUb4eUJg7sicwldztbZkEMMBdSI/ryqXPgH39x5gK+oKrH86ouN4DR5uW/OkqrC0lrSVL3mnfP7TGDp8pxFgJsZsu6PWhFE5LRmrm7oY6vlI/iBu8bnp2lvqQcDw/7OgJPGouU4P6kuIvCcitFKAsLKPYpIQfl3B+lNsT5zUJATAJ8npoZcVHLmop6060I4QBkKN3RasEND8HFe7ppEgYwVwJ4bI9P04sYqJ9UlN0DIGwnMOVe56PWO6VvkDMHSuHBiQ==',
      root: '5c9ff7d202f1f6498719b5f53865f7c47a34a848127590ba353aea7a7f1c52c2',
    },
    stale8th: {
      proof: 'AQABAAK/RNKaiT7vtvFsTpmGG0wwQdfuL+1xlw9ClZfqD7lO9AEAAQACmrqJOM/ZYB3hgIQNYQUYX/bWnnXYCFHrQk31qXUnihsBAAJ4RhVFEUKhccEmlZrUnqxASaWL/cGxLvcUZTdOX0TH5gEAAqpUQUaFXRr4JFNA5Nu3hCHE/gTNjmy3rrrnYi833FCfAQABAAEAAQAC/KUWXk9v1qjBzSzrwPkwbh4YSDEq7jfEM2kHpc2bqgIBAAEAAQACHKUK+r0DOuVC4W7gdPnp/9i2Yz2/Hw2b4PUgWT/DXcoAXEoSg4yLJQq893Wxbas4OFoXrYyfMyOIxE52iWHVwf8ANgEBBmJ1ZmZycgH8SR8OAAD7mgIiUSBatL1eKAsh2d/wa1zVYXCUPidDpyXSk3L4L6B7KWIaAgKZ+CbQrn8Gb2hJmGpiL6SUk1EgoXjWeiXO517V6NtyaQKaFZsUb4eUJg7sicwldztbZkEMMBdSI/ryqXPgH39x5gK+oKrH86ouN4DR5uW/OkqrC0lrSVL3mnfP7TGDp8pxFgKPxIOKvgCIfi3pNhjGIYMxJ3sXuTmz/Mdu07fFCr/kIgIRfTIFiskImX4ZRZOC2whdDG2WBAIgZkAQj/AaOUm1PgKs2EjIl9IuhqXQb3ujEVg8JmKktt571Q6FgTG1FL/LJwKdYDEaT9VzHtjnIvjgqJTN20EEPIeVVWtTPCdW7UvS1A==',
      root: '12de6d90515302d465bb3886574351b3d730998e9fbc3b10ac19e2467b2908ec'
    },
    stale5th: {
      proof: 'AQABAALRAHUsA2gw/fXpfWQuuZMPruDTzgr6qhBdWGTmMRGJiQEAAQACAL0WTz3NA7A/PU7b7dKZYQiLXb84eQSt/j9irbXCUkABAALJhHFi87fgi7HNKUQVSZdQsQ9/esiGgLs+ErPLFD1AuwEAAjpT42ux/siFb77egwmTSy+A7qX0mW7R55e2S4g8zvoyAQABAAEAAQAC/KUWXk9v1qjBzSzrwPkwbh4YSDEq7jfEM2kHpc2bqgIBAAEAAQACHKUK+r0DOuVC4W7gdPnp/9i2Yz2/Hw2b4PUgWT/DXcoAXEoSg4yLJQq893Wxbas4OFoXrYyfMyOIxE52iWHVwf8ANgEBBmJ1ZmZycgH8SR8OAAD7mgIiUSBatL1eKAsh2d/wa1zVYXCUPidDpyXSk3L4L6B7KWIaAgKZ+CbQrn8Gb2hJmGpiL6SUk1EgoXjWeiXO517V6NtyaQLuzl2S7G3nuLmBmIfiqesWdRC79QCAd8xDquxQVl9zfgK+oKrH86ouN4DR5uW/OkqrC0lrSVL3mnfP7TGDp8pxFgKtSGMdliTCj8MtkQ7/puJoTkkqUDHEinBd8eKz923dVQIRfTIFiskImX4ZRZOC2whdDG2WBAIgZkAQj/AaOUm1PgKMIUB7DgNUAnghwMce+1xn2o2z/4zHfWaXrQLiMSyK4QLJWi3mGsmKTydvje6Q2x4i/biAXO+m1bgmRUpUVvh+dg==',
      root: 'ee6bc6e95bf8d28de119c7973106fdb8a78057eab21238a25d0140f53c49a9ec'
    }
  }
}

interface Packet {
    serial: number,
    space: string,
    packet: Buffer,
    signature: Buffer,
    proof: Buffer,
}

function getPacket(proofVersion: string): Packet {
  // @ts-ignore
  const proof = test1.proofs[proofVersion].proof
  if (!proof) throw new Error(`no '${proofVersion}' found in test data`);

  return {
    proof: Buffer.from(proof, 'base64'),
    space: test1.space,
    serial: test1.serial,
    signature: Buffer.from(test1.signature, 'hex'),
    packet: Buffer.from(test1.packet, 'base64')
  }
}

test('zone put - get', async function (t) {
  const {nodes} = await swarm(t, 4)

  // should validate signature
  let pkt = getPacket('stale5th')
  pkt.signature = Buffer.alloc(64);
  await t.exception(
    nodes[0].zonePublish(pkt.space, pkt.packet, pkt.signature, pkt.proof, {seq: pkt.serial})
  );

  // should validate space name
  pkt = getPacket('stale5th')
  pkt.space = '@wrongspace';
  await t.exception(
    nodes[0].zonePublish(pkt.space, pkt.packet, pkt.signature, pkt.proof, {seq: pkt.serial})
  );
  
  // should accept stale proof if no alternative exists
  const stale = getPacket('stale5th')
  const put = await nodes[0].zonePublish(stale.space, stale.packet, stale.signature, stale.proof, {seq: stale.serial})

  t.is(put.signature.length, 64)

  const res = await nodes[1].zoneGet(stale.space)

  t.is(res.seq, stale.serial)
  t.is(b4a.compare(res.value, stale.packet), 0)
  t.is(b4a.compare(res.proof, stale.proof), 0)
  t.is(b4a.compare(res.signature, put.signature), 0)
  t.is(typeof res.from, 'object')
  t.is(typeof res.from.host, 'string')
  t.is(typeof res.from.port, 'number')
  t.is(typeof res.to, 'object')
  t.is(typeof res.to.host, 'string')

  // if both proofs are stale, it should accept the more recent one
  const stale8th = getPacket('stale8th')
  await nodes[0].zonePublish(stale8th.space, stale8th.packet, stale8th.signature, stale8th.proof, {seq: stale8th.serial})

  // a more recent proof can override a stale proof
  const recent = getPacket('recent')
  const put2 = await nodes[0].zonePublish(recent.space, recent.packet, recent.signature, recent.proof, {seq: recent.serial})

  t.is(put2.signature.length, 64)

  const res2 = await nodes[1].zoneGet(recent.space)
  t.is(b4a.compare(res2.proof, recent.proof), 0)

  // an optimal proof can override a more recent proof
  const optimal = getPacket('optimal9th')
  await nodes[0].zonePublish(optimal.space, optimal.packet, optimal.signature, optimal.proof, {seq: optimal.serial})
  const res3 = await nodes[1].zoneGet(optimal.space)
  t.is(b4a.compare(res3.proof, optimal.proof), 0)

  // a more recent proof cannot override an optimal proof
  await t.exception(nodes[0].zonePublish(recent.space, recent.packet, recent.signature, recent.proof, {seq: recent.serial}))
})
