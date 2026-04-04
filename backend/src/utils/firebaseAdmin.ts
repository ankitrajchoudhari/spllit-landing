import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

let initialized = false;

export const isFirebaseAdminConfigured = () => {
  return Boolean(projectId && clientEmail && privateKey);
};

const ensureFirebaseAdmin = () => {
  if (initialized) return;
  if (!isFirebaseAdminConfigured()) return;

  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });
  }

  initialized = true;
};

export const verifyFirebaseIdToken = async (idToken: string) => {
  ensureFirebaseAdmin();

  if (!isFirebaseAdminConfigured()) {
    throw new Error('Firebase Admin is not configured');
  }

  return getAuth().verifyIdToken(idToken);
};
