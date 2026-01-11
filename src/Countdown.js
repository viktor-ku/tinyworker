export class Countdown {
  constructor(durationMs, callback) {
    this.duration = durationMs;
    this.timer = null;
  }

  isRunning() {
    return !!this.timer;
  }

  /**
   * Starts the countdown if none are currently running. Stops
   * the previous one otherwise and starts a new one.
   */
  restart() {
    return this.stop().start();
  }

  /**
   * Starts the countdown, but only if there isn't one already running
   */
  start() {
    if (this.timer) {
      return this;
    }

    this.timer = setTimeout(() => {
      queueMicrotask(() => {
        this.stop();
        this.callback();
      });
    }, this.duration);

    return this;
  }

  /**
   * Stops the countdown
   */
  stop() {
    if (!this.timer) {
      return this;
    }

    clearTimeout(this.timer);
    this.timer = null;

    return this;
  }

  onTimeout(callback) {
    this.callback = callback;
    return this;
  }
}
