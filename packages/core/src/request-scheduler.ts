export interface RequestScheduler {
  acquire(url: string, signal?: AbortSignal): Promise<() => void>;
  observe(
    url: string,
    status: number,
    retryAfter: string | string[] | undefined,
    /**
     * `ownAgent: false` marks a request sent with another client's
     * User-Agent, as crawler-parity checks do. A 403 to it is that check's
     * finding, not a refusal of the scanner, so it does not stop the host.
     */
    request?: { ownAgent: boolean },
  ): void;
  /** Whether any request to this host's queue got an HTTP status. */
  answered(url: string): boolean;
}
