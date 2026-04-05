import bcrypt from 'bcrypt';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { createHash } from 'crypto';

const SALT_ROUNDS = 10;
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-change-in-production';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'fallback-refresh-secret';

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Compare a plain text password with a hashed password
 */
export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Hash phone number for privacy (one-way hash)
 */
export function hashPhone(phone: string): string {
  const pepper = process.env.PHONE_HASH_PEPPER || process.env.JWT_SECRET || 'spllit-phone-fallback-pepper';
  return createHash('sha256').update(`${pepper}:${phone}`).digest('hex');
}

/**
 * Generate JWT access token
 */
export function generateAccessToken(userId: string, email: string): string {
  const expiresIn = process.env.JWT_EXPIRES_IN || '1h';
  return jwt.sign(
    { userId, email },
    JWT_SECRET,
    { expiresIn: expiresIn as jwt.SignOptions['expiresIn'] }
  );
}

/**
 * Generate JWT refresh token
 */
export function generateRefreshToken(userId: string): string {
  const expiresIn = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
  return jwt.sign(
    { userId },
    JWT_REFRESH_SECRET,
    { expiresIn: expiresIn as jwt.SignOptions['expiresIn'] }
  );
}

/**
 * Verify JWT access token
 */
export function verifyAccessToken(token: string): { userId: string; email: string } {
  try {
    return jwt.verify(token, JWT_SECRET) as { userId: string; email: string };
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
}

/**
 * Verify JWT refresh token
 */
export function verifyRefreshToken(token: string): { userId: string } {
  try {
    return jwt.verify(token, JWT_REFRESH_SECRET) as { userId: string };
  } catch (error) {
    throw new Error('Invalid or expired refresh token');
  }
}

/**
 * Calculate distance between two points using Haversine formula
 * Returns distance in kilometers
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Check if two times are within specified minutes of each other
 */
export function isTimeWithinWindow(
  time1: Date,
  time2: Date,
  windowMinutes: number
): boolean {
  const diffMs = Math.abs(time1.getTime() - time2.getTime());
  const diffMinutes = diffMs / (1000 * 60);
  return diffMinutes <= windowMinutes;
}

/**
 * Sanitize user object (remove sensitive data)
 */
export function sanitizeUser(user: any) {
  const { password, phoneHash, ...sanitized } = user;
  return sanitized;
}
