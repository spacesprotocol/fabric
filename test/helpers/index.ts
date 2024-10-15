// @ts-ignore
import createTestnet from './testnet';
// @ts-ignore
import NewlineDecoder from 'newline-decoder';
import { spawn, ChildProcess } from 'child_process';
// @ts-ignore
import goodbye from 'graceful-goodbye';

export { swarm, toArray, spawnFixture };

async function toArray<T>(iterable: AsyncIterable<T>): Promise<T[]> {
  const result: T[] = [];
  for await (const data of iterable) result.push(data);
  return result;
}

async function swarm(t: any, n = 32, bootstrap: any[] = []): Promise<any> {
  return createTestnet(n, { bootstrap, teardown: t.teardown });
}

async function* spawnFixture(t: any, args: string[]): AsyncGenerator<[() => void, string]> {
  const proc: ChildProcess = spawn(process.execPath, args);
  const nl = new NewlineDecoder();
  const kill = () => setTimeout(() => proc.kill('SIGKILL'), 1000);
  const unregisterExitHandlers = goodbye(() => proc.kill('SIGKILL'));

  // @ts-ignore
  proc.stderr.on('data', err => t.fail(err));

  // @ts-ignore
  for await (const data of proc.stdout) {
    for (const line of nl.push(data)) yield [kill, line];
  }

  unregisterExitHandlers();
}
