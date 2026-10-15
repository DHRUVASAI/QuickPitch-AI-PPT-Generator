/**
 * Resilience Utility: Timeouts, Retries with Exponential Backoff
 */

export interface RetryOptions {
  /** Maximum number of retry attempts (default: 2) */
  retries?: number;
  /** Timeout in milliseconds per attempt (default: 8000ms) */
  timeoutMs?: number;
  /** Initial delay before first retry in milliseconds (default: 300ms) */
  initialDelayMs?: number;
  /** Multiplier for each subsequent retry (default: 2) */
  backoffFactor?: number;
  /** Name of the operation for logging */
  name?: string;
  /** Custom check whether an error is retryable */
  shouldRetry?: (error: any) => boolean;
}

export class TimeoutError extends Error {
  constructor(name: string, timeoutMs: number) {
    super(`[Timeout] Operation "${name}" exceeded timeout of ${timeoutMs}ms`);
    this.name = 'TimeoutError';
  }
}

/**
 * Executes an async operation with a strict timeout and exponential backoff retries.
 */
export async function withRetryAndTimeout<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    retries = 2,
    timeoutMs = 8000,
    initialDelayMs = 300,
    backoffFactor = 2,
    name = 'operation',
    shouldRetry = () => true,
  } = options;

  let lastError: any = null;
  let delay = initialDelayMs;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    let timer: NodeJS.Timeout | null = null;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new TimeoutError(name, timeoutMs));
      }, timeoutMs);
    });

    try {
      const result = await Promise.race([
        operation(controller.signal),
        timeoutPromise,
      ]);
      if (timer) clearTimeout(timer);
      return result;
    } catch (err: any) {
      if (timer) clearTimeout(timer);

      if (err instanceof TimeoutError || err.name === 'AbortError') {
        lastError = new TimeoutError(name, timeoutMs);
      } else {
        lastError = err;
      }

      if (attempt === retries || !shouldRetry(lastError)) {
        break;
      }

      console.warn(
        `[Retry] "${name}" attempt ${attempt + 1}/${retries + 1} failed: ${lastError.message}. Retrying in ${delay}ms...`
      );

      await new Promise((resolve) => setTimeout(resolve, delay));
      delay *= backoffFactor;
    }
  }

  throw lastError;
}
