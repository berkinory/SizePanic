class Semaphore {
  private count: number;
  private queue: Array<() => void> = [];

  constructor(max: number) {
    this.count = max;
  }

  async acquire(): Promise<void> {
    if (this.count > 0) {
      this.count--;
      return;
    }

    return new Promise<void>((resolve) => {
      this.queue.push(resolve);
    });
  }

  release(): void {
    this.count++;
    const next = this.queue.shift();
    if (next) {
      this.count--;
      next();
    }
  }
}

import { MAX_BUNDLE_CONCURRENCY } from "./constants";

export const bundleSemaphore = new Semaphore(MAX_BUNDLE_CONCURRENCY);
