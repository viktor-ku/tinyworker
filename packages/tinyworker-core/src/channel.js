export class Channel {
  constructor(initial) {
    this.inner = new Map();
    this.rx = new Set();
    this.latest = undefined;

    if (typeof initial !== "undefined") {
      this.tx(initial);
    }
  }

  tx(next) {
    this.inner.set(next, next);
    this.latest = next;

    for (const rx of this.rx) {
      rx({
        next,
        ack: () => {
          this.rx.delete(rx);
          this.inner.delete(next);
          this.latest = undefined;
        },
      });
    }
  }

  recv(receiver) {
    this.rx.add(receiver);

    return () => {
      this.rx.delete(receiver);
    };
  }

  value() {
    if (this.inner.size === 0) {
      return;
    }

    if (this.latest !== undefined) {
      return this.latest;
    }

    for (const val of this.inner.values()) {
      this.latest = val;
    }

    return this.latest;
  }

  close() {
    this.latest = undefined;
    this.rx.clear();
    this.inner.clear();
  }
}
