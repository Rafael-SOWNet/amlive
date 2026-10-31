// AngouriMath runs in a worker, so a long simplification never freezes the page, and a call that
// runs away can be stopped: the worker is terminated and started again.

export function createAngouri(onStatus) {
  let worker, ready;
  const pending = new Map();
  let nextId = 1;

  function start() {
    worker = new Worker(new URL('./am-worker.js', import.meta.url), { type: 'module' });
    ready = new Promise((resolve, reject) => {
      worker.onmessage = ({ data }) => {
        if (data.type === 'progress') onStatus({ state: 'loading', ...data });
        else if (data.type === 'ready') { onStatus({ state: 'ready', ...data }); resolve(); }
        else if (data.type === 'failed') { onStatus({ state: 'failed', error: data.error }); reject(new Error(data.error)); }
        else if (data.type === 'result') {
          const call = pending.get(data.id);
          if (!call) return;
          pending.delete(data.id);
          clearTimeout(call.timer);
          if (data.ok) call.resolve(data.value);
          else call.reject(new Error(data.error));
        }
      };
      worker.onerror = (e) => {
        const message = e.message || 'the worker stopped';
        onStatus({ state: 'failed', error: message });
        reject(new Error(message));
        failAll(`AngouriMath stopped: ${message}`);
      };
    });
    ready.catch(() => {});
  }

  function failAll(reason) {
    for (const call of pending.values()) {
      clearTimeout(call.timer);
      call.reject(new Error(reason));
    }
    pending.clear();
  }

  function restart(reason) {
    worker.terminate();
    failAll(reason);
    onStatus({ state: 'restarting', reason });
    start();
  }

  /** Calls AmLive.<cls>.<method>(...args) in the worker. */
  function call(cls, method, args = [], { timeout = 20000 } = {}) {
    return ready.then(() => new Promise((resolve, reject) => {
      const id = nextId++;
      const timer = setTimeout(() => {
        pending.delete(id);
        const reason = `AngouriMath worked on this for more than ${timeout / 1000} s, so it was stopped and restarted.`;
        reject(new Error(reason));
        restart(reason);
      }, timeout);
      pending.set(id, { resolve, reject, timer });
      worker.postMessage({ id, cls, method, args });
    }));
  }

  start();
  return {
    call,
    /** For the exports that return JSON. */
    json: async (cls, method, args, options) => JSON.parse(await call(cls, method, args, options)),
  };
}
