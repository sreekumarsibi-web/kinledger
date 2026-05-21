import { Injectable, NotFoundException } from "@nestjs/common";
import { AuthUser } from "../../common/http";
import { DatabaseService } from "../database/database.service";
import { HouseholdsService } from "../households/households.service";

export type CreateExpenseInput = {
  category: string;
  amountCents: number;
  currency?: string;
  spentAt: string;
  note?: string;
  paymentMethod?: string;
  scope: "personal" | "shared" | "split";
  isPrivate?: boolean;
  splits?: { userId: string; shareCents: number }[];
};

export type UpdateExpenseInput = Partial<CreateExpenseInput>;

@Injectable()
export class ExpensesService {
  constructor(
    private readonly db: DatabaseService,
    private readonly households: HouseholdsService
  ) {}

  async list(auth: AuthUser, householdId: string) {
    const { member } = await this.households.assertMember(auth, householdId);
    const includePrivate = member.can_view_private || member.role === "owner";
    const result = await this.db.query(
      `
        select e.*, u.display_name as created_by_name
        from expenses e
        join users u on u.id = e.created_by
        where e.household_id = $1
          and ($2::boolean = true or e.is_private = false or e.scope != 'personal')
        order by e.spent_at desc, e.created_at desc
      `,
      [householdId, includePrivate]
    );
    return result.rows;
  }

  async create(auth: AuthUser, householdId: string, input: CreateExpenseInput) {
    const { user } = await this.households.assertMember(auth, householdId);
    return this.db.transaction(async (db) => {
      const expense = await db.query(
        `
          insert into expenses (household_id, created_by, category, amount_cents, currency, spent_at, note, payment_method, scope, is_private)
          values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          returning *
        `,
        [
          householdId,
          user.id,
          input.category,
          input.amountCents,
          input.currency || "USD",
          input.spentAt,
          input.note || null,
          input.paymentMethod || null,
          input.scope,
          input.isPrivate || false
        ]
      );

      for (const split of input.splits || []) {
        await db.query(
          "insert into expense_splits (expense_id, user_id, share_cents) values ($1, $2, $3)",
          [expense.rows[0].id, split.userId, split.shareCents]
        );
      }

      return expense.rows[0];
    });
  }

  async update(auth: AuthUser, householdId: string, expenseId: string, input: UpdateExpenseInput) {
    const { user } = await this.households.assertMember(auth, householdId);
    const result = await this.db.query(
      `
        update expenses
        set category = coalesce($4, category),
            amount_cents = coalesce($5, amount_cents),
            currency = coalesce($6, currency),
            spent_at = coalesce($7, spent_at),
            note = coalesce($8, note),
            payment_method = coalesce($9, payment_method),
            scope = coalesce($10, scope),
            is_private = coalesce($11, is_private)
        where id = $1 and household_id = $2 and created_by = $3
        returning *
      `,
      [
        expenseId,
        householdId,
        user.id,
        input.category,
        input.amountCents,
        input.currency,
        input.spentAt,
        input.note,
        input.paymentMethod,
        input.scope,
        input.isPrivate
      ]
    );
    if (!result.rows[0]) throw new NotFoundException("Expense not found");
    return result.rows[0];
  }

  async delete(auth: AuthUser, householdId: string, expenseId: string) {
    const { user } = await this.households.assertMember(auth, householdId);
    const result = await this.db.query(
      "delete from expenses where id = $1 and household_id = $2 and created_by = $3 returning id",
      [expenseId, householdId, user.id]
    );
    if (!result.rows[0]) throw new NotFoundException("Expense not found");
    return { id: result.rows[0].id };
  }
}
