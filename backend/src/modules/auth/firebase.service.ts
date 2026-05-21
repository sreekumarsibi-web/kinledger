import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as admin from "firebase-admin";
import { AuthUser } from "../../common/http";

@Injectable()
export class FirebaseService {
  private readonly app?: admin.app.App;

  constructor(config: ConfigService) {
    const projectId = config.get<string>("FIREBASE_PROJECT_ID");
    const clientEmail = config.get<string>("FIREBASE_CLIENT_EMAIL");
    const privateKey = config.get<string>("FIREBASE_PRIVATE_KEY")?.replace(/\\n/g, "\n");

    if (projectId && clientEmail && privateKey && !admin.apps.length) {
      this.app = admin.initializeApp({
        credential: admin.credential.cert({ projectId, clientEmail, privateKey })
      });
    } else if (admin.apps.length) {
      this.app = admin.app();
    }
  }

  async verifyToken(token: string): Promise<AuthUser> {
    if (!this.app) {
      throw new UnauthorizedException("Firebase Admin is not configured");
    }

    const decoded = await this.app.auth().verifyIdToken(token);
    return {
      firebaseUid: decoded.uid,
      email: decoded.email,
      phone: decoded.phone_number,
      name: decoded.name
    };
  }

  async deleteUser(firebaseUid: string): Promise<void> {
    if (!this.app) {
      throw new UnauthorizedException("Firebase Admin is not configured");
    }

    try {
      await this.app.auth().deleteUser(firebaseUid);
    } catch (error) {
      if ((error as { code?: string }).code !== "auth/user-not-found") {
        throw error;
      }
    }
  }
}
