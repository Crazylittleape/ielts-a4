import code from '../public/sw.js?raw';
import { describe, expect, it, vi } from 'vitest';
import { applyUpdate, watchServiceWorker } from './pwa';

type Listener = (event: any) => void;
function loadWorker(cacheKeys: string[]) {
  const listeners: Record<string, Listener> = {};
  const self = { location: { href: 'https://example.com/ielts-a4/sw.js' }, addEventListener: (t: string, fn: Listener) => { listeners[t] = fn; }, skipWaiting: vi.fn(), clients: { claim: vi.fn(() => Promise.resolve()) } };
  const deleted: string[] = [];
  const caches = { keys: () => Promise.resolve(cacheKeys), delete: (k: string) => { deleted.push(k); return Promise.resolve(true); }, open: vi.fn(() => Promise.resolve({ addAll: () => Promise.resolve() })) };
  const cache = new Function('self', 'caches', 'fetch', `${code}\nreturn CACHE;`)(self, caches, vi.fn()) as string;
  return { listeners, self, deleted, cache };
}

describe('service worker update', () => {
  it('activates a waiting update only when the page asks for it', () => {
    const { listeners, self } = loadWorker([]);
    listeners.message({ data: { type: 'other' } });
    expect(self.skipWaiting).not.toHaveBeenCalled();
    listeners.message({ data: { type: 'SKIP_WAITING' } });
    expect(self.skipWaiting).toHaveBeenCalledTimes(1);
  });
  it('install never skips waiting by itself, so an open session is not swapped mid-review', () => {
    const { listeners, self } = loadWorker([]);
    listeners.install({ waitUntil: () => undefined });
    expect(self.skipWaiting).not.toHaveBeenCalled();
  });
  it('activate deletes only this app’s older caches', async () => {
    let done: Promise<unknown> = Promise.resolve();
    const probe = loadWorker([]);
    const { listeners, deleted } = loadWorker(['ielts-a4-old-1', probe.cache, 'someone-else']);
    listeners.activate({ waitUntil: (p: Promise<unknown>) => { done = p; } });
    await done;
    expect(deleted).toEqual(['ielts-a4-old-1']);
  });
});

function fakeWorker(state = 'installing') {
  const handlers: Listener[] = [];
  return { state, postMessage: vi.fn(), addEventListener: (_: string, fn: Listener) => handlers.push(fn), fire(next: string) { this.state = next; handlers.forEach(h => h({})); } };
}
function fakeRegistration(waiting: unknown = null) {
  const handlers: Listener[] = [];
  return { waiting, installing: null as unknown, addEventListener: (_: string, fn: Listener) => handlers.push(fn), found(worker: unknown) { this.installing = worker; handlers.forEach(h => h({})); } };
}

describe('update prompt detection', () => {
  it('a session that started on the first install still gets prompted for a later update', () => {
    const onReady = vi.fn();
    let controlled = false;
    const reg = fakeRegistration();
    watchServiceWorker(reg as never, () => controlled, onReady);
    const first = fakeWorker(); reg.found(first); first.fire('installed');
    expect(onReady).not.toHaveBeenCalled();
    controlled = true;
    const next = fakeWorker(); reg.found(next); next.fire('installed');
    expect(onReady).toHaveBeenCalledWith(next);
  });
  it('offers an update already waiting from an earlier visit', () => {
    const waiting = fakeWorker('installed');
    const onReady = vi.fn();
    watchServiceWorker(fakeRegistration(waiting) as never, () => true, onReady);
    expect(onReady).toHaveBeenCalledWith(waiting);
  });
  it('does not prompt on the very first install (nothing to update from)', () => {
    const onReady = vi.fn();
    const reg = fakeRegistration(fakeWorker('installed'));
    watchServiceWorker(reg as never, () => false, onReady);
    const w = fakeWorker(); reg.found(w); w.fire('installed');
    expect(onReady).not.toHaveBeenCalled();
  });
  it('prompts once a newly found worker finishes installing, and applyUpdate asks it to take over', () => {
    const onReady = vi.fn();
    const reg = fakeRegistration();
    watchServiceWorker(reg as never, () => true, onReady);
    const w = fakeWorker(); reg.found(w);
    expect(onReady).not.toHaveBeenCalled();
    w.fire('installed');
    expect(onReady).toHaveBeenCalledWith(w);
    applyUpdate(w as never);
    expect(w.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
  });
});
