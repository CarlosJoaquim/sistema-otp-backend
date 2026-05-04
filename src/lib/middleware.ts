import { NextApiRequest, NextApiResponse } from 'next';

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

const DEFAULT_LIMITS = {
  auth: { max: 10, windowMs: 15 * 60 * 1000 },
  api: { max: 100, windowMs: 15 * 60 * 1000 },
  strict: { max: 5, windowMs: 15 * 60 * 1000 },
};

function getClientIp(req: NextApiRequest): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress || 'unknown';
}

function getKey(req: NextApiRequest, route?: string): string {
  const ip = getClientIp(req);
  return route ? `${ip}:${route}` : ip;
}

function isRateLimited(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || now > entry.resetTime) {
    rateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
    return false;
  }

  if (entry.count >= max) {
    return true;
  }

  entry.count++;
  return false;
}

function cleanupStore() {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}

setInterval(cleanupStore, 15 * 60 * 1000);

export function createRateLimit(options: { max: number; windowMs: number; keyPrefix?: string }) {
  return function rateLimit(req: NextApiRequest, res: NextApiResponse, next: () => void) {
    const key = getKey(req, options.keyPrefix);

    if (isRateLimited(key, options.max, options.windowMs)) {
      const retryAfter = Math.ceil(options.windowMs / 1000);
      res.status(429).json({
        success: false,
        message: 'Muitas tentativas. Aguarde um momento e tente novamente.',
        retryAfter,
      });
      return;
    }

    next();
  };
}

export const authRateLimit = createRateLimit({
  max: DEFAULT_LIMITS.auth.max,
  windowMs: DEFAULT_LIMITS.auth.windowMs,
  keyPrefix: 'auth',
});

export const strictRateLimit = createRateLimit({
  max: DEFAULT_LIMITS.strict.max,
  windowMs: DEFAULT_LIMITS.strict.windowMs,
  keyPrefix: 'strict',
});

export const apiRateLimit = createRateLimit({
  max: DEFAULT_LIMITS.api.max,
  windowMs: DEFAULT_LIMITS.api.windowMs,
});

export function validateWithSchema(schema: any) {
  return function validate(req: NextApiRequest, res: NextApiResponse, next: () => void) {
    try {
      const body = schema.parse(req.body);
      req.body = body;
      next();
    } catch (error: any) {
      if (error.errors) {
        const message = error.errors[0]?.message || 'Dados inválidos';
        res.status(400).json({ success: false, message });
      } else {
        res.status(400).json({ success: false, message: 'Dados inválidos' });
      }
    }
  };
}

export function withMiddleware(handlers: {
  rateLimit?: (req: NextApiRequest, res: NextApiResponse, next: () => void) => void;
  validate?: (req: NextApiRequest, res: NextApiResponse, next: () => void) => void;
  handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void>;
}) {
  return async function handler(req: NextApiRequest, res: NextApiResponse) {
    const middlewareChain: ((req: NextApiRequest, res: NextApiResponse, next: () => void) => void)[] = [];

    if (handlers.rateLimit) {
      middlewareChain.push(handlers.rateLimit);
    }

    if (handlers.validate) {
      middlewareChain.push(handlers.validate);
    }

    let index = 0;

    const next = () => {
      if (index < middlewareChain.length) {
        const middleware = middlewareChain[index++];
        middleware(req, res, next);
      } else {
        handlers.handler(req, res);
      }
    };

    next();
  };
}
