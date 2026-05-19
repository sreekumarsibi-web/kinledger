import { Body, Controller, Delete, Get, Post, Req, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { parseBody } from "../../common/http";
import { AuthenticatedRequest, FirebaseAuthGuard } from "../auth/firebase-auth.guard";
import { UsersService } from "./users.service";

const syncUserSchema = z.object({
  displayName: z.string().min(1).max(120).optional()
});

@Controller("users")
@UseGuards(FirebaseAuthGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get("me")
  async me(@Req() request: AuthenticatedRequest) {
    return this.users.upsertFromFirebase(request.user);
  }

  @Post("me")
  async sync(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    const dto = parseBody(syncUserSchema, body);
    return this.users.upsertFromFirebase(request.user, dto.displayName);
  }

  @Delete("me")
  async deleteMe(@Req() request: AuthenticatedRequest) {
    return this.users.deleteByFirebaseUid(request.user.firebaseUid);
  }
}
