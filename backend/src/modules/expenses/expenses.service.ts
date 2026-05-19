import { Injectable } from "@nestjs/common";
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
}
