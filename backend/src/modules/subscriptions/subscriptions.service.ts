import { Injectable } from "@nestjs/common";
import { AuthUser } from "../../common/http";
import { DatabaseService } from "../database/database.service";
import { HouseholdsService } from "../households/households.service";

type CreateSubscriptionInput = {
  name: string;
  costCents: number;
  currency?: string;
  billingCycle: "monthly" | "yearly";
  renewalDate?: string;
};

@Injectable()
export class SubscriptionsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly households: HouseholdsService
  ) {}

  async list(auth: AuthUser, householdId: string) {
    await this.households.assertMember(auth, householdId);
    const result = await this.db.query(
      "select * from recurring_subscriptions where household_id = $1 and is_active = true order by renewal_date asc nulls last",
      [householdId]
    );
    const monthlyBurnCents = result.rows.reduce((sum, item) => (
      sum + (item.billing_cycle === "yearly" ? Math.round(item.cost_cents / 12) : item.cost_cents)
    ), 0);
    return { monthlyBurnCents, items: result.rows };
  }

  async create(auth: AuthUser, householdId: string, input: CreateSubscriptionInput) {
    const { user } = await this.households.assertMember(auth, householdId);
    const monthly = input.billingCycle === "yearly" ? input.costCents / 12 : input.costCents;
    const recommendation = monthly > 2000 ? "Review usage before renewal; this is a high monthly burn item." : "Keep if actively used.";
    const result = await this.db.query(
      `
        insert into recurring_subscriptions (household_id, created_by, name, cost_cents, currency, billing_cycle, renewal_date, cancel_recommendation)
        values ($1, $2, $3, $4, $5, $6, $7, $8)
        returning *
      `,
      [householdId, user.id, input.name, input.costCents, input.currency || "USD", input.billingCycle, input.renewalDate || null, recommendation]
    );
    return result.rows[0];
  }
}
