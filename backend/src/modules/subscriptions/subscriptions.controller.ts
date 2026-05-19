import { Body, Controller, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { parseBody, uuidSchema } from "../../common/http";
import { AuthenticatedRequest, FirebaseAuthGuard } from "../auth/firebase-auth.guard";
import { SubscriptionsService } from "./subscriptions.service";

const createSubscriptionSchema = z.object({
  name: z.string().min(1).max(120),
  costCents: z.number().int().nonnegative(),
  currency: z.string().length(3).optional(),
  billingCycle: z.enum(["monthly", "yearly"]),
  renewalDate: z.string().date().optional()
});

@Controller("households/:householdId/subscriptions")
@UseGuards(FirebaseAuthGuard)
export class SubscriptionsController {
  constructor(private readonly subscriptions: SubscriptionsService) {}

  @Get()
  list(@Req() request: AuthenticatedRequest, @Param("householdId") householdId: string) {
    return this.subscriptions.list(request.user, parseBody(uuidSchema, householdId));
  }

  @Post()
  create(@Req() request: AuthenticatedRequest, @Param("householdId") householdId: string, @Body() body: unknown) {
    return this.subscriptions.create(request.user, parseBody(uuidSchema, householdId), parseBody(createSubscriptionSchema, body));
  }
}
