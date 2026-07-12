type Sleep = (milliseconds: number) => Promise<unknown>;

export class AccountSendLimiter {
  readonly #lastAttemptAt = new Map<string, number>();
  readonly #queues = new Map<string, Promise<void>>();

  constructor(
    private readonly now: () => number,
    private readonly sleep: Sleep,
  ) {}

  async run<T>(accountId: string, minimumIntervalMs: number, attempt: () => Promise<T>): Promise<T> {
    const previous = this.#queues.get(accountId) ?? Promise.resolve();
    let release: () => void = () => undefined;
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.#queues.set(accountId, current);

    try {
      await previous;
      const lastAttemptAt = this.#lastAttemptAt.get(accountId);
      if (lastAttemptAt !== undefined) {
        const remainingMs = minimumIntervalMs - (this.now() - lastAttemptAt);
        if (remainingMs > 0) {
          await this.sleep(remainingMs);
        }
      }

      this.#lastAttemptAt.set(accountId, this.now());
      return await attempt();
    } finally {
      release();
      if (this.#queues.get(accountId) === current) {
        this.#queues.delete(accountId);
      }
    }
  }
}
