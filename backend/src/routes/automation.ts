import { Router, Response } from 'express';
import { AdminRequest } from '../types/express.js';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import prisma from '../utils/prisma.js';
import { generateMessageFromPrompt } from '../services/aiService.js';
import { sendBulkEmails, testMailConnection } from '../services/emailService.js';
import { parseCSVFile } from '../services/csvService.js';

const router = Router();
const db = prisma as any;

// Setup multer for CSV upload
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

const authenticateAdmin = async (req: AdminRequest, res: Response, next: any) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Admin authentication required' });
    }

    const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);

    if (decoded.adminId) {
      const admin = await prisma.admin.findUnique({ where: { id: decoded.adminId } });
      if (!admin || !admin.isActive) {
        return res.status(401).json({ error: 'Invalid admin credentials' });
      }
      req.admin = { id: admin.id, email: admin.email, role: admin.role };
      return next();
    }

    if (decoded.userId) {
      const subadmin = await prisma.user.findUnique({ where: { id: decoded.userId } });
      if (!subadmin || subadmin.role !== 'subadmin' || !subadmin.isAdmin) {
        return res.status(401).json({ error: 'Invalid admin credentials' });
      }
      if (subadmin.adminStatus !== 'active' || !subadmin.isActive) {
        return res.status(403).json({ error: 'Subadmin account is not active' });
      }
      req.admin = { id: subadmin.id, email: subadmin.email, role: subadmin.role };
      return next();
    }

    return res.status(401).json({ error: 'Invalid admin token' });
  } catch (error) {
    console.error('Automation admin auth error:', error);
    return res.status(401).json({ error: 'Invalid admin token' });
  }
};

// Get all mail providers
router.get('/providers', authenticateAdmin, async (_req: AdminRequest, res: Response) => {
  try {
    const providers = await db.mailProvider.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        recipientEmail: true,
      },
    });

    res.json(providers);
  } catch (error) {
    console.error('Error fetching providers:', error);
    res.status(500).json({ error: 'Failed to fetch mail providers' });
  }
});

// Create/Update mail provider
router.post('/providers', authenticateAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const { name, recipientEmail, refreshToken, apiKey, password, smtp, port } = req.body;

    // Validate input
    if (!name || !recipientEmail || !smtp) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const provider = await db.mailProvider.upsert({
      where: { recipientEmail },
      update: {
        smtp,
        port: port || 587,
        refreshToken,
        apiKey,
        password,
        isActive: true,
      },
      create: {
        name,
        recipientEmail,
        smtp,
        port: port || 587,
        refreshToken,
        apiKey,
        password,
        isActive: true,
      },
    });

    res.json({ message: 'Mail provider saved', provider });
  } catch (error) {
    console.error('Error saving provider:', error);
    res.status(500).json({ error: 'Failed to save mail provider' });
  }
});

// Test mail provider connection
router.post('/providers/:id/test', authenticateAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const provider = await db.mailProvider.findUnique({
      where: { id: req.params.id },
    });

    if (!provider) {
      return res.status(404).json({ error: 'Provider not found' });
    }

    const isConnected = await testMailConnection({
      provider: provider.name,
      recipientEmail: provider.recipientEmail,
      refreshToken: provider.refreshToken || undefined,
      apiKey: provider.apiKey || undefined,
      password: provider.password || undefined,
      smtp: provider.smtp,
      port: provider.port,
    });

    res.json({
      connected: isConnected,
      message: isConnected ? 'Connection successful' : 'Connection failed',
    });
  } catch (error) {
    console.error('Error testing provider:', error);
    res.status(500).json({ error: 'Failed to test mail provider' });
  }
});

// Send bulk automation emails
router.post('/send-bulk', authenticateAdmin, upload.single('csvFile'), async (req: AdminRequest, res: Response) => {
  let csvFilePath: string | null = null;

  try {
    const { prompt, providerId, subject } = req.body;
    const file = (req as any).file;
    if (!prompt || !providerId || !subject || !file) {
      return res.status(400).json({ error: 'Missing required fields: prompt, providerId, subject, csvFile' });
    }

    csvFilePath = file.path;
    const adminId = req.admin?.id || 'unknown';

    // Get mail provider
    const provider = await db.mailProvider.findUnique({
      where: { id: providerId },
    });

    if (!provider) {
      return res.status(404).json({ error: 'Mail provider not found' });
    }

    // Create campaign record (status: processing)
    const campaign = await db.automationMail.create({
      data: {
        adminId,
        providerName: provider.name,
        subject,
        prompt,
        generatedMessage: 'Generating...',
        recipientCount: 0,
        status: 'processing',
        csvFilePath,
      },
    });

    // Parse CSV
    const emails = parseCSVFile(csvFilePath);
    if (emails.length === 0) {
      throw new Error('No valid emails found in CSV');
    }

    // Generate message from prompt using AI
    const generatedMessage = await generateMessageFromPrompt(prompt);

    // Send bulk emails
    const { successCount, failureCount, errors } = await sendBulkEmails(
      emails,
      {
        provider: provider.name,
        recipientEmail: provider.recipientEmail,
        refreshToken: provider.refreshToken || undefined,
        apiKey: provider.apiKey || undefined,
        password: provider.password || undefined,
        smtp: provider.smtp,
        port: provider.port,
      },
      subject,
      generatedMessage
    );

    // Update campaign record
    const updatedCampaign = await db.automationMail.update({
      where: { id: campaign.id },
      data: {
        generatedMessage,
        recipientCount: emails.length,
        successCount,
        failureCount,
        status: failureCount === 0 ? 'completed' : 'completed',
        errorLog: errors.length > 0 ? JSON.stringify(errors.slice(0, 10)) : null, // Store first 10 errors
        completedAt: new Date(),
      },
    });

    res.json({
      message: 'Email campaign sent',
      campaign: updatedCampaign,
      summary: {
        total: emails.length,
        successCount,
        failureCount,
        errorCount: errors.length,
      },
    });

    // Cleanup CSV file after processing
    if (fs.existsSync(csvFilePath)) {
      fs.unlink(csvFilePath, (err) => {
        if (err) console.error('Error deleting temp CSV:', err);
      });
    }
  } catch (error) {
    console.error('Error sending bulk emails:', error);

    // Cleanup on error
    if (csvFilePath && fs.existsSync(csvFilePath)) {
      fs.unlink(csvFilePath, (err) => {
        if (err) console.error('Error deleting temp CSV:', err);
      });
    }

    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to send bulk emails',
    });
  }
});

// Get campaign history
router.get('/campaigns', authenticateAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const adminId = req.admin?.id;
    const campaigns = await db.automationMail.findMany({
      where: adminId ? { adminId } : {},
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    res.json(campaigns);
  } catch (error) {
    console.error('Error fetching campaigns:', error);
    res.status(500).json({ error: 'Failed to fetch campaigns' });
  }
});

export default router;
