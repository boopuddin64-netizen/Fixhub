import type { NextFunction, Request, RequestHandler, Response, Router } from 'express';

/**
 * Express 4 does not catch rejected promises returned by async handlers, which turns any
 * thrown error in an `async` route into an unhandled rejection (and, on modern Node, a process crash).
 * This wraps a single handler so both sync throws and async rejections are forwarded to next(err).
 */
export function wrapHandler(fn: RequestHandler): RequestHandler {
  // Leave error-handling middleware (4 args) untouched.
  if (typeof fn !== 'function' || fn.length === 4) return fn;
  return function wrapped(req: Request, res: Response, next: NextFunction) {
    try {
      const result: any = fn(req, res, next);
      if (result && typeof result.then === 'function') {
        result.then(undefined, next);
      }
    } catch (err) {
      next(err);
    }
  };
}

const METHODS = ['get', 'post', 'put', 'patch', 'delete', 'all', 'use'] as const;

/**
 * Patches a router so every handler registered afterwards through get/post/put/patch/delete/all/use
 * is wrapped with wrapHandler. Call it right after creating the router.
 */
export function makeAsyncSafe<T extends Router>(router: T): T {
  for (const method of METHODS) {
    const original = (router as any)[method].bind(router);
    (router as any)[method] = (...args: any[]) =>
      original(
        ...args.map((arg) => {
          if (typeof arg === 'function') return wrapHandler(arg);
          if (Array.isArray(arg)) return arg.map((a) => (typeof a === 'function' ? wrapHandler(a) : a));
          return arg;
        })
      );
  }
  return router;
}
