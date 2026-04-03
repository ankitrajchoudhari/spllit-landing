import { Router, Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../utils/prisma.js';

const router = Router();

const createEarlyAccessSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email(),
  phone: z.string().trim().min(8).max(20),
  message: z.string().trim().max(500).optional().default('')
});

/**
 * GET /api/early-access/status/:email
 * Check whether this email already submitted early access form
 */
router.get('/status/:email', async (req: Request, res: Response) => {
  try {
    const email = decodeURIComponent(req.params.email || '').toLowerCase().trim();
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const existingLead = await prisma.earlyAccess.findUnique({
      where: { email }
    });

    res.json({
      submitted: !!existingLead,
      registration: existingLead || null
    });
  } catch (error) {
    console.error('Early access status check error:', error);
    res.status(500).json({ error: 'Failed to check registration status' });
  }
});

/**
 * POST /api/early-access
 * Register interest for Spllit Social early access
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const data = createEarlyAccessSchema.parse(req.body);

    const normalizedEmail = data.email.toLowerCase();

    const existingLead = await prisma.earlyAccess.findFirst({
      where: { email: normalizedEmail }
    });

    if (existingLead) {
      return res.status(409).json({
        error: 'You have already joined early access with this email.',
        code: 'ALREADY_REGISTERED',
        registration: existingLead
      });
    }

    const registration = await prisma.earlyAccess.create({
      data: {
        name: data.name,
        email: normalizedEmail,
        phone: data.phone,
        message: data.message || null
      }
    });

    res.status(201).json({
      message: 'Early access registration successful',
      registration
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }

    console.error('Early access registration error:', error);
    res.status(500).json({ error: 'Failed to submit registration' });
  }
});

export default router;
