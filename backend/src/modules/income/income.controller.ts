import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { parseBody, uuidSchema } from "../../common/http";
import { AuthenticatedRequest, FirebaseAuthGuard } from "../auth/firebase-auth.guard";
import { IncomeService } from "./income.service";

const createIncomeSchema = z.object({
  source: z.string().min(1).max(120),
  amountCents: z.number().int().nonnegative(),
  currency: z.string().length(3).optional(),
  receivedAt: z.string().date(),
  note: z.string().max(500).optional(),
  isRecurring: z.boolean().optional()
});
const updateIncomeSchema = createIncomeSchema.partial();

@Controller("households/:householdId/income")
@UseGuards(FirebaseAuthGuard)
export class IncomeController {
  constructor(private readonly income: IncomeService) {}

  @Get()
  list(@Req() request: AuthenticatedRequest, @Param("householdId") householdId: string) {
    return this.income.list(request.user, parseBody(uuidSchema, householdId));
  }

  @Post()
  create(@Req() request: AuthenticatedRequest, @Param("householdId") householdId: string, @Body() body: unknown) {
    return this.income.create(request.user, parseBody(uuidSchema, householdId), parseBody(createIncomeSchema, body));
  }

  @Patch(":incomeId")
  update(@Req() request: AuthenticatedRequest, @Param("householdId") householdId: string, @Param("incomeId") incomeId: string, @Body() body: unknown) {
    return this.income.update(request.user, parseBody(uuidSchema, householdId), parseBody(uuidSchema, incomeId), parseBody(updateIncomeSchema, body));
  }

  @Delete(":incomeId")
  delete(@Req() request: AuthenticatedRequest, @Param("householdId") householdId: string, @Param("incomeId") incomeId: string) {
    return this.income.delete(request.user, parseBody(uuidSchema, householdId), parseBody(uuidSchema, incomeId));
  }
}
