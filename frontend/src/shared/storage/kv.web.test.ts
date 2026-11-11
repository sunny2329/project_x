import { kv } from './kv.web';

/** A minimal localStorage (the test environment is React Native's, which has none). */
class MemoryStorage {
  map = new Map<string, string>();
  getItem(k: string) {
    return this.map.has(k) ? this.map.get(k)! : null;
  }
  setItem(k: string, v: string) {
    this.map.set(k, String(v));
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
}

const win = window as unknown as { localStorage?: unknown };
let storage: MemoryStorage;
beforeEach(() => {
  storage = new MemoryStorage();
  Object.defineProperty(win, 'localStorage', { value: storage, configurable: true, writable: true });
});
afterAll(() => {
  delete win.localStorage;
});

describe('kv (web)', () => {
  it('stores, reads and removes values in localStorage', async () => {
    expect(await kv.get('a')).toBeNull();
    await kv.set('a', '1');
    expect(storage.getItem('a')).toBe('1');
    expect(await kv.get('a')).toBe('1');
    await kv.remove('a');
    expect(await kv.get('a')).toBeNull();
  });

  it('blocked or full storage never throws: reads miss, writes are dropped', async () => {
    const boom = () => {
      throw new Error('SecurityError');
    };
    Object.assign(storage, { getItem: boom, setItem: boom, removeItem: boom });
    await expect(kv.get('a')).resolves.toBeNull();
    await expect(kv.set('a', '1')).resolves.toBeUndefined();
    await expect(kv.remove('a')).resolves.toBeUndefined();
  });

  it('a browser that refuses access to localStorage at all is a quiet miss', async () => {
    Object.defineProperty(win, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('SecurityError');
      },
    });
    await expect(kv.get('a')).resolves.toBeNull();
    await expect(kv.set('a', '1')).resolves.toBeUndefined();
  });
});
