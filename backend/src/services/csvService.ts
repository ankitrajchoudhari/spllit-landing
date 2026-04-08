import { parse } from 'csv-parse/sync';
import * as fs from 'fs';

export interface CsvRecipient {
  email: string;
  name?: string;
}

export const parseCSVRecipients = (filePath: string): CsvRecipient[] => {
  try {
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const withHeaders = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_quotes: true,
      bom: true,
    }) as Record<string, string>[];

    const recipientsFromHeaders: CsvRecipient[] = [];

    for (const record of withHeaders) {
      const email =
        record.email ||
        record.Email ||
        record.EMAIL ||
        record.e_mail ||
        record.E_MAIL ||
        record.user_email ||
        record.userEmail;

      const name =
        record.name ||
        record.Name ||
        record.NAME ||
        record.full_name ||
        record.fullName ||
        record.user_name ||
        record.userName;

      if (email && isValidEmail(String(email).trim())) {
        recipientsFromHeaders.push({
          email: String(email).trim(),
          name: name ? String(name).trim() : undefined,
        });
      }
    }

    if (recipientsFromHeaders.length > 0) {
      return recipientsFromHeaders;
    }

    // Fallback for CSV with no headers: rows like "email" or "email,name"
    const rows = parse(fileContent, {
      columns: false,
      skip_empty_lines: true,
      trim: true,
      relax_quotes: true,
      bom: true,
    }) as string[][];

    const recipients: CsvRecipient[] = [];
    for (const row of rows) {
      const rawEmail = row?.[0] ? String(row[0]).trim() : '';
      const rawName = row?.[1] ? String(row[1]).trim() : undefined;

      if (isValidEmail(rawEmail)) {
        recipients.push({ email: rawEmail, name: rawName || undefined });
      }
    }

    return recipients;
  } catch (error) {
    console.error('CSV parsing error:', error);
    throw new Error('Failed to parse CSV file');
  }
};

export const parseCSVFile = (filePath: string): string[] => {
  return parseCSVRecipients(filePath).map((recipient) => recipient.email);
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
