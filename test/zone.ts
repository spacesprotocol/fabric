import test from 'brittle';
import {swarm} from './helpers';
import {serializeEvent} from '../utils';
import {toEvent} from '../messages';
import {DNS_EVENT_KIND} from '../constants';

const event1 = {
  id: 'b484ffb45b5494d27b3dadf9f7b0b8c3b1e2014189df07a122af7d8dc2cdfd4b',
  pubkey: 'd85391f4c095368da0f40a16c3aa92ae4afd0bf9e4c5192ea8c003ed0a8ca83a',
  created_at: 1740973309,
  kind: DNS_EVENT_KIND,
  tags: [['space', '@buffrr']],
  content: 'AAAoAAAAAAAAAwAAB0BidWZmcnIAAAYAAgAADhAAFgAAAAAAAQAADhAAAAJYAAk6gAAADhDADAAQAAIAAA4QABAPSGVsbG8gRmFicmljIDIhCF9kbnNsaW5rwAwAEAACAAABLABRUGRuc2xpbms9L2ZhYnJpYy82NDEwZDY2OGI3M2EyYWY4MzRmYjYyNGM3YTIzODE3YjQ5YWNhNmIyY2M2MGY3ODI1N2ViNDhjZGIzNWY1MDNi',
  sig: 'cd23558b4ade4d77def66577b77f39e6fedab2e32e62bfce3b7f93eb40e3cf9e0b23cb1e1565432ffdadef80ed0711a0943b11207aa19ee029b56f7fd3536025',
  proof: 'AQABAAICaQ4Hhr08OtNDZZkSgTXGk0i3MfIoALf8cucZSnhUyQEAAgHMqhn+t6Kt9nwQ8ITKZcR0r5JTbQCYDoodIJu3BgJXAQACshSYdNudO8PZpcHCUfUeA1nf6dsQKOrwdlKQ6VK2cREBAALOGDW46g0yOtskXbr+scDDV3isVBs3o0hdtgQjg50mtQEAAQACpmbW21sw1Zs9yCL/opL/AfWCT+jpAo/V3Jv8IwkAAKQBAAEAAQABAAKopnVk/YV2oYV25GtcLayl5ni32Emhp9BZJhI+ztaowgECAAEAAnbnjD/E70jXov9+lUNkoAcwKQPjzUk/RSdwr8OASc2jAHojU547PodMGx8rInYvFf07BGPlgmQ1o0MO3E8bkaR5ADYBAQZidWZmcnIB/P1NDgAA+5oCIlEg2FOR9MCVNo2g9AoWw6qSrkr9C/nkxRkuqMAD7QqMqDoCOR0jY/cxeZtcXiCqcPb8DeIMN5+WSZBE1kglChNFY0wC8BQD5SlPmF3Vhhw+KQ1zdep3MrLhwQn+h5LTYgQLI3ICbzK4OrJ6bw0yMxwJtyKahf0ZgEAwasb2B3GZWrj3jQECThG5kQ7Cp/jWc4rNIFGydGVDgFuGcxKQJjmuOpLvx2UC/zkE8JjXl+fav1x3w3cUugn6Vp1v/GyFXDMZuNpyWNcCE80cksYPRzx2WwIV74fjyKU1GTT/cqCaj38YUSwNKMg='
};

const event2 = {
  id: '020ea34e1fdf02acda596127be3629d2628e49535a056efed18161359bdfc7bb',
  pubkey: '374edebe2cc448fc4ebcd46b99322a0373c7c905cec227ae1ce8773ca616de81',
  created_at: 1740975447,
  kind: DNS_EVENT_KIND,
  tags: [ ['space', '@key']],
  content: 'AAAoAAAAAAAAAwAAB0BidWZmcnIAAAYAAgAADhAAFgAAAAAAAQAADhAAAAJYAAk6gAAADhDADAAQAAIAAA4QABAPSGVsbG8gRmFicmljIDIhCF9kbnNsaW5rwAwAEAACAAABLABRUGRuc2xpbms9L2ZhYnJpYy82NDEwZDY2OGI3M2EyYWY4MzRmYjYyNGM3YTIzODE3YjQ5YWNhNmIyY2M2MGY3ODI1N2ViNDhjZGIzNWY1MDNi',
  sig: '27da4643383feb29f4b88f88cc7401b9acf4d46b47e8cc16db3b35afed29c402d5eb79728fbe7c16c624a78d558bae8e99c76474278a3fa40060dee08fa1abaa',
  proof: 'AQABAAEAAuWfRJiigs/m7dfDuNZvssGZjxAPxwhxaY/GrCgc0NlwAQABAALcgUjhk30jWjMJ2i4jaqn1uIoq8JsRX4k9dbP7fWx/3AEAAQACQQMTow6+qMIDLAOGdZps9Zo3p9NtCupnVgHD+UviiCcBAAEAAkdpXwG20X/B75E5XZnCdJBe1pXJ3TO2WZBGPgYTaMRwAQACum23ooo9fyF6fqw5lxOiKS9Jx8dyzkmIXi3pTiPuEm0BAALle+SLsgn36U4romjVGZ4uLaUVb2H2Ddf6/GDF6m55qAEDAAJ+YuqBgvNzZzSpztzOIwN3m4ArnRWMmQEs/tzvpxXV5QAq47VeiOhRPDzkDjkx23DUvT6fiMoA2cCCj9x5baS5AQAzAQEDa2V5AfyQPw4AAPuaAiJRIDdO3r4sxEj8TrzUa5kyKgNzx8kFzsInrhzodzymFt6BAh9VzKiTxnkXIC/XdnoTz+bF8fvVeZ821l3qwTRvtdF2AnMLhv+r0Ff9rS4E+ruR8otqQeelA1VHWuTDmXuDf0/TAmIq119D2MAoTEzqzuEYY1ORRZfrYUFcEr1P+IKkn2mfAqSS0lyizvxxs7GGuV5dX5q3yZ6hNs1nxdzWLsON741uAsbQwq18YYXJ2sg5fvMI8Ye3W8J+EX/3xpSHPwIADtYB'
};

const event2_recent = {
  id: '81ce23a31ac3451a5b64d239f9484e6e51dd69d150f2746fd1fed2a88fa829dd',
  pubkey: '374edebe2cc448fc4ebcd46b99322a0373c7c905cec227ae1ce8773ca616de81',
  created_at: 1740975646,
  kind: DNS_EVENT_KIND,
  tags: [['space', '@key']],
  content: 'AAAoAAAAAAAAAwAAB0BidWZmcnIAAAYAAgAADhAAFgAAAAAAAQAADhAAAAJYAAk6gAAADhDADAAQAAIAAA4QABAPSGVsbG8gRmFicmljIDIhCF9kbnNsaW5rwAwAEAACAAABLABRUGRuc2xpbms9L2ZhYnJpYy82NDEwZDY2OGI3M2EyYWY4MzRmYjYyNGM3YTIzODE3YjQ5YWNhNmIyY2M2MGY3ODI1N2ViNDhjZGIzNWY1MDNi',
  sig: '623d762b64bb39f4ac9b2ef0652ffe9d256439dc6cff3258139036c7a8981ea024ea94859223ca70190cd5a45fcb09f760427acf2008f2e26628f521d2d6b6dd',
  proof: 'AQABAAEAAqVmFJzDMpAtx1mou0EhNkDuJc+Rs2BwJkXCYMXRV297AQABAAIfUWVF7lB8aJ2KdD/gA0r9WoxK9hG5Br0vfEGS2aQ1dgEAAQACfMnO2IuEKMQrOKpDQBuP8HocSSeR7EUNER/wg2ZrvSYBAAEAArvWh1+Owi7o2NysahbLZIzQEI1G1S7/ZI5jOGNUW5tdAQACUXlHkfpR0MxoCqjpQLJLSz9L7SHROI9VztexNBeknn8BAALuraW48cEmXqTpp+kXun8wA2GA5NBlCSMBEcsWlvc2CwEDAALMt+Xeec4SMGN4X5D3KsHZxYKKSN7N7ujZNC+dEhcKIAAq47VeiOhRPDzkDjkx23DUvT6fiMoA2cCCj9x5baS5AQAzAQEDa2V5AfyQPw4AAPuaAiJRIDdO3r4sxEj8TrzUa5kyKgNzx8kFzsInrhzodzymFt6BAtfJq8ewSbKHn47fxfyyW3ELuGXODaswvKynZ8Hd2s+aAvr6vdplu/RXFexPmJkS/nkbW+R55ZuWxyf6ZainbxmFAlzo0/fm4pOCnSX943NxLqzHM735dB8Ysk8jIVZsImI1AoTfdC+s8xIuT4xoO2lyjE75bu/xiAcwU2AqjsROxTP7AhdYuvoh4eJhpyue4rHJO10IFgDZbiRaDLVX/YuoSSFT'
};

const event2_recent_pubkey_changed = {
  id: 'c79f6700c772fc5ec1cc84503ccd389f31f836f87a0b84911a1cf152d14da1d1',
  pubkey: '8da4134b2be6c0313ec56ee55771f5cd73ee623e40e980fff9f24b0371197539',
  created_at: 1741004331,
  kind: DNS_EVENT_KIND,
  tags: [['space', '@key']],
  content: 'AAAoAAAAAAAAAwAAB0BidWZmcnIAAAYAAgAADhAAFgAAAAAAAQAADhAAAAJYAAk6gAAADhDADAAQAAIAAA4QABAPSGVsbG8gRmFicmljIDIhCF9kbnNsaW5rwAwAEAACAAABLABRUGRuc2xpbms9L2ZhYnJpYy82NDEwZDY2OGI3M2EyYWY4MzRmYjYyNGM3YTIzODE3YjQ5YWNhNmIyY2M2MGY3ODI1N2ViNDhjZGIzNWY1MDNi',
  sig: 'b75bec3f8eaa3a0c2bb5b89d345ad09e6288717d01acf5945980c4781d9d8383e0e130da94fc559007338d775638effb0295792f7755bf3202f49d587f18fb44',
  proof: 'AQABAAEAAqVmFJzDMpAtx1mou0EhNkDuJc+Rs2BwJkXCYMXRV297AQABAAKjLGAMwDd2cpgBE3kFXi5g+5HxIHdWOkXqot/lfxammwEAAncXvli12w/dd0CZe7YQmei05aegK+PgK2IM42IHvN9/AQABAAEAAivuZvjtgxH863DqJ0X09yDXS+OhsATdSzkkdtda7isyAQACPZ+PndQVQO0KL/SCOdHPoEIIbyCbom3Nd4mTkDOuw0sBAAKAnpXjnJxu2mDM2CXGl/VycDiRdG7NxUR5QEJ5RXX6JgEAAlEMyaJt3AEkcmNh6rCQS4PS0dQWBc+RT2QsXhqOEISxACzz3GaYf+A1jc05T5j9d9TUgJEHWHdBfjA0lx0MF9lTADMBAQNrZXkB/JJSDgAA+5oCIlEgjaQTSyvmwDE+xW7lV3H1zXPuYj5A6YD/+fJLA3EZdTkCGAi1GnsbUBMjlEJAiKBhk/bIgJ/xwQVjQ+X3FoG4tX0CBQpb0tbgScRiFr+8B9qylGHXmld8ooJE4+VHxm0AywcCXOjT9+bik4KdJf3jc3EurMczvfl0HxiyTyMhVmwiYjUC87iQT7ZO27G45qboYxf2/uPQuWL13YLhp6UhEhKktpgCF1i6+iHh4mGnK57isck7XQgWANluJFoMtVf9i6hJIVM='
}

test('space put - gets', async function (t) {
  const {nodes} = await swarm(t, 4)

  {
    let evt = JSON.parse(JSON.stringify(event1));
    const put = await nodes[0].eventPut(evt);

    t.is(serializeEvent(toEvent(put.event)), serializeEvent(evt));

    const res = await nodes[1].eventGet('@buffrr', evt.kind);

    t.is(serializeEvent(toEvent(res.event)), serializeEvent(evt));
  }

  {
    let evt = JSON.parse(JSON.stringify(event2));
    const put = await nodes[0].eventPut(evt);

    t.is(serializeEvent(toEvent(put.event)), serializeEvent(evt));

    const res = await nodes[1].eventGet('@key', evt.kind);
    t.is(serializeEvent(toEvent(res.event)), serializeEvent(evt));

    const res2 = await nodes[1].eventGet('@buffrr', evt.kind);
    t.is(serializeEvent(toEvent(res2.event)), serializeEvent(event1));
  }

  // more recent proof shouldn't be accepted
  {
    let evt = JSON.parse(JSON.stringify(event2_recent));
    await t.exception (nodes[0].eventPut(evt))
  }

  // however if pubkey changed we should accept it
  {
    let evt = JSON.parse(JSON.stringify(event2_recent_pubkey_changed));
    const put = await nodes[0].eventPut(evt);

    t.is(serializeEvent(toEvent(put.event)), serializeEvent(evt));

    const res = await nodes[1].eventGet('@key', evt.kind);
    t.is(serializeEvent(toEvent(res.event)), serializeEvent(evt));
  }
})
