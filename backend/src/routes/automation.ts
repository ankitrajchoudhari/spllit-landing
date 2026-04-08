import { Router, Response } from 'express';
import { AdminRequest } from '../types/express.js';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import prisma from '../utils/prisma.js';
import { generateMessageFromPrompt } from '../services/aiService.js';
import { sendBulkEmails, sendSingleEmail, testMailConnection, renderMailPreview } from '../services/emailService.js';
import { parseCSVRecipients } from '../services/csvService.js';

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
    const { prompt, message, providerId, subject, aiMode } = req.body;
    const file = (req as any).file;
    const useAI = String(aiMode || 'yes') === 'yes';
    if (!providerId || !subject || !file) {
      return res.status(400).json({ error: 'Missing required fields: providerId, subject, csvFile' });
    }

    if (useAI && !prompt) {
      return res.status(400).json({ error: 'Prompt is required when AI mode is enabled' });
    }

    if (!useAI && !message) {
      return res.status(400).json({ error: 'Message is required when AI mode is disabled' });
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
        prompt: useAI ? prompt : '',
        generatedMessage: 'Generating...',
        recipientCount: 0,
        status: 'processing',
        csvFilePath,
      },
    });

    // Parse CSV
    const recipients = parseCSVRecipients(csvFilePath);
    if (recipients.length === 0) {
      throw new Error('No valid emails found in CSV');
    }

    // Generate message from prompt using AI or use manual message
    const generatedMessage = useAI
      ? await generateMessageFromPrompt(prompt)
      : String(message);

    // Send bulk emails
    const { successCount, failureCount, errors } = await sendBulkEmails(
      recipients,
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
        recipientCount: recipients.length,
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
        total: recipients.length,
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

// Preview generated email content (AI/manual) for a target recipient
router.post('/preview', authenticateAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const { prompt, message, aiMode, recipientEmail, recipientName, subject, providerId } = req.body;
    const useAI = String(aiMode || 'yes') === 'yes';

    if (!providerId || !subject) {
      return res.status(400).json({ error: 'Missing required fields: providerId, subject' });
    }

    if (useAI && !prompt) {
      return res.status(400).json({ error: 'Prompt is required when AI mode is enabled' });
    }

    if (!useAI && !message) {
      return res.status(400).json({ error: 'Message is required when AI mode is disabled' });
    }

    const provider = await db.mailProvider.findUnique({ where: { id: providerId } });
    if (!provider) {
      return res.status(404).json({ error: 'Mail provider not found' });
    }

    const baseContent = useAI ? await generateMessageFromPrompt(prompt) : String(message);
    const previewRecipient = {
      email: String(recipientEmail || 'sample.user@example.com'),
      name: recipientName ? String(recipientName) : 'Sample User',
    };

    const previewHtml = renderMailPreview(baseContent, previewRecipient);
    return res.json({
      preview: {
        from: provider.recipientEmail,
        to: previewRecipient.email,
        subject,
        body: previewHtml,
      },
      generatedMessage: baseContent,
    });
  } catch (error) {
    console.error('Error creating preview:', error);
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to generate preview' });
  }
});

// Send single automation email
router.post('/send-single', authenticateAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const { prompt, message, providerId, subject, recipientEmail, recipientName, aiMode } = req.body;
    const useAI = String(aiMode || 'yes') === 'yes';

    if (!providerId || !subject || !recipientEmail) {
      return res.status(400).json({ error: 'Missing required fields: providerId, subject, recipientEmail' });
    }

    if (useAI && !prompt) {
      return res.status(400).json({ error: 'Prompt is required when AI mode is enabled' });
    }

    if (!useAI && !message) {
      return res.status(400).json({ error: 'Message is required when AI mode is disabled' });
    }

    const provider = await db.mailProvider.findUnique({ where: { id: providerId } });
    if (!provider) {
      return res.status(404).json({ error: 'Mail provider not found' });
    }

    const generatedMessage = useAI ? await generateMessageFromPrompt(prompt) : String(message);
    const recipient = {
      email: String(recipientEmail).trim(),
      name: recipientName ? String(recipientName).trim() : undefined,
    };

    await sendSingleEmail(
      recipient,
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

    return res.json({
      message: 'Single email sent successfully',
      summary: {
        to: recipient.email,
        from: provider.recipientEmail,
        subject,
      },
    });
  } catch (error) {
    console.error('Error sending single email:', error);
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to send single email' });
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
