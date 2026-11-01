import { describe, expect, it, vi } from 'vitest';
import { boot } from '../../src/overlay/boot';

describe('boot', () => {
  it('wires quit before any step runs', async () => {
    const order: string[] = [];
    await boot(
      async () => void order.push('quit'),
      [async () => void order.push('a'), async () => void order.push('b')],
      vi.fn(),
    );
    expect(order).toEqual(['quit', 'a', 'b']);
  });

  it('logs a failing step and keeps going', async () => {
    const order: string[] = [];
    const onError = vi.fn();
    const boom = new Error('boom');
    await boot(
      async () => void order.push('quit'),
      [() => Promise.reject(boom), async () => void order.push('b')],
      onError,
    );
    expect(order).toEqual(['quit', 'b']);
    expect(onError).toHaveBeenCalledWith(boom);
  });

  it('logs a step that throws synchronously', async () => {
    const onError = vi.fn();
    await boot(
      async () => {},
      [
        () => {
          throw new Error('sync');
        },
      ],
      onError,
    );
    expect(onError).toHaveBeenCalledTimes(1);
  });
});
