import { z } from 'zod';

/**
 * A request body that fails validation is the client's mistake, not a server
 * fault, so it is logged as a warning instead of raising an error alert.
 */
export default function logRequestError(filepath: string, error: unknown) {
  if (error instanceof z.ZodError) console.warn(filepath, error.message);
  else console.error(filepath, error);
}
