import { Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/helpers.js';
import { AuthRequest } from '../types/express.js';

/**
 * Middleware to verify JWT token and attach user to request
 */
export async function authenticate(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    console.log('=== AUTH MIDDLEWARE ===');
    const authHeader = req.headers.authorization;
    console.log('Auth header:', authHeader ? 'Present' : 'Missing');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('ERROR: No Bearer token in header');
      res.status(401).json({ error: 'No token provided' });
      return;
    }

    const token = authHeader.substring(7);
    console.log('Token extracted, length:', token.length);
    console.log('Token preview:', token.substring(0, 20) + '...');
    
    const decoded = verifyAccessToken(token);
    console.log('Token decoded successfully:', JSON.stringify(decoded, null, 2));
    
    req.user = decoded;
    console.log('User attached to request:', JSON.stringify(req.user, null, 2));
    
    next();
  } catch (error) {
    console.error('=== AUTH ERROR ===');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
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
      req.user = decoded;
    }
    
    next();
  } catch (error) {
    // Continue without authentication
    next();
  }
}
