/**
 * Indian institutes, with the email domains that prove membership.
 *
 * `domains` gates verification: a user who picks IIT Madras must hold an
 * @iitm.ac.in (or listed sub-domain) address before they can create or join a
 * ride. Sub-domains are listed explicitly rather than matched loosely, so
 * "iitm.ac.in.evil.com" can never pass.
 *
 * `accent` drives the generated monogram in the picker. These are NOT the
 * institutes' official logos — those are registered trademarks we cannot
 * redistribute. Drop a real asset path into `logo` if you obtain a licensed
 * one and the picker will use it instead of the monogram.
 *
 * Domains were compiled from public institute web addresses. Verify against
 * your own users before relying on them to gate anything financial.
 */

export interface Institute {
  id: string;
  name: string;
  /** Monogram text — kept to 4 characters so it fits the badge. */
  code: string;
  city: string;
  type: 'IIT' | 'NIT' | 'IIIT' | 'IISER' | 'University' | 'Other';
  /** Accepted email domains. First entry is the canonical one. */
  domains: string[];
  accent: string;
  /** Optional licensed logo. Null renders the monogram. */
  logo?: string | null;
}

const IIT = '#0F5298';
const NIT = '#8A2E2E';
const IIIT = '#1F6F54';
const IISER = '#5B3A8E';
const UNI = '#4A4A55';

export const INSTITUTES: Institute[] = [
  // --- IITs ---------------------------------------------------------------
  {
    id: 'iitm',
    name: 'IIT Madras',
    code: 'IITM',
    city: 'Chennai',
    type: 'IIT',
    // The online BS programme uses its own sub-domain and has far more
    // students than the residential campus — both must be accepted.
    // Kept in step with backend/src/data/institutes.ts — that copy is the one
    // that authorises. `study.iitm.ac.in` is the BS-degree address.
    domains: [
      'iitm.ac.in',
      'study.iitm.ac.in',
      'smail.iitm.ac.in',
      'student.onlinedegree.iitm.ac.in',
      'ds.study.iitm.ac.in',
    ],
    accent: IIT,
  },
  { id: 'iitd', name: 'IIT Delhi', code: 'IITD', city: 'New Delhi', type: 'IIT', domains: ['iitd.ac.in'], accent: IIT },
  { id: 'iitb', name: 'IIT Bombay', code: 'IITB', city: 'Mumbai', type: 'IIT', domains: ['iitb.ac.in'], accent: IIT },
  { id: 'iitk', name: 'IIT Kanpur', code: 'IITK', city: 'Kanpur', type: 'IIT', domains: ['iitk.ac.in'], accent: IIT },
  { id: 'iitkgp', name: 'IIT Kharagpur', code: 'KGP', city: 'Kharagpur', type: 'IIT', domains: ['iitkgp.ac.in', 'kgpian.iitkgp.ac.in'], accent: IIT },
  { id: 'iitr', name: 'IIT Roorkee', code: 'IITR', city: 'Roorkee', type: 'IIT', domains: ['iitr.ac.in'], accent: IIT },
  { id: 'iitg', name: 'IIT Guwahati', code: 'IITG', city: 'Guwahati', type: 'IIT', domains: ['iitg.ac.in'], accent: IIT },
  { id: 'iith', name: 'IIT Hyderabad', code: 'IITH', city: 'Hyderabad', type: 'IIT', domains: ['iith.ac.in'], accent: IIT },
  { id: 'iitbhu', name: 'IIT (BHU) Varanasi', code: 'BHU', city: 'Varanasi', type: 'IIT', domains: ['iitbhu.ac.in', 'itbhu.ac.in'], accent: IIT },
  { id: 'iitism', name: 'IIT (ISM) Dhanbad', code: 'ISM', city: 'Dhanbad', type: 'IIT', domains: ['iitism.ac.in'], accent: IIT },
  { id: 'iiti', name: 'IIT Indore', code: 'IITI', city: 'Indore', type: 'IIT', domains: ['iiti.ac.in'], accent: IIT },
  { id: 'iitrpr', name: 'IIT Ropar', code: 'RPR', city: 'Rupnagar', type: 'IIT', domains: ['iitrpr.ac.in'], accent: IIT },
  { id: 'iitp', name: 'IIT Patna', code: 'IITP', city: 'Patna', type: 'IIT', domains: ['iitp.ac.in'], accent: IIT },
  { id: 'iitgn', name: 'IIT Gandhinagar', code: 'IITGN', city: 'Gandhinagar', type: 'IIT', domains: ['iitgn.ac.in'], accent: IIT },
  { id: 'iitbbs', name: 'IIT Bhubaneswar', code: 'BBS', city: 'Bhubaneswar', type: 'IIT', domains: ['iitbbs.ac.in'], accent: IIT },
  { id: 'iitmandi', name: 'IIT Mandi', code: 'MND', city: 'Mandi', type: 'IIT', domains: ['iitmandi.ac.in'], accent: IIT },
  { id: 'iitj', name: 'IIT Jodhpur', code: 'IITJ', city: 'Jodhpur', type: 'IIT', domains: ['iitj.ac.in'], accent: IIT },
  { id: 'iittp', name: 'IIT Tirupati', code: 'TPT', city: 'Tirupati', type: 'IIT', domains: ['iittp.ac.in'], accent: IIT },
  { id: 'iitpkd', name: 'IIT Palakkad', code: 'PKD', city: 'Palakkad', type: 'IIT', domains: ['iitpkd.ac.in'], accent: IIT },
  { id: 'iitbhilai', name: 'IIT Bhilai', code: 'BHL', city: 'Bhilai', type: 'IIT', domains: ['iitbhilai.ac.in'], accent: IIT },
  { id: 'iitgoa', name: 'IIT Goa', code: 'GOA', city: 'Ponda', type: 'IIT', domains: ['iitgoa.ac.in'], accent: IIT },
  { id: 'iitjammu', name: 'IIT Jammu', code: 'JMU', city: 'Jammu', type: 'IIT', domains: ['iitjammu.ac.in'], accent: IIT },
  { id: 'iitdh', name: 'IIT Dharwad', code: 'DWD', city: 'Dharwad', type: 'IIT', domains: ['iitdh.ac.in'], accent: IIT },

  // --- NITs ---------------------------------------------------------------
  { id: 'nitt', name: 'NIT Tiruchirappalli', code: 'NITT', city: 'Tiruchirappalli', type: 'NIT', domains: ['nitt.edu'], accent: NIT },
  { id: 'nitw', name: 'NIT Warangal', code: 'NITW', city: 'Warangal', type: 'NIT', domains: ['nitw.ac.in', 'student.nitw.ac.in'], accent: NIT },
  { id: 'nitk', name: 'NIT Karnataka (Surathkal)', code: 'NITK', city: 'Mangaluru', type: 'NIT', domains: ['nitk.edu.in'], accent: NIT },
  { id: 'nitrkl', name: 'NIT Rourkela', code: 'NITR', city: 'Rourkela', type: 'NIT', domains: ['nitrkl.ac.in'], accent: NIT },
  { id: 'nitc', name: 'NIT Calicut', code: 'NITC', city: 'Kozhikode', type: 'NIT', domains: ['nitc.ac.in'], accent: NIT },
  { id: 'mnnit', name: 'MNNIT Allahabad', code: 'MNNIT', city: 'Prayagraj', type: 'NIT', domains: ['mnnit.ac.in'], accent: NIT },
  { id: 'mnit', name: 'MNIT Jaipur', code: 'MNIT', city: 'Jaipur', type: 'NIT', domains: ['mnit.ac.in'], accent: NIT },
  { id: 'vnit', name: 'VNIT Nagpur', code: 'VNIT', city: 'Nagpur', type: 'NIT', domains: ['vnit.ac.in'], accent: NIT },
  { id: 'svnit', name: 'SVNIT Surat', code: 'SVNIT', city: 'Surat', type: 'NIT', domains: ['svnit.ac.in'], accent: NIT },
  { id: 'manit', name: 'MANIT Bhopal', code: 'MANIT', city: 'Bhopal', type: 'NIT', domains: ['manit.ac.in'], accent: NIT },
  { id: 'nitdgp', name: 'NIT Durgapur', code: 'NITDGP', city: 'Durgapur', type: 'NIT', domains: ['nitdgp.ac.in'], accent: NIT },
  { id: 'nitkkr', name: 'NIT Kurukshetra', code: 'NITKKR', city: 'Kurukshetra', type: 'NIT', domains: ['nitkkr.ac.in'], accent: NIT },
  { id: 'nits', name: 'NIT Silchar', code: 'NITS', city: 'Silchar', type: 'NIT', domains: ['nits.ac.in'], accent: NIT },
  { id: 'nitjsr', name: 'NIT Jamshedpur', code: 'NITJSR', city: 'Jamshedpur', type: 'NIT', domains: ['nitjsr.ac.in'], accent: NIT },
  { id: 'nitp', name: 'NIT Patna', code: 'NITP', city: 'Patna', type: 'NIT', domains: ['nitp.ac.in'], accent: NIT },
  { id: 'nitrr', name: 'NIT Raipur', code: 'NITRR', city: 'Raipur', type: 'NIT', domains: ['nitrr.ac.in'], accent: NIT },
  { id: 'nith', name: 'NIT Hamirpur', code: 'NITH', city: 'Hamirpur', type: 'NIT', domains: ['nith.ac.in'], accent: NIT },
  { id: 'nitj', name: 'NIT Jalandhar', code: 'NITJ', city: 'Jalandhar', type: 'NIT', domains: ['nitj.ac.in'], accent: NIT },
  { id: 'nitsri', name: 'NIT Srinagar', code: 'NITSRI', city: 'Srinagar', type: 'NIT', domains: ['nitsri.ac.in'], accent: NIT },
  { id: 'nita', name: 'NIT Agartala', code: 'NITA', city: 'Agartala', type: 'NIT', domains: ['nita.ac.in'], accent: NIT },
  { id: 'nitgoa', name: 'NIT Goa', code: 'NITGOA', city: 'Cuncolim', type: 'NIT', domains: ['nitgoa.ac.in'], accent: NIT },
  { id: 'nitm', name: 'NIT Meghalaya', code: 'NITM', city: 'Shillong', type: 'NIT', domains: ['nitm.ac.in'], accent: NIT },
  { id: 'nitpy', name: 'NIT Puducherry', code: 'NITPY', city: 'Karaikal', type: 'NIT', domains: ['nitpy.ac.in'], accent: NIT },
  { id: 'nitdelhi', name: 'NIT Delhi', code: 'NITD', city: 'New Delhi', type: 'NIT', domains: ['nitdelhi.ac.in'], accent: NIT },
  { id: 'nituk', name: 'NIT Uttarakhand', code: 'NITUK', city: 'Srinagar (UK)', type: 'NIT', domains: ['nituk.ac.in'], accent: NIT },
  { id: 'nitap', name: 'NIT Andhra Pradesh', code: 'NITAP', city: 'Tadepalligudem', type: 'NIT', domains: ['nitandhra.ac.in'], accent: NIT },
  { id: 'nitmn', name: 'NIT Manipur', code: 'NITMN', city: 'Imphal', type: 'NIT', domains: ['nitmanipur.ac.in'], accent: NIT },
  { id: 'nitmz', name: 'NIT Mizoram', code: 'NITMZ', city: 'Aizawl', type: 'NIT', domains: ['nitmz.ac.in'], accent: NIT },
  { id: 'nitn', name: 'NIT Nagaland', code: 'NITN', city: 'Dimapur', type: 'NIT', domains: ['nitnagaland.ac.in'], accent: NIT },
  { id: 'nitsk', name: 'NIT Sikkim', code: 'NITSK', city: 'Ravangla', type: 'NIT', domains: ['nitsikkim.ac.in'], accent: NIT },
  { id: 'nitarp', name: 'NIT Arunachal Pradesh', code: 'NITAR', city: 'Jote', type: 'NIT', domains: ['nitap.ac.in'], accent: NIT },

  // --- IIITs --------------------------------------------------------------
  { id: 'iiith', name: 'IIIT Hyderabad', code: 'IIITH', city: 'Hyderabad', type: 'IIIT', domains: ['iiit.ac.in', 'students.iiit.ac.in', 'research.iiit.ac.in'], accent: IIIT },
  { id: 'iiitb', name: 'IIIT Bangalore', code: 'IIITB', city: 'Bengaluru', type: 'IIIT', domains: ['iiitb.ac.in', 'iiitb.org'], accent: IIIT },
  { id: 'iiitd', name: 'IIIT Delhi', code: 'IIITD', city: 'New Delhi', type: 'IIIT', domains: ['iiitd.ac.in', 'student.iiitd.ac.in'], accent: IIIT },
  { id: 'iiita', name: 'IIIT Allahabad', code: 'IIITA', city: 'Prayagraj', type: 'IIIT', domains: ['iiita.ac.in'], accent: IIIT },
  { id: 'iiitg', name: 'IIIT Guwahati', code: 'IIITG', city: 'Guwahati', type: 'IIIT', domains: ['iiitg.ac.in'], accent: IIIT },
  { id: 'iiitdmj', name: 'IIITDM Jabalpur', code: 'IIITDM', city: 'Jabalpur', type: 'IIIT', domains: ['iiitdmj.ac.in'], accent: IIIT },

  // --- IISERs & research ---------------------------------------------------
  { id: 'iisc', name: 'IISc Bangalore', code: 'IISc', city: 'Bengaluru', type: 'IISER', domains: ['iisc.ac.in'], accent: IISER },
  { id: 'iiserp', name: 'IISER Pune', code: 'IISERP', city: 'Pune', type: 'IISER', domains: ['iiserpune.ac.in', 'students.iiserpune.ac.in'], accent: IISER },
  { id: 'iiserk', name: 'IISER Kolkata', code: 'IISERK', city: 'Kolkata', type: 'IISER', domains: ['iiserkol.ac.in'], accent: IISER },
  { id: 'iiserb', name: 'IISER Bhopal', code: 'IISERB', city: 'Bhopal', type: 'IISER', domains: ['iiserb.ac.in'], accent: IISER },
  { id: 'iiserm', name: 'IISER Mohali', code: 'IISERM', city: 'Mohali', type: 'IISER', domains: ['iisermohali.ac.in'], accent: IISER },
  { id: 'iisertvm', name: 'IISER Thiruvananthapuram', code: 'IISERT', city: 'Thiruvananthapuram', type: 'IISER', domains: ['iisertvm.ac.in'], accent: IISER },

  // --- Universities --------------------------------------------------------
  { id: 'du', name: 'University of Delhi', code: 'DU', city: 'New Delhi', type: 'University', domains: ['du.ac.in'], accent: UNI },
  { id: 'jnu', name: 'Jawaharlal Nehru University', code: 'JNU', city: 'New Delhi', type: 'University', domains: ['jnu.ac.in', 'mail.jnu.ac.in'], accent: UNI },
  { id: 'jmi', name: 'Jamia Millia Islamia', code: 'JMI', city: 'New Delhi', type: 'University', domains: ['jmi.ac.in'], accent: UNI },
  { id: 'bhuni', name: 'Banaras Hindu University', code: 'BHU', city: 'Varanasi', type: 'University', domains: ['bhu.ac.in'], accent: UNI },
  { id: 'amu', name: 'Aligarh Muslim University', code: 'AMU', city: 'Aligarh', type: 'University', domains: ['amu.ac.in', 'myamu.ac.in'], accent: UNI },
  { id: 'vit', name: 'VIT Vellore', code: 'VIT', city: 'Vellore', type: 'University', domains: ['vit.ac.in', 'vitstudent.ac.in'], accent: UNI },
  { id: 'srm', name: 'SRM Institute of Science and Technology', code: 'SRM', city: 'Chennai', type: 'University', domains: ['srmist.edu.in', 'srmuniv.ac.in'], accent: UNI },
  { id: 'manipal', name: 'Manipal Academy of Higher Education', code: 'MAHE', city: 'Manipal', type: 'University', domains: ['manipal.edu', 'learner.manipal.edu'], accent: UNI },
  { id: 'bits', name: 'BITS Pilani', code: 'BITS', city: 'Pilani', type: 'University', domains: ['pilani.bits-pilani.ac.in', 'goa.bits-pilani.ac.in', 'hyderabad.bits-pilani.ac.in', 'bits-pilani.ac.in'], accent: UNI },
  { id: 'annauniv', name: 'Anna University', code: 'AU', city: 'Chennai', type: 'University', domains: ['annauniv.edu'], accent: UNI },
  { id: 'ju', name: 'Jadavpur University', code: 'JU', city: 'Kolkata', type: 'University', domains: ['jadavpuruniversity.in'], accent: UNI },
  { id: 'dtu', name: 'Delhi Technological University', code: 'DTU', city: 'New Delhi', type: 'University', domains: ['dtu.ac.in'], accent: UNI },
  { id: 'nsut', name: 'Netaji Subhas University of Technology', code: 'NSUT', city: 'New Delhi', type: 'University', domains: ['nsut.ac.in'], accent: UNI },
  { id: 'iiitdmk', name: 'Thapar Institute', code: 'TIET', city: 'Patiala', type: 'University', domains: ['thapar.edu'], accent: UNI },
  { id: 'coep', name: 'COEP Technological University', code: 'COEP', city: 'Pune', type: 'University', domains: ['coeptech.ac.in', 'coep.ac.in'], accent: UNI },
  { id: 'ict', name: 'Institute of Chemical Technology', code: 'ICT', city: 'Mumbai', type: 'University', domains: ['ictmumbai.edu.in'], accent: UNI },

  // Escape hatch so nobody is locked out of the product entirely. Institutes
  // with no listed domain cannot be email-verified, and the UI says so.
  { id: 'other', name: 'Other institute', code: '···', city: '', type: 'Other', domains: [], accent: UNI },
];

export const INSTITUTES_BY_ID = new Map(INSTITUTES.map((i) => [i.id, i]));

/** Lookup by the stored display name, for profiles saved before this list. */
export function findInstituteByName(name: string | null | undefined): Institute | null {
  if (!name) return null;
  const needle = name.trim().toLowerCase();
  return (
    INSTITUTES.find((i) => i.name.toLowerCase() === needle) ??
    // Legacy values like "IIT Madras (BS Degree)" carry a suffix.
    INSTITUTES.find((i) => needle.startsWith(i.name.toLowerCase())) ??
    null
  );
}

/**
 * Whether an email proves membership of an institute.
 * Exact domain or an explicitly listed sub-domain only — never a suffix match,
 * which "iitm.ac.in.attacker.com" would otherwise pass.
 */
export function emailMatchesInstitute(email: string, institute: Institute): boolean {
  if (institute.domains.length === 0) return false;

  // Exactly one '@', with content on both sides — kept identical to the
  // backend's copy in backend/src/data/institutes.ts, which is the one that
  // authorises. See the note there.
  const parts = email.trim().split('@');
  if (parts.length !== 2) return false;
  const [local, host] = parts;
  if (!local || !host) return false;

  const domain = host.trim().toLowerCase();
  return institute.domains.some((d) => domain === d.toLowerCase());
}

/** Ranked search over name, code and city. */
export function searchInstitutes(query: string, limit = 40): Institute[] {
  const q = query.trim().toLowerCase();
  if (!q) return INSTITUTES.slice(0, limit);

  const scored: { institute: Institute; score: number }[] = [];
  for (const institute of INSTITUTES) {
    const name = institute.name.toLowerCase();
    const code = institute.code.toLowerCase();
    const city = institute.city.toLowerCase();

    let score = -1;
    if (code === q) score = 0;
    else if (name.startsWith(q)) score = 1;
    else if (code.startsWith(q)) score = 2;
    else if (name.includes(q)) score = 3;
    else if (city.includes(q)) score = 4;
    else if (institute.domains.some((d) => d.includes(q))) score = 5;

    if (score >= 0) scored.push({ institute, score });
  }

  return scored
    .sort((a, b) => a.score - b.score || a.institute.name.localeCompare(b.institute.name))
    .slice(0, limit)
    .map((s) => s.institute);
}
