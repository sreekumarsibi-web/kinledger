import { Body, Controller, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { parseBody, uuidSchema } from "../../common/http";
import { AuthenticatedRequest, FirebaseAuthGuard } from "../auth/firebase-auth.guard";
import { HouseholdsService } from "./households.service";

const createHouseholdSchema = z.object({
  name: z.string().min(1).max(120),
  accountType: z.enum(["single", "couple", "family"])
});

const inviteSchema = z.object({
  contact: z.string().min(3).max(160),
  relationship: z.enum(["spouse", "parent", "child"]),
  permission: z.enum(["shared_only", "summary", "full"])
});

@Controller("households")
@UseGuards(FirebaseAuthGuard)
export class HouseholdsController {
  constructor(private readonly households: HouseholdsService) {}

  @Get()
  list(@Req() request: AuthenticatedRequest) {
    return this.households.listForUser(request.user);
  }

  @Post()
  create(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.households.create(request.user, parseBody(createHouseholdSchema, body));
  }

  @Post(":householdId/invites")
  invite(@Req() request: AuthenticatedRequest, @Param("householdId") householdId: string, @Body() body: unknown) {
    const id = parseBody(uuidSchema, householdId);
    return this.households.invite(request.user, id, parseBody(inviteSchema, body));
  }

  @Get(":householdId/members")
  members(@Req() request: AuthenticatedRequest, @Param("householdId") householdId: string) {
    return this.households.members(request.user, parseBody(uuidSchema, householdId));
  }

  @Post("invites/:token/accept")
  acceptInvite(@Req() request: AuthenticatedRequest, @Param("token") token: string) {
    return this.households.acceptInvite(request.user, token);
  }
}
