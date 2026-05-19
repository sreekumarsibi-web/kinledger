import { Injectable } from "@nestjs/common";
import { AuthUser } from "../../common/http";
import { DatabaseService } from "../database/database.service";
import { HouseholdsService } from "../households/households.service";

type CreateNetWorthItemInput = {
  name: string;
  itemType: "asset" | "liability";
  category: string;
  valueCents: number;
  asOfDate?: string;
};

@Injectable()
export class NetWorthService {
  constructor(
    private readonly db: DatabaseService,
    private readonly households: HouseholdsService
  ) {}

  async summary(auth: AuthUser, householdId: string) {
    await this.households.assertMember(auth, householdId);
    const result = await this.db.query("select * from net_worth_items where household_id = $1 order by as_of_date desc", [householdId]);
    const totalCents = result.rows.reduce((sum, item) => sum + (item.item_type === "asset" ? item.value_cents : -item.value_cents), 0);
    return { totalCents, items: result.rows };
  }

  async create(auth: AuthUser, householdId: string, input: CreateNetWorthItemInput) {
    const { user } = await this.households.assertMember(auth, householdId);
    const result = await this.db.query(
      `
        insert into net_worth_items (household_id, created_by, name, item_type, category, value_cents, as_of_date)
        values ($1, $2, $3, $4, $5, $6, coalesce($7::date, current_date))
        returning *
      `,
      [householdId, user.id, input.name, input.itemType, input.category, input.valueCents, input.asOfDate || null]
    );
    return result.rows[0];
  }
}
