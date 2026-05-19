import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { Request } from "express";
import { AuthUser } from "../../common/http";
import { FirebaseService } from "./firebase.service";

export type AuthenticatedRequest = Request & { user: AuthUser };

@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  constructor(private readonly firebase: FirebaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = request.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;

    if (!token) {
      throw new UnauthorizedException("Missing Firebase bearer token");
    }

    request.user = await this.firebase.verifyToken(token);
    return true;
  }
}
