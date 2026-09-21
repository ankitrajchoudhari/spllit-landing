/**
 * Legal copy.
 *
 * Written against what this codebase actually does — every clause below maps to
 * a real behaviour (a Prisma field, a route, a middleware), not to a template.
 * Where a feature is planned but not built, it says so rather than reserving
 * rights over something that does not exist.
 *
 * This is not legal advice and has not been reviewed by a lawyer. It still
 * needs someone qualified in Indian consumer, IT and data-protection law — the
 * DPDP Act 2023 and the IT (Intermediary Guidelines) Rules 2021 in particular
 * — and that review becomes urgent the moment SQUAD_JOIN_PAYMENT_ENABLED is
 * turned on, because charging makes every join a consumer transaction under
 * the Consumer Protection Act 2019.
 *
 * The Terms previously stated "there is no payment provider connected to this
 * service today" while Razorpay was live in the codebase. A published legal
 * document that contradicts what the software does is worse than no document,
 * so when payment behaviour changes, this file changes in the same commit.
 */

export const LEGAL_UPDATED = '8 August 2026';

export interface LegalSection {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
}

export const TERMS: LegalSection[] = [
  {
    heading: 'Who this agreement is between',
    paragraphs: [
      'These terms govern your use of Spllit — the website, the app, and the services reachable through them. By creating an account you accept them.',
      'Spllit is a student travel-coordination platform. We connect people travelling the same way. We are not a transport provider, we do not employ drivers, and we do not own or operate any vehicle.',
    ],
  },
  {
    heading: 'Who can use Spllit',
    bullets: [
      'You must be 18 or older, or have the consent of a parent or guardian.',
      'You must sign in with a genuine Google account or phone number. One person, one account.',
      'Some features — creating and joining rides — require a verified institute email address. We check the domain against the institute you selected.',
      'You may not use Spllit if we have previously removed your account.',
    ],
  },
  {
    heading: 'Rides, group rides and what we are responsible for',
    paragraphs: [
      'Spllit is an introduction service. When you join a ride or a group ride, you are making an arrangement with another user, not with us.',
      'We do not vet drivers, verify licences, inspect vehicles, or check insurance. We verify that an account holds an institute email address — nothing more. Treat every arrangement with the caution you would apply to travelling with someone you met through a noticeboard.',
      'You are responsible for your own safety. Share your trip, meet in public, and stop if something feels wrong.',
    ],
    bullets: [
      'We do not guarantee that anyone will offer a ride, accept your request, or arrive.',
      'We do not set or collect transport fares. Any money paid for transport is an arrangement between you and the other person. Separately, Spllit may charge the platform join fee described in the Money section.',
      'We are not liable for loss, injury, delay or damage arising from a journey arranged through Spllit, except where that liability cannot be excluded by law.',
    ],
  },
  {
    heading: 'Money',
    paragraphs: [
      /**
       * Beta pricing, matching SQUAD_JOIN_PAYMENT_ENABLED=false.
       *
       * This section previously described the ₹2 fee and carbon coins as
       * live. Neither is charged today — the fee is behind a flag that is off,
       * and carbon coins are not implemented at all. Describing money that
       * does not move is the same defect as the earlier "no payment provider
       * connected" wording, in the opposite direction, so it changes in the
       * same commit as the flag.
       */
      'Spllit is free to use during the beta. Creating an account, browsing, posting a ride, creating a group ride and joining someone else’s group ride all cost nothing.',
      'We do not currently charge a fee to join a group ride, and no payment is taken at any point in that flow. Spllit does not set, collect, or take a share of transport fares either — whatever you agree to pay for the journey is settled directly between you and the other people on it.',
      'We intend to introduce a small matching fee after the beta. If that happens you will be told the amount before anything is charged, you will be asked to confirm it, and these terms will be updated first. Nothing here authorises a charge while the service is free.',
      'Payments, when they begin, will be handled by Razorpay. We will never see or store your card, UPI or bank details.',
      /**
       * Restored from e3fef09, which the merge resolution dropped.
       *
       * It states the default the rest of this section only implies, and a
       * payment provider's compliance review looks for exactly this sentence.
       * It does not contradict the Refunds policy — it defers to it explicitly,
       * and that policy is where both the refundable and non-refundable cases
       * are set out.
       */
      'There is nothing to refund while the service is free. If a fee is introduced, the Refunds and Cancellations policy will govern it, and — except where required by law or expressly stated there — a join fee will not be refundable once the payment has been successfully processed.',
    ],
  },
  {
    heading: 'Your content and conduct',
    bullets: [
      'You keep ownership of what you post. You grant us the licence needed to display it inside Spllit to the people you shared it with.',
      'Do not post anything unlawful, harassing, or deliberately misleading, and do not impersonate anyone.',
      'Do not use Spllit to advertise a commercial taxi service, to collect other users’ data, or to run automated requests against our systems.',
      'We may remove content or suspend an account that breaks these rules. Where it is safe and lawful to do so, we will tell you why.',
    ],
  },
  {
    heading: 'Location sharing',
    paragraphs: [
      'Live location is opt-in and scoped to a single group ride while you have that group ride open. Closing the screen stops the broadcast. Leaving a group ride clears the last position we held for you in it.',
      'We keep a coarse home location if you set one, so that "nearby" searches work when live location is off. You can change or remove it in your profile.',
    ],
  },
  {
    heading: 'Ending the agreement',
    bullets: [
      'You may stop using Spllit at any time and ask us to delete your account.',
      'We may suspend or close an account that breaks these terms, or where we are required to by law.',
      'Some records survive account deletion where we are legally required to keep them, or where they belong to someone else — a message you sent to another user remains in their conversation.',
    ],
  },
  {
    heading: 'Our intellectual property',
    paragraphs: [
      'Spllit — the name, the logo, the interface, the copy, the design and the underlying software — belongs to us and is protected under the Copyright Act 1957 and the Trade Marks Act 1999. Using the service does not transfer any of it to you.',
    ],
    bullets: [
      'You may not copy, adapt, translate or create derivative works from any part of Spllit.',
      'You may not reverse engineer, decompile or attempt to extract our source code, except to the limited extent Indian law expressly permits regardless of contract.',
      'You may not use our name or logo to suggest a partnership, sponsorship or endorsement we have not agreed to in writing.',
      'You may not scrape, crawl, or systematically download the service, or use it to build a competing dataset or product.',
      'Rights not expressly granted here are reserved. See the Intellectual Property notice for the full position, including how to report infringement.',
    ],
  },
  {
    heading: 'Complaints and the Grievance Officer',
    paragraphs: [
      'Spllit is an intermediary under the Information Technology Act 2000. In line with the Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules 2021, we publish a point of contact for complaints.',
      'Grievance Officer: Ankit Raj Choudhari — spllittech@gmail.com.',
      'We acknowledge complaints within 24 hours and aim to resolve them within 15 days. Content that is unlawful, or that shows a person without consent, is acted on faster.',
    ],
  },
  {
    heading: 'Changes',
    paragraphs: [
      'We will update these terms as Spllit changes. Material changes will be announced in the app before they take effect. Continuing to use Spllit after that means you accept the new version.',
    ],
  },
  {
    heading: 'Law',
    paragraphs: [
      'These terms are governed by the laws of India, and the courts of Chennai, Tamil Nadu have exclusive jurisdiction.',
    ],
  },
];

export const PRIVACY: LegalSection[] = [
  {
    heading: 'What we collect',
    bullets: [
      'Identity: your name, email address, and — if you sign in that way — your phone number, from Google or Firebase phone sign-in.',
      'Profile: username, college, institute email, gender, date of birth, photo, and bio, as you provide them.',
      'Location: live position while you have a group ride open and sharing switched on; a coarse home location if you set one; pickup and destination points for trips you create.',
      'Usage: rides and group rides you create or join, messages you send, and notifications generated for you.',
      'Referrals: if you arrived through an invite link, the id of the person who invited you and the date you joined. It is recorded once and never rewritten.',
      'Payments: none today — the service is free during the beta, so no payment records are created. If a fee is introduced we will hold the Razorpay order and payment identifiers and their status. Card numbers, UPI IDs and bank details are entered on Razorpay and never reach our servers.',
      'Technical: IP address and user agent, in server logs and rate-limiting counters.',
    ],
  },
  {
    heading: 'What we do not collect',
    bullets: [
      'We do not use advertising cookies or cross-site trackers.',
      'We do not sell personal data to anyone, for any purpose.',
      'We do not store your password when you sign in with Google or phone — there is no password on those accounts. Where a password exists, it is stored only as a bcrypt hash and cannot be read back.',
      'We do not read your device contacts, camera roll, or messages.',
      'Analytics is not switched on. The Firebase analytics SDK is deliberately not initialised.',
    ],
  },
  {
    heading: 'How your phone number is stored',
    paragraphs: [
      'Your phone number is stored twice and for different reasons: once in readable form so it can be shown to you and to people you are actively travelling with, and once as a salted one-way hash used to detect duplicate accounts. The hash cannot be reversed into a number.',
    ],
  },
  {
    heading: 'Who can see what',
    bullets: [
      'Your name, username, photo, college and rating are visible to other Spllit users.',
      'Your email address, phone number and institute email are not shown on your public profile.',
      'Live location is visible only to members of the group ride you are sharing with, and only while you are sharing.',
      'Messages are visible to the people in that conversation. We do not read them except where we must to investigate a report or comply with the law.',
    ],
  },
  {
    heading: 'Cookies and local storage',
    paragraphs: [
      'Strictly necessary storage keeps you signed in. It is not optional — without it the app cannot tell who you are — and it is exempt from consent under ePrivacy rules.',
      'Everything else is asked for: remembering dismissed banners and your invite link (preferences), and usage measurement (analytics, currently unused). You can accept, reject, or choose per category, and change your mind by clearing site data.',
    ],
  },
  {
    heading: 'Third parties we share with',
    bullets: [
      'Google Firebase — authentication (Google sign-in, phone OTP) and push tokens.',
      'MongoDB Atlas — the database where your account and activity are stored.',
      'Mapbox — geocoding, map tiles and directions. Coordinates are sent to compute a route or resolve a place name.',
      'Razorpay — payment processing. Integrated but not active during the free beta, so nothing is sent to them today. If a fee is introduced you would enter payment details on Razorpay, not on Spllit, and we would receive only an order id, a payment id and a success or failure.',
      'Cloudflare, Vercel and Google Cloud — hosting and delivery.',
      'We share what those services need to do their job, and nothing more. None of them is permitted to use your data for their own purposes.',
      'Some of these providers process data outside India. Where that happens, it is done under the provider’s contractual data-protection terms.',
    ],
  },
  {
    heading: 'Why we are allowed to hold it',
    bullets: [
      'Most of what we hold is processed because you asked us to provide the service — an account, a group ride, a message you chose to send.',
      'Location sharing, optional cookies and notifications run on your consent, which you give explicitly and can withdraw at any time.',
      'Payment records and security logs are kept because we have a legal obligation to, and a legitimate interest in preventing fraud and abuse.',
    ],
  },
  {
    heading: 'How long we keep it',
    bullets: [
      'Account and profile data: while your account exists, then deleted on request.',
      'Live positions: short-lived, cleared when you stop sharing or leave a group ride.',
      'Messages: for as long as the conversation exists. A message you sent stays in the recipient’s copy — it is their record too, and we cannot remove it from their history without deleting theirs.',
      'Payment records: retained for eight years, as required of financial records under Indian tax and company law. These survive account deletion.',
      'Server and security logs: a limited period for debugging and abuse investigation.',
    ],
  },
  {
    heading: 'Children',
    paragraphs: [
      'Spllit is for students aged 18 and over. We do not knowingly collect data from anyone under 18. If you believe a child has an account, write to us and we will remove it.',
    ],
  },
  {
    heading: 'Your rights',
    paragraphs: [
      'Under India’s Digital Personal Data Protection Act 2023 — and under GDPR if you are in the EU/UK — you can ask for a copy of your data, ask us to correct it, ask us to delete it, withdraw a consent you previously gave, or nominate someone to exercise these rights if you cannot. Write to the address below and we will respond within 30 days.',
      'If you are not satisfied with our response you may complain to the Data Protection Board of India.',
    ],
  },
  {
    heading: 'Grievance Officer',
    paragraphs: [
      'For complaints about how your data is handled, under the Information Technology Act 2000 and the DPDP Act 2023:',
      'Ankit Raj Choudhari — spllittech@gmail.com. Acknowledged within 24 hours, resolved within 15 days.',
    ],
  },
  {
    heading: 'Security',
    bullets: [
      'Passwords, where they exist, are hashed with bcrypt. They are never stored or logged in readable form.',
      'Sign-in endpoints are rate limited, and repeated failed attempts against one account trigger a temporary lockout.',
      'Sign-in failures return the same message whether the account exists or not, so the response cannot be used to discover who has an account.',
      'Traffic is served over HTTPS. No system is perfectly secure, and we will tell affected users promptly if a breach puts their data at risk.',
    ],
  },
  {
    heading: 'Contact',
    paragraphs: [
      'Questions, or a request about your data: spllittech@gmail.com',
    ],
  },
];

/**
 * Safety guidance.
 *
 * Deliberately concrete. "Stay safe" is not advice — this says what to do
 * before, during and after a journey, and is honest that Spllit verifies an
 * institute email address and nothing else about a person or their vehicle.
 */
export const SAFETY: LegalSection[] = [
  {
    heading: 'What Spllit does and does not check',
    paragraphs: [
      'We verify one thing: that an account controls an email address at the institute it claims. That is a real check and it keeps out people with no connection to your campus. It is not a background check.',
    ],
    bullets: [
      'We do not verify driving licences, vehicle registration, insurance, or roadworthiness.',
      'We do not run criminal record or identity checks.',
      'A rating is other students’ opinions, not our endorsement.',
      'Treat every arrangement with the caution you would apply to travelling with someone you met through a campus noticeboard.',
    ],
  },
  {
    heading: 'Before you travel',
    bullets: [
      'Look at the profile: institute verification, rating, and how many trips they have completed.',
      'Keep the conversation inside Spllit until you have met. Moving to a private number early removes the record if something goes wrong.',
      'Agree the route, the meeting point and the cost split in writing, in the group ride chat, before the day.',
      'Tell someone who is not travelling with you where you are going, with whom, and when you expect to arrive.',
      'Meet at the group ride’s meeting point — a public, lit, named place. Do not agree to a first pickup somewhere isolated.',
    ],
  },
  {
    heading: 'During the journey',
    bullets: [
      'Share live location with the group ride while you travel. It is opt-in and stops when you close the screen.',
      'Sit where you can reach a door. Keep your phone charged and on you, not in a bag in the boot.',
      'You can end it at any point. Ask to be let out somewhere public and leave. You do not owe anyone an explanation, and no fare is worth staying for.',
      'If you are in immediate danger, call 112. Spllit is not an emergency service and cannot reach you.',
    ],
  },
  {
    heading: 'Money and journeys',
    bullets: [
      'Spllit is free during the beta, so nothing is paid to us. Fuel, tolls and fares are settled directly between you.',
      'Agree the split before you set off. Most arguments are about an amount nobody stated out loud.',
      'Never send a deposit or an advance to someone you have not met. No genuine group ride needs one.',
    ],
  },
  {
    heading: 'Harassment, and what we do about it',
    paragraphs: [
      'Nobody has to tolerate being made uncomfortable to get a lift. Harassment, unwanted contact, discriminatory abuse and pressure of any kind break these terms and get accounts removed.',
    ],
    bullets: [
      'Block the person — they can no longer message you or see your group rides.',
      'Report the account or the message. Reports reach a human, not a filter.',
      'Keep the evidence. Do not delete the conversation before reporting it; we can only act on what we can see.',
      'We may suspend an account while we look into a report, and we will remove one where the report is upheld.',
      'Serious matters — assault, threats, anything criminal — belong with the police first and us second. We will cooperate with a lawful request for information.',
    ],
  },
  {
    heading: 'Reporting to us',
    paragraphs: [
      'Use the report option in the app, or write to spllittech@gmail.com. Include the username, the group ride or ride, and roughly when it happened.',
      'Anything involving someone’s safety is looked at the same day. Everything else is acknowledged within 24 hours.',
    ],
  },
];

/**
 * Refunds and cancellations.
 *
 * Nothing is charged during the beta, so nothing is refundable — but the
 * policy is published rather than removed: an aggregator expects it to exist
 * before payments begin, and it is the document the Terms defer to. It
 * describes the fee in the conditional until the flag is turned on.
 */
export const REFUNDS: LegalSection[] = [
  {
    heading: 'What you are paying for',
    paragraphs: [
      'Joining a group ride is free during the beta, so there is currently nothing to refund. The rest of this policy describes how refunds would work once a matching fee is introduced.',
      'It is charged only after the group ride leader approves your request — never when you apply. If your request is declined or never answered, you are not charged at all.',
      'It does not buy transport, a seat, or a guarantee that the journey happens.',
    ],
  },
  {
    heading: 'When you get a refund',
    bullets: [
      'The payment was taken but the match failed — you were not added to the group ride, or the group ride no longer existed. Refunded in full.',
      'You were charged more than once for the same match. The duplicates are refunded in full.',
      'The group ride leader cancelled the group ride before the journey. Refunded in full.',
      'We removed the group ride or the leader for breaking our terms. Refunded in full.',
      'A payment failed at the bank but the amount left your account. Razorpay reverses these automatically, usually within five to seven working days.',
    ],
  },
  {
    heading: 'When you do not',
    bullets: [
      'You changed your mind and left the group ride after being matched. The match was delivered — that is what the fee is for.',
      'The journey did not happen because of a disagreement between members, weather, or a change of plan.',
      'You were removed from a group ride for breaking our terms.',
      'You are unhappy with the journey, the driver or the other passengers. Report it and we will act on the account, but the matching fee is not a fare and is not refundable on that basis.',
    ],
  },
  {
    heading: 'Carbon coins',
    paragraphs: [
      'Carbon coins are not in use yet. When they are, they will be a reward rather than currency: no cash value, not transferable, not exchangeable, not refundable.',
      'If a payment is refunded, any coins it earned are removed with it. Coins expire when an account is closed.',
    ],
  },
  {
    heading: 'How to ask for a refund',
    paragraphs: [
      'Write to spllittech@gmail.com within 7 days of the charge with your registered email or phone number, the group ride, and the date. The Razorpay payment id, if you have it, makes this much faster.',
      'We respond within 3 working days. Approved refunds go back to the original payment method — we cannot send them anywhere else — and typically take 5 to 7 working days to appear, which is the bank’s timeline rather than ours.',
      'If you are unhappy with the outcome, escalate to the Grievance Officer named in the Terms.',
    ],
  },
];

/** Cookie and local-storage detail, referenced by the consent banner. */
export const COOKIES: LegalSection[] = [
  {
    heading: 'What we actually use',
    paragraphs: [
      'Spllit uses very little. There are no advertising cookies, no cross-site trackers and no third-party marketing pixels anywhere on this site.',
      'Most of what we store is not a cookie at all — it is browser local storage, which stays on your device and is never transmitted with a request the way a cookie is.',
    ],
  },
  {
    heading: 'Strictly necessary',
    bullets: [
      'Firebase authentication tokens — these keep you signed in. Without them the app cannot tell who you are.',
      'Your consent choice itself, so the banner does not reappear on every page.',
      'These cannot be switched off and do not require consent, because the service does not function without them.',
    ],
  },
  {
    heading: 'Preferences — optional',
    bullets: [
      'Banners and tips you have dismissed, so they stay dismissed.',
      'An invite code from a link you followed, held until you finish signing up so the person who invited you is credited.',
      'Your last map position and layer choices.',
    ],
  },
  {
    heading: 'Analytics — optional, and currently unused',
    paragraphs: [
      'The consent banner offers an analytics category, and nothing currently runs in it. The Firebase Analytics SDK is deliberately not initialised — the configuration is present but getAnalytics() is never called.',
      'We ask for the category now so that if measurement is ever switched on, it starts from a consent you actually gave rather than one assumed on your behalf.',
    ],
  },
  {
    heading: 'Changing your mind',
    paragraphs: [
      'Reject non-essential storage in the banner, or clear site data for spllit.app in your browser settings at any time. Clearing it signs you out, because the sign-in token goes with it.',
      'Blocking strictly necessary storage entirely will stop you being able to sign in.',
    ],
  },
];

/** Copyright, trade marks, the licence you grant us, and the takedown route. */
export const INTELLECTUAL_PROPERTY: LegalSection[] = [
  {
    heading: 'What we own',
    paragraphs: [
      'Spllit’s software, interface, design, written copy, logo and name are original works owned by Spllit and protected under the Copyright Act 1957. The name and logo are also protected as marks under the Trade Marks Act 1999.',
      'All rights reserved.',
    ],
  },
  {
    heading: 'What you may do',
    bullets: [
      'Use Spllit for its intended purpose: finding and coordinating journeys with other students.',
      'Quote or screenshot the interface for reviews, journalism, coursework or teaching, with attribution.',
      'Link to any public page.',
    ],
  },
  {
    heading: 'What you may not do',
    bullets: [
      'Copy, adapt, translate or make derivative works from any part of the service.',
      'Reverse engineer, decompile or disassemble it, except where Indian law expressly permits this regardless of what a contract says.',
      'Scrape or systematically extract data, by hand or by automated means, or use it to train a model or build a competing dataset.',
      'Use our name, logo or design to imply an endorsement, partnership or affiliation we have not agreed to in writing.',
      'Remove or obscure any copyright or ownership notice.',
    ],
  },
  {
    heading: 'What you own',
    paragraphs: [
      'Everything you write, photograph and post stays yours. We claim no ownership of it.',
      'You grant us a limited, non-exclusive, royalty-free licence to store, reproduce and display your content inside Spllit, to the people you shared it with, for as long as you keep it there. That licence exists so we can show your message to your group ride — nothing more.',
      'We do not licence your content to anyone else, use it in advertising, or sell it. Deleting content ends the licence, other than where the content also belongs to someone else — a message you sent remains in the recipient’s conversation.',
    ],
  },
  {
    heading: 'Third-party components',
    paragraphs: [
      'Spllit is built on open-source software, each part used under its own licence, and on map data from Mapbox and OpenStreetMap contributors. Those licences belong to their authors and nothing here overrides them.',
    ],
  },
  {
    heading: 'Reporting infringement',
    paragraphs: [
      'If you believe something on Spllit infringes your copyright or trade mark, write to spllittech@gmail.com with "Infringement" in the subject.',
    ],
    bullets: [
      'Identify the work and the page or content complained of, precisely enough that we can find it.',
      'Explain what right you hold and why you believe the use is unauthorised.',
      'Give your contact details and confirm the statement is accurate.',
      'We acknowledge within 24 hours and act within 15 days, in line with the Information Technology (Intermediary Guidelines) Rules 2021. Content may be removed while we assess it, and we will tell the person who posted it unless the law prevents us.',
    ],
  },
];
