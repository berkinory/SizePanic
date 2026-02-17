class Semaphore {
  private count: number;
  private readonly maxQueue: number;
  private queue: Array<{
    resolve: () => void;
    reject: (error: Error) => void;
    timeout: ReturnType<typeof setTimeout>;
  }> = [];

  constructor(max: number, maxQueue: number) {
    this.count = max;
    this.maxQueue = maxQueue;
  }

  async acquire(timeoutMs = 30_000): Promise<void> {
    if (this.count > 0) {
      this.count--;
      return;
    }

    if (this.queue.length >= this.maxQueue) {
      throw new Error("Queue is full");
    }

    return new Promise<void>((resolve, reject) => {
      const waiter = {
        resolve: () => {
          clearTimeout(waiter.timeout);
          resolve();
        },
        reject: (error: Error) => {
          clearTimeout(waiter.timeout);
          reject(error);
        },
        timeout: setTimeout(() => {
          const index = this.queue.indexOf(waiter);
          if (index !== -1) {
            this.queue.splice(index, 1);
          }
          waiter.reject(new Error("Queue wait timeout"));
        }, timeoutMs),
      };

      this.queue.push(waiter);
    });
  }

  release(): void {
    this.count++;
    const next = this.queue.shift();
    if (next) {
      this.count--;
      next.resolve();
    }
  }
}

export const bundleSemaphore = new Semaphore(10, 100);
