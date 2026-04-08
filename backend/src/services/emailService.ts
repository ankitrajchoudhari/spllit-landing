import nodemailer from 'nodemailer';

export interface MailConfig {
  provider: string;
  recipientEmail: string;
  refreshToken?: string;
  apiKey?: string;
  password?: string;
  smtp: string;
  port: number;
}

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
  emailList: string[],
  config: MailConfig,
  subject: string,
  htmlContent: string
): Promise<{ successCount: number; failureCount: number; errors: string[] }> => {
  const transporter = getMailTransporter(config);
  const errors: string[] = [];
  let successCount = 0;
  let failureCount = 0;

  // Light batch processing - send emails sequentially to avoid rate limits
  for (const email of emailList) {
    try {
      await transporter.sendMail({
        from: config.recipientEmail,
        to: email,
        subject,
        html: htmlContent,
        headers: {
          'X-Priority': '3',
          'X-MSMail-Priority': 'Normal',
        },
      });
      successCount++;
    } catch (error) {
      failureCount++;
      const errorMsg = error instanceof Error ? error.message : String(error);
      errors.push(`${email}: ${errorMsg}`);
      // Continue with next email
    }
  }

  return { successCount, failureCount, errors };
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
