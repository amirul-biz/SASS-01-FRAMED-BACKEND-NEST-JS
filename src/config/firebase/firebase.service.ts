import { Injectable, Logger } from '@nestjs/common';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

@Injectable()
export class FirebaseService {
  private readonly logger = new Logger(FirebaseService.name);

  constructor() {
    if (!getApps().length) {
      const projectId = process.env.FIREBASE_PROJECT_ID;
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
      const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

      if (projectId && clientEmail && privateKey) {
        try {
          initializeApp({
            credential: cert({
              projectId,
              clientEmail,
              privateKey,
            }),
          });
        } catch (error) {
          this.logger.warn(
            `Failed to initialize Firebase with the provided credentials: ${(error as Error).message}`,
          );
        }
      }
    }
  }

  async createUser(email: string, password: string) {
    if (!getApps().length) {
      throw new Error('Firebase is not configured. Please set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY.');
    }

    return await getAuth().createUser({ email, password });
  }

  async deleteUser(uid: string): Promise<void> {
    if (!getApps().length) {
      return;
    }

    try {
      await getAuth().deleteUser(uid);
    } catch (error) {
      console.error(error);
    }
  }

  // Returns every Firebase Auth user (listUsers pages 1000 at a time). Only the fields the
  // admin panel needs are mapped, to keep payloads small.
  async listUsers(): Promise<
    { uid: string; email: string | null; disabled: boolean; createdAt: Date }[]
  > {
    if (!getApps().length) {
      throw new Error('Firebase is not configured. Please set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY.');
    }

    const result: { uid: string; email: string | null; disabled: boolean; createdAt: Date }[] = [];
    let pageToken: string | undefined;

    do {
      const page = await getAuth().listUsers(1000, pageToken);
      result.push(
        ...page.users.map((user) => ({
          uid: user.uid,
          email: user.email ?? null,
          disabled: user.disabled,
          createdAt: new Date(user.metadata.creationTime),
        })),
      );
      pageToken = page.pageToken;
    } while (pageToken);

    return result;
  }

  async setUserDisabled(uid: string, disabled: boolean): Promise<void> {
    if (!getApps().length) {
      throw new Error('Firebase is not configured. Please set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY.');
    }

    await getAuth().updateUser(uid, { disabled });
  }
}