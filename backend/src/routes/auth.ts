import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { randomBytes } from 'crypto';
import prisma from '../utils/prisma.js';
import { hashPassword, comparePassword, hashPhone, generateAccessToken, generateRefreshToken, sanitizeUser } from '../utils/helpers.js';
import { io } from '../server.js';
import { isFirebaseAdminConfigured, verifyFirebaseIdToken } from '../utils/firebaseAdmin.js';

const router = Router();

// Validation schemas
const registerSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  phone: z.string().regex(/^\+?[1-9]\d{9,14}$/).optional(),
  password: z.string().min(6),
  college: z.string().min(2),
  gender: z.enum(['male', 'female', 'other', 'MALE', 'FEMALE', 'OTHER', 'Male', 'Female', 'Other'])
    .transform(val => val.toLowerCase())
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string()
});

const googleLoginSchema = z.object({
  idToken: z.string().min(1)
});

const firebaseLoginSchema = z.object({
  idToken: z.string().min(1)
});

const syncFirebaseUser = async (idToken: string, res: Response) => {
  if (!isFirebaseAdminConfigured()) {
    return res.status(500).json({ error: 'Firebase sign-in is not configured on server' });
  }

  const payload = await verifyFirebaseIdToken(idToken);
  if (!payload?.email) {
    return res.status(401).json({ error: 'Invalid Firebase token' });
  }

  const emailVerified = Boolean(payload.email_verified || payload.emailVerified);
  if (!emailVerified) {
    return res.status(403).json({ error: 'Please verify your email before signing in' });
  }

  const email = payload.email.toLowerCase();
  const name = payload.name || payload.picture?.split('/')?.slice(-1)?.[0] || email.split('@')[0];
  const avatarUrl = payload.picture || null;

  let user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    const randomPassword = randomBytes(24).toString('hex');
    const hashedPassword = await hashPassword(randomPassword);
    const placeholderPhoneSeed = `+91${Math.floor(1000000000 + Math.random() * 9000000000)}-${email}`;

    user = await prisma.user.create({
      data: {
        name,
        email,
        phone: null,
        phoneHash: hashPhone(placeholderPhoneSeed),
        password: hashedPassword,
        college: 'IIT Madras (BS Degree)',
        gender: 'other',
        emailVerified: true,
        profilePhoto: avatarUrl
      }
    });

    io.emit('new-user-registered', {
      name: user.name,
      college: user.college,
      email: user.email,
      timestamp: user.createdAt
    });
  } else {
    if (user.role === 'subadmin' || user.role === 'admin') {
      if (user.adminStatus === 'inactive') {
        return res.status(403).json({ error: 'Your account has been deactivated. Please contact the administrator.' });
      }
      if (user.adminStatus === 'deleted') {
        return res.status(403).json({ error: 'This account no longer exists.' });
      }
      if (!user.isActive) {
        return res.status(403).json({ error: 'Your account is not active. Please contact the administrator.' });
      }
    }

    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        lastSeen: new Date(),
        emailVerified: true,
        ...(avatarUrl ? { profilePhoto: avatarUrl } : {})
      }
    });
  }

  const accessToken = generateAccessToken(user.id, user.email);
  const refreshToken = generateRefreshToken(user.id);

  return res.json({
    message: 'Firebase login successful',
    user: sanitizeUser(user),
    tokens: {
      accessToken,
      refreshToken
    }
  });
};

/**
 * POST /api/auth/register
 * Register a new user
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    const data = registerSchema.parse(req.body);
    const normalizedEmail = data.email.toLowerCase().trim();
    const normalizedPhone = data.phone?.trim();
    const normalizedPhoneHash = normalizedPhone ? hashPhone(normalizedPhone) : null;
    
    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: normalizedEmail },
          ...(normalizedPhoneHash ? [{ phoneHash: normalizedPhoneHash }] : []),
          ...(normalizedPhone ? [{ phone: normalizedPhone }] : [])
        ]
      }
    });

    if (existingUser) {
      return res.status(400).json({ error: 'User already exists with this email or phone' });
    }

    // Create user
    const hashedPassword = await hashPassword(data.password);
    const hashedPhone = normalizedPhone ? hashPhone(normalizedPhone) : hashPhone(`placeholder:${normalizedEmail}`);

    const user = await prisma.user.create({
      data: {
        name: data.name,
        email: normalizedEmail,
        phone: normalizedPhone || null,
        phoneHash: hashedPhone,
        password: hashedPassword,
        college: data.college,
        gender: data.gender
      }
    });

    // Emit Socket.IO event for new user registration
    io.emit('new-user-registered', {
      name: user.name,
      college: user.college,
      email: user.email,
      timestamp: user.createdAt
    });

    // Generate tokens
    const accessToken = generateAccessToken(user.id, user.email);
    const refreshToken = generateRefreshToken(user.id);

    res.status(201).json({
      message: 'User registered successfully',
      user: sanitizeUser(user),
      tokens: {
        accessToken,
        refreshToken
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Failed to register user' });
  }
});

/**
 * POST /api/auth/login
 * Login user
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const data = loginSchema.parse(req.body);

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: data.email }
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Verify password
    const isValidPassword = await comparePassword(data.password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Check if user is active (for subadmins and admins)
    if (user.role === 'subadmin' || user.role === 'admin') {
      if (user.adminStatus === 'inactive') {
        return res.status(403).json({ error: 'Your account has been deactivated. Please contact the administrator.' });
      }
      if (user.adminStatus === 'deleted') {
        return res.status(403).json({ error: 'This account no longer exists.' });
      }
      if (!user.isActive) {
        return res.status(403).json({ error: 'Your account is not active. Please contact the administrator.' });
      }
    }

    // Update last seen
    await prisma.user.update({
      where: { id: user.id },
      data: { lastSeen: new Date() }
    });

    // Generate tokens
    const accessToken = generateAccessToken(user.id, user.email);
    const refreshToken = generateRefreshToken(user.id);

    res.json({
      message: 'Login successful',
      user: sanitizeUser(user),
      tokens: {
        accessToken,
        refreshToken
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    console.error('Login error:', error);
    res.status(500).json({ error: 'Failed to login' });
  }
});

/**
 * POST /api/auth/google
 * Login/register user via Google OAuth id token
 */
router.post('/google', async (req: Request, res: Response) => {
  try {
    const { idToken } = googleLoginSchema.parse(req.body);
    return await syncFirebaseUser(idToken, res);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    console.error('Google login error:', error);
    res.status(401).json({ error: 'Google authentication failed' });
  }
});

/**
 * POST /api/auth/firebase
 * Login/register user via Firebase email/password or Google id token
 */
router.post('/firebase', async (req: Request, res: Response) => {
  try {
    const { idToken } = firebaseLoginSchema.parse(req.body);
    return await syncFirebaseUser(idToken, res);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    console.error('Firebase login error:', error);
    res.status(401).json({ error: 'Firebase authentication failed' });
  }
});

/**
 * POST /api/auth/refresh
 * Refresh access token using refresh token
 */
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token required' });
    }

    // Verify refresh token
    const decoded = require('../utils/helpers.js').verifyRefreshToken(refreshToken);

    // Get user
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId }
    });

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Generate new tokens
    const newAccessToken = generateAccessToken(user.id, user.email);
    const newRefreshToken = generateRefreshToken(user.id);

    res.json({
      tokens: {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken
      }
    });
  } catch (error) {
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});

export default router;
