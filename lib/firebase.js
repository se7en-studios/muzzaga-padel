import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";

import { db as zzDemoDb } from "../app/admin/zz-demo-db.js"; // ZZ-DEMO TEMPORAL
export function isFirebaseConfigured() {
  if (process.env.ZZ_DEMO) return true; // ZZ-DEMO TEMPORAL
  return Boolean(
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PRIVATE_KEY &&
    process.env.FIREBASE_DATABASE_URL
  );
}

function getAdminApp() {
  const existing = getApps()[0];
  if (existing) return existing;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const databaseURL = process.env.FIREBASE_DATABASE_URL;

  if (!projectId || !clientEmail || !privateKey || !databaseURL) {
    throw new Error(
      "Faltan variables de entorno de Firebase (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY, FIREBASE_DATABASE_URL).",
    );
  }

  return initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
    databaseURL,
  });
}

/** Server-only Realtime Database handle. Never import this from a Client Component. */
export function getDb() {
  if (process.env.ZZ_DEMO) return zzDemoDb; // ZZ-DEMO TEMPORAL
  return getDatabase(getAdminApp());
}

