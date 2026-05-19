import { Body, Controller, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { parseBody, uuidSchema } from "../../common/http";
import { AuthenticatedRequest, FirebaseAuthGuard } from "../auth/firebase-auth.guard";
import { PlansService } from "./plans.service";

const selectPlanSchema = z.object({
  planCode: z.string().min(1).max(80),
  billingCycle: z.enum(["monthly", "yearly"])
});

@Controller("plans")
export class PlansController {
  constructor(private readonly plans: PlansService) {}

  @Get()
  list() {
    return this.plans.list();
  }

  @Get("households/:householdId/current")
  @UseGuards(FirebaseAuthGuard)
  current(@Req() request: AuthenticatedRequest, @Param("householdId") householdId: string) {
    return this.plans.currentForHousehold(request.user, parseBody(uuidSchema, householdId));
  }

  @Post("households/:householdId/select")
  @UseGuards(FirebaseAuthGuard)
  select(@Req() request: AuthenticatedRequest, @Param("householdId") householdId: string, @Body() body: unknown) {
    return this.plans.selectForHousehold(request.user, parseBody(uuidSchema, householdId), parseBody(selectPlanSchema, body));
  }

  @Post("households/:householdId/checkout")
  @UseGuards(FirebaseAuthGuard)
  checkout(@Req() request: AuthenticatedRequest, @Param("householdId") householdId: string, @Body() body: unknown) {
    return this.plans.createCheckout(request.user, parseBody(uuidSchema, householdId), parseBody(selectPlanSchema, body));
  }
}
