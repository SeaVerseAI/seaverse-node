import { TimeoutError } from '../errors/TimeoutError.js';

/**
 * Create a timeout promise that rejects after specified milliseconds
 */
export function createTimeoutPromise(timeoutMs: number): {
  promise: Promise<never>;
  cancel: () => void;
} {
  let timeoutId: ReturnType<typeof setTimeout>;

  const promise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new TimeoutError(`Request timeout after ${timeoutMs}ms`, timeoutMs));
    }, timeoutMs);
  });

  const cancel = () => {
    clearTimeout(timeoutId);
  };

  return { promise, cancel };
}

/**
 * Race a promise against a timeout
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number
): Promise<T> {
  const { promise: timeoutPromise, cancel } = createTimeoutPromise(timeoutMs);

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    cancel();
  }
}
