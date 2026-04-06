export type TestmailMessage = {
  id?: string;
  subject?: string;
  from?: string;
  to?: string[] | string;
  text?: string;
  html?: string;
  body?: string;
  created_at?: string;
  received_at?: string;
  timestamp?: string;
  [key: string]: unknown;
};

export type VerificationArtifact = {
  message: TestmailMessage;
  verificationLinks: string[];
  otpCodes: string[];
};

export type TestmailInboxConfig = {
  apiKey: string;
  namespace: string;
  mailbox?: string;
  baseUrl: string;
};

const DEFAULT_BASE_URL = 'https://api.testmail.app/api/json';

export function getTestmailConfig(overrides: Partial<TestmailInboxConfig> = {}): TestmailInboxConfig {
  const apiKey = overrides.apiKey || process.env.TESTMAIL_API_KEY || '';
  const namespace = overrides.namespace || process.env.TESTMAIL_NAMESPACE || '';
  const mailbox = overrides.mailbox || process.env.TESTMAIL_MAILBOX || undefined;
  const baseUrl = overrides.baseUrl || process.env.TESTMAIL_BASE_URL || DEFAULT_BASE_URL;

  return { apiKey, namespace, mailbox, baseUrl };
}

export function hasTestmailConfig(config: TestmailInboxConfig): boolean {
  return Boolean(config.apiKey && config.namespace);
}

export function getTestmailInboxAddress(config = getTestmailConfig()): string {
  if (config.mailbox) {
    return `${config.mailbox}@${config.namespace}.testmail.app`;
  }

  return `${config.namespace}.testmail.app`;
}

export function getTaggedInboxAddress(tag: string, config = getTestmailConfig()): string {
  return `${config.namespace}.${tag}@inbox.testmail.app`;
}

function normalizeMessageBody(message: TestmailMessage): string {
  return [message.subject, message.text, message.html, message.body]
    .filter(Boolean)
    .map((value) => String(value))
    .join('\n');
}

function extractVerificationLinks(text: string): string[] {
  const matches = text.match(/https?:\/\/[\w\-._~:/?#[\]@!$&'()*+,;=%]+/gi) || [];
  return Array.from(new Set(matches.map((url) => url.replace(/[),.]+$/g, ''))));
}

function extractOtpCodes(text: string): string[] {
  const matches = text.match(/(?<!\d)\d{4,8}(?!\d)/g) || [];
  return Array.from(new Set(matches));
}

export function extractVerificationArtifacts(message: TestmailMessage): VerificationArtifact {
  const body = normalizeMessageBody(message);
  return {
    message,
    verificationLinks: extractVerificationLinks(body),
    otpCodes: extractOtpCodes(body)
  };
}

function isProbablyVerificationEmail(message: TestmailMessage, subjectIncludes?: string, fromIncludes?: string): boolean {
  const subject = String(message.subject || '').toLowerCase();
  const from = String(message.from || '').toLowerCase();

  const subjectMatch = subjectIncludes ? subject.includes(subjectIncludes.toLowerCase()) : /verify|verification|confirm|account/i.test(subject);
  const fromMatch = fromIncludes ? from.includes(fromIncludes.toLowerCase()) : true;

  return subjectMatch && fromMatch;
}

function toMessageArray(response: unknown): TestmailMessage[] {
  if (Array.isArray(response)) {
    return response as TestmailMessage[];
  }

  if (!response || typeof response !== 'object') {
    return [];
  }

  const record = response as Record<string, unknown>;
  const candidate = record.messages || record.emails || record.data || record.results || record.items;

  return Array.isArray(candidate) ? (candidate as TestmailMessage[]) : [];
}

export async function fetchTestmailMessages(options: {
  tag?: string;
  mailbox?: string;
  config?: Partial<TestmailInboxConfig>;
} = {}): Promise<TestmailMessage[]> {
  const config = getTestmailConfig(options.config);

  if (!hasTestmailConfig(config)) {
    throw new Error('Missing Testmail configuration. Set TESTMAIL_API_KEY and TESTMAIL_NAMESPACE.');
  }

  const tag = options.tag || config.mailbox || options.mailbox;

  const url = new URL(config.baseUrl);
  url.searchParams.set('apikey', config.apiKey);
  url.searchParams.set('namespace', config.namespace);

  if (tag) {
    // Testmail tag-based query supports multiple flows like signup/otp without env rewrites.
    url.searchParams.set('tag', tag);
  } else if (config.mailbox) {
    url.searchParams.set('mailbox', config.mailbox);
  }

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      accept: 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Testmail request failed with status ${response.status}`);
  }

  const payload = await response.json();
  return toMessageArray(payload);
}

export async function waitForVerificationEmail(options: {
  tag?: string;
  timeoutMs?: number;
  pollIntervalMs?: number;
  subjectIncludes?: string;
  fromIncludes?: string;
  mailbox?: string;
  config?: Partial<TestmailInboxConfig>;
} = {}): Promise<VerificationArtifact> {
  const config = getTestmailConfig(options.config);
  const timeoutMs = options.timeoutMs ?? Number(process.env.TESTMAIL_TIMEOUT_MS || 120000);
  const pollIntervalMs = options.pollIntervalMs ?? Number(process.env.TESTMAIL_POLL_INTERVAL_MS || 5000);
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const messages = await fetchTestmailMessages({
      tag: options.tag,
      mailbox: options.mailbox,
      config
    });
    const latestMatch = messages.find((message) => isProbablyVerificationEmail(message, options.subjectIncludes, options.fromIncludes));

    if (latestMatch) {
      return extractVerificationArtifacts(latestMatch);
    }

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  throw new Error(`Timed out after ${Math.round(timeoutMs / 1000)} seconds waiting for a Testmail verification email.`);
}

export async function validateVerificationLink(url: string): Promise<{ finalUrl: string; status: number; contentType: string | null }> {
  const response = await fetch(url, {
    method: 'GET',
    redirect: 'follow',
    headers: {
      accept: 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8'
    }
  });

  return {
    finalUrl: response.url,
    status: response.status,
    contentType: response.headers.get('content-type')
  };
}