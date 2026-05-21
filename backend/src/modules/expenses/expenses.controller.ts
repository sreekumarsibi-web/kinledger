import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { parseBody, uuidSchema } from "../../common/http";
import { AuthenticatedRequest, FirebaseAuthGuard } from "../auth/firebase-auth.guard";
import { ExpensesService } from "./expenses.service";

const createExpenseSchema = z.object({
  category: z.string().min(1).max(80),
  amountCents: z.number().int().nonnegative(),
  currency: z.string().length(3).optional(),
  spentAt: z.string().date(),
  note: z.string().max(500).optional(),
  paymentMethod: z.string().max(80).optional(),
  scope: z.enum(["personal", "shared", "split"]),
  isPrivate: z.boolean().optional(),
  splits: z.array(z.object({
    userId: z.string().uuid(),
    shareCents: z.number().int().nonnegative()
  })).optional()
});
const updateExpenseSchema = createExpenseSchema.partial();

@Controller("households/:householdId/expenses")
@UseGuards(FirebaseAuthGuard)
export class ExpensesController {
  constructor(private readonly expenses: ExpensesService) {}

  @Get()
  list(@Req() request: AuthenticatedRequest, @Param("householdId") householdId: string) {
    return this.expenses.list(request.user, parseBody(uuidSchema, householdId));
  }

  @Post()
  create(@Req() request: AuthenticatedRequest, @Param("householdId") householdId: string, @Body() body: unknown) {
    return this.expenses.create(request.user, parseBody(uuidSchema, householdId), parseBody(createExpenseSchema, body));
  }

  @Patch(":expenseId")
  update(@Req() request: AuthenticatedRequest, @Param("householdId") householdId: string, @Param("expenseId") expenseId: string, @Body() body: unknown) {
    return this.expenses.update(request.user, parseBody(uuidSchema, householdId), parseBody(uuidSchema, expenseId), parseBody(updateExpenseSchema, body));
  }

  @Delete(":expenseId")
  delete(@Req() request: AuthenticatedRequest, @Param("householdId") householdId: string, @Param("expenseId") expenseId: string) {
    return this.expenses.delete(request.user, parseBody(uuidSchema, householdId), parseBody(uuidSchema, expenseId));
  }
}
