import { parse } from 'csv-parse/sync';
import * as fs from 'fs';

export const parseCSVFile = (filePath: string): string[] => {
  try {
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const records = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    const emails: string[] = [];

    for (const record of records) {
      // Support multiple column names: email, Email, e_mail, etc.
      const email =
        record.email ||
        record.Email ||
        record.EMAIL ||
        record.e_mail ||
        record.E_MAIL ||
        record.user_email ||
        record.userEmail;

      if (email && isValidEmail(email)) {
        emails.push(email);
      }
    }

    return emails;
  } catch (error) {
    console.error('CSV parsing error:', error);
    throw new Error('Failed to parse CSV file');
  }
};

const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const validateEmailList = (emails: string[]): { valid: string[]; invalid: string[] } => {
  const valid: string[] = [];
  const invalid: string[] = [];

  for (const email of emails) {
    if (isValidEmail(email)) {
      valid.push(email);
    } else {
      invalid.push(email);
    }
  }

  return { valid, invalid };
};
