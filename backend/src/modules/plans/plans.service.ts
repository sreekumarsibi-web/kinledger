import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AuthUser } from "../../common/http";
import { DatabaseService } from "../database/database.service";
import { HouseholdsService } from "../households/households.service";

type SelectPlanInput = {
  planCode: string;
  billingCycle: "monthly" | "yearly";
};

type StripeCheckoutResponse = {
  id?: string;
  url?: string;
  customer?: string;
  error?: { message?: string };
};

@Injectable()
export class PlansService {
  constructor(
    private readonly db: DatabaseService,
    private readonly households: HouseholdsService,
    private readonly config: ConfigService
  ) {}

  async list() {
    const result = await this.db.query("select * from plans where is_active = true order by monthly_price_cents asc");
    return result.rows;
  }

  async currentForHousehold(auth: AuthUser, householdId: string) {
    await this.households.assertMember(auth, householdId);
    const result = await this.db.query(
      `
        select hps.*, p.code, p.name, p.account_type, p.monthly_price_cents, p.yearly_price_cents, p.max_members
        from household_plan_subscriptions hps
        join plans p on p.id = hps.plan_id
        where hps.household_id = $1 and hps.status = 'active'
        order by hps.created_at desc
        limit 1
      `,
      [householdId]
    );
    return result.rows[0] || null;
  }

  async selectForHousehold(auth: AuthUser, householdId: string, input: SelectPlanInput) {
    await this.households.assertMember(auth, householdId, true);
    const plan = await this.db.query(
      "select * from plans where code = $1 and is_active = true",
      [input.planCode]
    );
    if (!plan.rows[0]) throw new NotFoundException("Plan not found");

    const memberCount = await this.db.query<{ count: string }>(
      "select count(*) from household_members where household_id = $1",
      [householdId]
    );
    if (Number(memberCount.rows[0]?.count || 0) > plan.rows[0].max_members) {
      throw new BadRequestException("This plan does not allow the current number of household members");
    }

    return this.db.transaction(async (db) => {
      await db.query(
        "update household_plan_subscriptions set status = 'replaced' where household_id = $1 and status = 'active'",
        [householdId]
      );
      const result = await db.query(
        `
          insert into household_plan_subscriptions (household_id, plan_id, billing_cycle, provider, status, current_period_end)
          values ($1, $2, $3, 'manual', 'active', now() + ($4::text || ' months')::interval)
          returning *
        `,
        [householdId, plan.rows[0].id, input.billingCycle, input.billingCycle === "yearly" ? 12 : 1]
      );
      return {
        ...result.rows[0],
        code: plan.rows[0].code,
        name: plan.rows[0].name,
        account_type: plan.rows[0].account_type,
        monthly_price_cents: plan.rows[0].monthly_price_cents,
        yearly_price_cents: plan.rows[0].yearly_price_cents,
        max_members: plan.rows[0].max_members
      };
    });
  }

  async createCheckout(auth: AuthUser, householdId: string, input: SelectPlanInput) {
    const { user } = await this.households.assertMember(auth, householdId, true);
    const secretKey = this.config.get<string>("STRIPE_SECRET_KEY");
    if (!secretKey) {
      throw new BadRequestException("Stripe is not configured yet. Add STRIPE_SECRET_KEY to backend/.env.");
    }

    const plan = await this.db.query(
      "select * from plans where code = $1 and is_active = true",
      [input.planCode]
    );
    const selected = plan.rows[0];
    if (!selected) throw new NotFoundException("Plan not found");

    const amount = input.billingCycle === "yearly" ? selected.yearly_price_cents : selected.monthly_price_cents;
    if (amount <= 0) {
      return {
        free: true,
        subscription: await this.selectForHousehold(auth, householdId, input)
      };
    }

    const publicUrl = this.config.get<string>("APP_PUBLIC_URL") || "http://127.0.0.1:8081";
    const params = new URLSearchParams();
    params.set("mode", "subscription");
    params.set("success_url", `${publicUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`);
    params.set("cancel_url", `${publicUrl}/billing/cancel`);
    params.set("client_reference_id", householdId);
    if (user.email) params.set("customer_email", user.email);
    params.set("metadata[householdId]", householdId);
    params.set("metadata[userId]", user.id);
    params.set("metadata[planCode]", selected.code);
    params.set("metadata[billingCycle]", input.billingCycle);
    params.set("line_items[0][quantity]", "1");
    params.set("line_items[0][price_data][currency]", "usd");
    params.set("line_items[0][price_data][unit_amount]", String(amount));
    params.set("line_items[0][price_data][recurring][interval]", input.billingCycle === "yearly" ? "year" : "month");
    params.set("line_items[0][price_data][product_data][name]", selected.name);

    const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: params
    });
    const data = await response.json().catch(() => ({})) as StripeCheckoutResponse;
    if (!response.ok) {
      throw new BadRequestException(data.error?.message || "Stripe checkout failed");
    }

    await this.db.query(
      `
        insert into household_plan_subscriptions (household_id, plan_id, billing_cycle, provider, provider_customer_id, provider_subscription_id, status)
        values ($1, $2, $3, 'stripe', $4, $5, 'checkout_pending')
      `,
      [householdId, selected.id, input.billingCycle, data.customer || null, data.id || null]
    );

    return {
      checkoutUrl: data.url,
      sessionId: data.id,
      planCode: selected.code,
      billingCycle: input.billingCycle
    };
  }
}
