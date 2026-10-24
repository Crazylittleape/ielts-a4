type WorkerLike = Pick<ServiceWorker, 'state' | 'postMessage' | 'addEventListener'>;
type RegistrationLike = Pick<ServiceWorkerRegistration, 'waiting' | 'installing' | 'addEventListener'>;

/** Calls onReady when a new build is installed and waiting; never on the first install (no controller yet). */
export function watchServiceWorker(reg: RegistrationLike, hasController: () => boolean, onReady: (worker: WorkerLike) => void): void {
  if (reg.waiting && hasController()) onReady(reg.waiting);
  reg.addEventListener('updatefound', () => {
    const worker = reg.installing;
    if (!worker) return;
    worker.addEventListener('statechange', () => { if (worker.state === 'installed' && hasController()) onReady(worker); });
  });
}

export function applyUpdate(worker: WorkerLike): void {
  worker.postMessage({ type: 'SKIP_WAITING' });
}

export const SW_UPDATE_EVENT = 'ielts-a4-sw-update';
