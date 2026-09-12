/**
 * Institute → accepted email domains, for SERVER-SIDE verification.
 *
 * Intentionally duplicated from the web app's content/institutes.ts. The client
 * copy drives the picker and its hints; this copy is the one that decides
 * whether a user may create or join a ride. A client-side check is a
 * convenience, never an authorisation boundary — so the two must be kept in
 * step, and this file is the one that matters.
 *
 * Matching accepts a listed domain **or any sub-domain of one** — see
 * `emailMatchesInstitute` for why that is safe and what it is not.
 */
export const INSTITUTE_DOMAINS: Record<string, string[]> = {
  // IITs
  /**
   * One entry, not five.
   *
   * `study.iitm.ac.in`, `ds.study.iitm.ac.in`, `smail.iitm.ac.in` and
   * `student.onlinedegree.iitm.ac.in` were all listed here, and all four were
   * already covered by `iitm.ac.in` — `emailMatchesInstitute` accepts any
   * sub-domain of a listed domain.
   *
   * They were removed because an enumeration teaches the wrong lesson. The
   * original bug in this file was `study.iitm.ac.in` missing for months while
   * every BS-degree student was told their correct address was "not from IIT
   * Madras", and a list that looks exhaustive invites exactly that: someone
   * adds a new cohort's sub-domain, forgets one, and it fails again. Listing
   * the institution's root domain covers every sub-domain it will ever create,
   * including ones nobody has heard of yet.
   */
  iitm: ['iitm.ac.in'],
  iitd: ['iitd.ac.in'],
  iitb: ['iitb.ac.in'],
  iitk: ['iitk.ac.in'],
  iitkgp: ['iitkgp.ac.in'],
  iitr: ['iitr.ac.in'],
  iitg: ['iitg.ac.in'],
  iith: ['iith.ac.in'],
  iitbhu: ['iitbhu.ac.in', 'itbhu.ac.in'],
  iitism: ['iitism.ac.in'],
  iiti: ['iiti.ac.in'],
  iitrpr: ['iitrpr.ac.in'],
  iitp: ['iitp.ac.in'],
  iitgn: ['iitgn.ac.in'],
  iitbbs: ['iitbbs.ac.in'],
  iitmandi: ['iitmandi.ac.in'],
  iitj: ['iitj.ac.in'],
  iittp: ['iittp.ac.in'],
  iitpkd: ['iitpkd.ac.in'],
  iitbhilai: ['iitbhilai.ac.in'],
  iitgoa: ['iitgoa.ac.in'],
  iitjammu: ['iitjammu.ac.in'],
  iitdh: ['iitdh.ac.in'],

  // NITs
  nitt: ['nitt.edu'],
  nitw: ['nitw.ac.in'],
  nitk: ['nitk.edu.in'],
  nitrkl: ['nitrkl.ac.in'],
  nitc: ['nitc.ac.in'],
  mnnit: ['mnnit.ac.in'],
  mnit: ['mnit.ac.in'],
  vnit: ['vnit.ac.in'],
  svnit: ['svnit.ac.in'],
  manit: ['manit.ac.in'],
  nitdgp: ['nitdgp.ac.in'],
  nitkkr: ['nitkkr.ac.in'],
  nits: ['nits.ac.in'],
  nitjsr: ['nitjsr.ac.in'],
  nitp: ['nitp.ac.in'],
  nitrr: ['nitrr.ac.in'],
  nith: ['nith.ac.in'],
  nitj: ['nitj.ac.in'],
  nitsri: ['nitsri.ac.in'],
  nita: ['nita.ac.in'],
  nitgoa: ['nitgoa.ac.in'],
  nitm: ['nitm.ac.in'],
  nitpy: ['nitpy.ac.in'],
  nitdelhi: ['nitdelhi.ac.in'],
  nituk: ['nituk.ac.in'],
  nitap: ['nitandhra.ac.in'],
  nitmn: ['nitmanipur.ac.in'],
  nitmz: ['nitmz.ac.in'],
  nitn: ['nitnagaland.ac.in'],
  nitsk: ['nitsikkim.ac.in'],
  nitarp: ['nitap.ac.in'],

  // IIITs
  iiith: ['iiit.ac.in'],
  iiitb: ['iiitb.ac.in', 'iiitb.org'],
  iiitd: ['iiitd.ac.in'],
  iiita: ['iiita.ac.in'],
  iiitg: ['iiitg.ac.in'],
  iiitdmj: ['iiitdmj.ac.in'],

  // IISc / IISERs
  iisc: ['iisc.ac.in'],
  iiserp: ['iiserpune.ac.in'],
  iiserk: ['iiserkol.ac.in'],
  iiserb: ['iiserb.ac.in'],
  iiserm: ['iisermohali.ac.in'],
  iisertvm: ['iisertvm.ac.in'],

  // Universities
  du: ['du.ac.in'],
  jnu: ['jnu.ac.in'],
  jmi: ['jmi.ac.in'],
  bhuni: ['bhu.ac.in'],
  amu: ['amu.ac.in', 'myamu.ac.in'],
  vit: ['vit.ac.in', 'vitstudent.ac.in'],
  srm: ['srmist.edu.in', 'srmuniv.ac.in'],
  manipal: ['manipal.edu'],
  // Every campus is a sub-domain of the root, so the root covers them all.
  bits: ['bits-pilani.ac.in'],
  annauniv: ['annauniv.edu'],
  ju: ['jadavpuruniversity.in'],
  dtu: ['dtu.ac.in'],
  nsut: ['nsut.ac.in'],
  iiitdmk: ['thapar.edu'],
  coep: ['coeptech.ac.in', 'coep.ac.in'],
  ict: ['ictmumbai.edu.in'],

  // No verifiable domain — these users can never pass the ride gate, which the
  // UI states plainly rather than letting them discover it at the last step.
  other: [],
};

/**
 * Does this address belong to this institute?
 *
 * Accepts a listed domain, or any sub-domain of one: `iitm.ac.in` therefore
 * covers `ee.iitm.ac.in`, `ce.iitm.ac.in` and every other department and branch
 * without each having to be discovered and added by hand. That enumeration was
 * the actual failure mode — `study.iitm.ac.in` was missing for months and every
 * BS-degree student was told their correct address was "not from IIT Madras".
 *
 * ## Why this is not the suffix-match this file used to warn against
 *
 * The danger is `endsWith(domain)` with no separator, which accepts
 * `evil-iitm.ac.in` — an attacker-registered domain that merely ends in the
 * right letters. The check below requires a literal dot before the listed
 * domain, which is what makes it a sub-domain test rather than a string test:
 *
 *   evil-iitm.ac.in          → no '.' before iitm.ac.in     → refused
 *   iitm.ac.in.attacker.com  → ends in .attacker.com        → refused
 *   ee.iitm.ac.in            → '.iitm.ac.in'                → accepted
 *
 * What it does delegate is trust in the institution's own DNS: anyone who can
 * receive mail at a sub-domain of iitm.ac.in is treated as being at IIT Madras.
 * Every domain in this file is institution-owned, so that is exactly the
 * intended meaning. It would not be safe for a domain the institution does not
 * control, and nothing generic (gmail.com, a hosting provider) may be listed
 * here for that reason.
 */
export function emailMatchesInstitute(email: string, instituteId: string): boolean {
  const domains = INSTITUTE_DOMAINS[instituteId];
  if (!domains || domains.length === 0) return false;

  /**
   * Exactly one '@', and something on both sides of it.
   *
   * Splitting on the *last* '@' alone accepted "user@@study.iitm.ac.in", whose
   * domain reads as a listed one. Google never issues an address like that —
   * this value comes from a verified ID token, not a text field — so it was not
   * reachable, but the check costs two lines and the function should not depend
   * on its caller for that.
   */
  const parts = email.trim().split('@');
  if (parts.length !== 2) return false;
  const [local, host] = parts;
  if (!local || !host) return false;

  const domain = host.trim().toLowerCase();
  return domains.some((listed) => {
    const d = listed.toLowerCase();
    // The leading dot is the whole safety property. See above.
    return domain === d || domain.endsWith(`.${d}`);
  });
}

/**
 * The institute an address proves, when it proves exactly one.
 *
 * Onboarding used to verify only someone who had *already* picked an institute
 * from the list, which left anyone signing in with a campus address but
 * skipping that step unverified — holding the exact credential the rides gate
 * asks for and blocked by it. On the live data that was 55 accounts against 25
 * verified, most of them `…@ds.study.iitm.ac.in`.
 *
 * Returns null on *any* ambiguity rather than picking a winner. Two institutes
 * sharing a domain is a data error in INSTITUTE_DOMAINS, and resolving it by
 * guessing would verify someone as a member of a campus they have no connection
 * to — a quiet wrong answer where null produces a visible question.
 */
export function inferInstituteFromEmail(email: string): string | null {
  const matches = Object.keys(INSTITUTE_DOMAINS).filter((id) =>
    emailMatchesInstitute(email, id),
  );
  return matches.length === 1 ? (matches[0] ?? null) : null;
}

export function isKnownInstitute(instituteId: string): boolean {
  return Object.prototype.hasOwnProperty.call(INSTITUTE_DOMAINS, instituteId);
}

export function institutePrimaryDomain(instituteId: string): string | null {
  return INSTITUTE_DOMAINS[instituteId]?.[0] ?? null;
}

/** Every accepted domain, for messages that must not name just one. */
export function instituteDomains(instituteId: string): string[] {
  return INSTITUTE_DOMAINS[instituteId] ?? [];
}

/**
 * Human list of accepted addresses — "@a, @b or @c".
 *
 * A rejection that names one domain when several are accepted reads as "your
 * address is wrong" to someone whose address is in fact fine but happens to sit
 * further down the list. Naming all of them turns a dead end into a check the
 * user can actually perform.
 */
export function instituteDomainList(instituteId: string): string | null {
  const domains = instituteDomains(instituteId);
  if (domains.length === 0) return null;
  if (domains.length === 1) return `@${domains[0]}`;
  const head = domains.slice(0, -1).map((d) => `@${d}`).join(', ');
  return `${head} or @${domains[domains.length - 1]}`;
}
