import { Request } from 'express';

/**
 * Extended Express Request with authenticated user data
 */
export interface AuthRequest extends Request {
  user?: {
    userId: string;
    email: string;
  };
}

/**
 * Extended Express Request with admin authentication
 */
export interface AdminRequest extends Request {
  admin?: {
    id: string;
    email: string;
    role: string;
  };
}
