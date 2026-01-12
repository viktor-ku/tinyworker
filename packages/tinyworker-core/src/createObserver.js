export function createObserver(initial) {
  let val = initial;

  const isContainer = Array.isArray(val);
  const listeners = new Set();

  function notify(next) {
    if (isContainer) {
      val.push(next);
    } else {
      if (val === next) {
        return;
      }

      val = next;
    }

    for (const listener of listeners) {
      listener(next);
    }
  }

  function subscribe(listener) {
    listeners.add(listener);

    return () => {
      listeners.delete(listener);
    };
  }

  function self() {
    return val;
  }

  self.notify = notify;
  self.subscribe = subscribe;

  return self;
}
