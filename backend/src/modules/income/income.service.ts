import { Injectable, NotFoundException } from "@nestjs/common";
import { AuthUser } from "../../common/http";
import { DatabaseService } from "../database/database.service";
import { HouseholdsService } from "../households/households.service";

export type CreateIncomeInput = {
  source: string;
  amountCents: number;
  currency?: string;
  receivedAt: string;
  note?: string;
  isRecurring?: boolean;
};

export type UpdateIncomeInput = Partial<CreateIncomeInput>;

@Injectable()
export class IncomeService {
  constructor(
    private readonly db: DatabaseService,
    private readonly households: HouseholdsService
  ) {}

  async list(auth: AuthUser, householdId: string) {
    await this.households.assertMember(auth, householdId);
    const result = await this.db.query(
      `
        select i.*, u.display_name as created_by_name
        from income_entries i
        join users u on u.id = i.created_by
        where i.household_id = $1
        order by i.received_at desc, i.created_at desc
      `,
      [householdId]
    );
    return result.rows;
  }

  async create(auth: AuthUser, householdId: string, input: CreateIncomeInput) {
    const { user } = await this.households.assertMember(auth, householdId);
    const result = await this.db.query(
      `
        insert into income_entries (household_id, created_by, source, amount_cents, currency, received_at, note, is_recurring)
        values ($1, $2, $3, $4, $5, $6, $7, $8)
        returning *
      `,
      [
        householdId,
        user.id,
        input.source,
        input.amountCents,
        input.currency || "USD",
        input.receivedAt,
        input.note || null,
        input.isRecurring || false
      ]
    );
    return result.rows[0];
  }

  async update(auth: AuthUser, householdId: string, incomeId: string, input: UpdateIncomeInput) {
    const { user } = await this.households.assertMember(auth, householdId);
    const result = await this.db.query(
      `
        update income_entries
        set source = coalesce($4, source),
            amount_cents = coalesce($5, amount_cents),
            currency = coalesce($6, currency),
            received_at = coalesce($7, received_at),
            note = coalesce($8, note),
            is_recurring = coalesce($9, is_recurring)
        where id = $1 and household_id = $2 and created_by = $3
        returning *
      `,
      [
        incomeId,
        householdId,
        user.id,
        input.source,
        input.amountCents,
        input.currency,
        input.receivedAt,
        input.note,
        input.isRecurring
      ]
    );
    if (!result.rows[0]) throw new NotFoundException("Income entry not found");
    return result.rows[0];
  }

  async delete(auth: AuthUser, householdId: string, incomeId: string) {
    const { user } = await this.households.assertMember(auth, householdId);
    const result = await this.db.query(
      "delete from income_entries where id = $1 and household_id = $2 and created_by = $3 returning id",
      [incomeId, householdId, user.id]
    );
    if (!result.rows[0]) throw new NotFoundException("Income entry not found");
    return { id: result.rows[0].id };
  }
}
