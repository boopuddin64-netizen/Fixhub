import type { NextFunction, Request, Response } from 'express';

/**
 * Final Express error handler. Client errors raised by middleware (malformed JSON = 400,
 * payload too large = 413, ...) keep their status; everything else is a generic 500 and the
 * internal error message is never sent to the client.
 */
export function globalErrorHandler(err: any, _req: Request, res: Response, next: NextFunction) {
  if (res.headersSent) {
    return next(err);
  }
  const status = Number(err?.status ?? err?.statusCode);
  if (Number.isInteger(status) && status >= 400 && status < 500) {
    const message =
      status === 413 ? 'Request body too large.' : err?.type === 'entity.parse.failed' ? 'Malformed JSON body.' : 'Bad request.';
    return res.status(status).json({ error: message });
  }
  console.error('Unhandled Server Error:', err);
  return res.status(500).json({ error: 'Internal Server Error' });
}

let installed = false;
/**
 * Process-level safety net: an unhandled promise rejection is logged instead of taking the whole
 * server down for every user.
 */
export function installProcessSafeguards() {
  if (installed) return;
  installed = true;
  process.on('unhandledRejection', (reason) => {
    console.error('[unhandledRejection]', reason);
  });
}
