import nodemailer from 'nodemailer';
import type { CsvRecipient } from './csvService.js';

export interface MailConfig {
  provider: string;
  recipientEmail: string;
  refreshToken?: string;
  apiKey?: string;
  password?: string;
  smtp: string;
  port: number;
}

const applyTemplate = (content: string, recipient: CsvRecipient): string => {
  const safeName = recipient.name?.trim() || 'there';
  const safeEmail = recipient.email.trim();
  return content
    .replaceAll('{{name}}', safeName)
    .replaceAll('{{email}}', safeEmail)
    .replaceAll('{name}', safeName)
    .replaceAll('{email}', safeEmail);
};

export const getMailTransporter = (config: MailConfig) => {
  if (config.provider === 'gmail') {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: config.recipientEmail,
        refreshToken: config.refreshToken,
      },
    });
  }

  if (config.provider === 'zoho') {
    return nodemailer.createTransport({
      host: config.smtp,
      port: config.port,
      secure: config.port === 465,
      auth: {
        user: config.recipientEmail,
        pass: config.password,
      },
    });
  }

  // Fallback generic SMTP
  return nodemailer.createTransport({
    host: config.smtp,
    port: config.port,
    secure: config.port === 465,
    auth: {
      user: config.recipientEmail,
      pass: config.password,
    },
  });
};

export const sendBulkEmails = async (
  recipients: CsvRecipient[],
  config: MailConfig,
  subject: string,
  htmlContent: string
): Promise<{ successCount: number; failureCount: number; errors: string[] }> => {
  const transporter = getMailTransporter(config);
  const errors: string[] = [];
  let successCount = 0;
  let failureCount = 0;

  // Light batch processing - send emails sequentially to avoid rate limits
  for (const recipient of recipients) {
    try {
      await transporter.sendMail({
        from: config.recipientEmail,
        to: recipient.email,
        subject,
        html: applyTemplate(htmlContent, recipient),
        headers: {
          'X-Priority': '3',
          'X-MSMail-Priority': 'Normal',
        },
      });
      successCount++;
    } catch (error) {
      failureCount++;
      const errorMsg = error instanceof Error ? error.message : String(error);
      errors.push(`${recipient.email}: ${errorMsg}`);
      // Continue with next email
    }
  }

  return { successCount, failureCount, errors };
};

export const sendSingleEmail = async (
  recipient: CsvRecipient,
  config: MailConfig,
  subject: string,
  htmlContent: string
): Promise<void> => {
  const transporter = getMailTransporter(config);
  await transporter.sendMail({
    from: config.recipientEmail,
    to: recipient.email,
    subject,
    html: applyTemplate(htmlContent, recipient),
    headers: {
      'X-Priority': '3',
      'X-MSMail-Priority': 'Normal',
    },
  });
};

export const renderMailPreview = (content: string, recipient: CsvRecipient): string => {
  return applyTemplate(content, recipient);
};

export const testMailConnection = async (config: MailConfig): Promise<boolean> => {
  try {
    const transporter = getMailTransporter(config);
    await transporter.verify();
    return true;
  } catch (error) {
    console.error('Mail connection test failed:', error);
    return false;
  }
};
