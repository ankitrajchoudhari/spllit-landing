import { extractVerificationArtifacts, getTaggedInboxAddress, getTestmailConfig, getTestmailInboxAddress, validateVerificationLink, waitForVerificationEmail } from '../services/testmail.js';

type ParsedArgs = {
  tag?: string;
  timeoutMs?: number;
  pollIntervalMs?: number;
  subjectIncludes?: string;
  fromIncludes?: string;
  validateLink: boolean;
};

function parseArgs(argv: string[]): ParsedArgs {
  const parsed: ParsedArgs = {
    validateLink: true
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    if (arg === '--timeout' && next) {
      parsed.timeoutMs = Number(next);
      index += 1;
      continue;
    }

    if (arg === '--tag' && next) {
      parsed.tag = next;
      index += 1;
      continue;
    }

    if (arg === '--interval' && next) {
      parsed.pollIntervalMs = Number(next);
      index += 1;
      continue;
    }

    if (arg === '--subject' && next) {
      parsed.subjectIncludes = next;
      index += 1;
      continue;
    }

    if (arg === '--from' && next) {
      parsed.fromIncludes = next;
      index += 1;
      continue;
    }

    if (arg === '--no-validate-link') {
      parsed.validateLink = false;
    }
  }

  return parsed;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const config = getTestmailConfig();
  const targetInbox = args.tag ? getTaggedInboxAddress(args.tag, config) : getTestmailInboxAddress(config);
  console.log(`Waiting for verification email in ${targetInbox}...`);

  const artifact = await waitForVerificationEmail({
    tag: args.tag,
    timeoutMs: args.timeoutMs,
    pollIntervalMs: args.pollIntervalMs,
    subjectIncludes: args.subjectIncludes,
    fromIncludes: args.fromIncludes,
    config
  });

  const extracted = extractVerificationArtifacts(artifact.message);
  const verificationLink = extracted.verificationLinks[0] || '';
  const otpCode = extracted.otpCodes[0] || '';

  console.log('Verification email found.');
  console.log(`Subject: ${artifact.message.subject || '(no subject)'}`);
  console.log(`From: ${artifact.message.from || '(unknown sender)'}`);

  if (verificationLink) {
    console.log(`Link: ${verificationLink}`);

    if (args.validateLink) {
      const validation = await validateVerificationLink(verificationLink);
      console.log(`Validated: ${validation.status} ${validation.finalUrl}`);
    }
  } else {
    console.log('No verification link found in the email body.');
  }

  if (otpCode) {
    console.log(`OTP: ${otpCode}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});