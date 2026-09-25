import { Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/helpers.js';
import { AuthRequest } from '../types/express.js';
import { isSuspended, SUSPENDED_MESSAGE } from '../services/suspension.js';

/**
 * Middleware to verify JWT token and attach user to request
 */
export async function authenticate(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'No token provided' });
      return;
    }

    const token = authHeader.substring(7);
    
    const decoded = verifyAccessToken(token);

    if (await isSuspended(decoded.userId)) {
      res.status(403).json({ error: SUSPENDED_MESSAGE, code: 'account-suspended' });
      return;
    }

    req.user = decoded;
    
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
}

/**
 * Optional authentication - doesn't fail if no token
 */
export async function optionalAuth(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const decoded = verifyAccessToken(token);
      if (!(await isSuspended(decoded.userId))) req.user = decoded;
    }
    
    next();
  } catch (error) {
    // Continue without authentication
    next();
  }
}
