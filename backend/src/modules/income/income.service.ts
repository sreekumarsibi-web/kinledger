import { Injectable } from "@nestjs/common";
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
}
