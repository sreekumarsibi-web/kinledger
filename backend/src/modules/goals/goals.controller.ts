import { Body, Controller, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { parseBody, uuidSchema } from "../../common/http";
import { AuthenticatedRequest, FirebaseAuthGuard } from "../auth/firebase-auth.guard";
import { GoalsService } from "./goals.service";

const createGoalSchema = z.object({
  name: z.string().min(1).max(120),
  targetCents: z.number().int().positive(),
  savedCents: z.number().int().nonnegative().optional(),
  targetMonth: z.string().regex(/^\d{4}-\d{2}$/).optional()
});

@Controller("households/:householdId/goals")
@UseGuards(FirebaseAuthGuard)
export class GoalsController {
  constructor(private readonly goals: GoalsService) {}

  @Get()
  list(@Req() request: AuthenticatedRequest, @Param("householdId") householdId: string) {
    return this.goals.list(request.user, parseBody(uuidSchema, householdId));
  }

  @Post()
  create(@Req() request: AuthenticatedRequest, @Param("householdId") householdId: string, @Body() body: unknown) {
    return this.goals.create(request.user, parseBody(uuidSchema, householdId), parseBody(createGoalSchema, body));
  }
}
