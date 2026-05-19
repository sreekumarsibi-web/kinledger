import { Body, Controller, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { parseBody, uuidSchema } from "../../common/http";
import { AuthenticatedRequest, FirebaseAuthGuard } from "../auth/firebase-auth.guard";
import { NetWorthService } from "./net-worth.service";

const createNetWorthSchema = z.object({
  name: z.string().min(1).max(120),
  itemType: z.enum(["asset", "liability"]),
  category: z.string().min(1).max(80),
  valueCents: z.number().int().nonnegative(),
  asOfDate: z.string().date().optional()
});

@Controller("households/:householdId/net-worth")
@UseGuards(FirebaseAuthGuard)
export class NetWorthController {
  constructor(private readonly netWorth: NetWorthService) {}

  @Get()
  summary(@Req() request: AuthenticatedRequest, @Param("householdId") householdId: string) {
    return this.netWorth.summary(request.user, parseBody(uuidSchema, householdId));
  }

  @Post()
  create(@Req() request: AuthenticatedRequest, @Param("householdId") householdId: string, @Body() body: unknown) {
    return this.netWorth.create(request.user, parseBody(uuidSchema, householdId), parseBody(createNetWorthSchema, body));
  }
}
