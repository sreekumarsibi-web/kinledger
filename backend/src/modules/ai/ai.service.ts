import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AuthUser } from "../../common/http";
import { DatabaseService } from "../database/database.service";
import { HouseholdsService } from "../households/households.service";

@Injectable()
export class AiService {
  constructor(
    private readonly db: DatabaseService,
    private readonly households: HouseholdsService,
    private readonly config: ConfigService
  ) {}

  async ask(auth: AuthUser, householdId: string, question: string) {
    const { user } = await this.households.assertMember(auth, householdId);
    const summary = await this.householdSummary(householdId);
    const answer = await this.openAiAnswer(question, summary).catch(() => this.localAnswer(question, summary));

    await this.db.query(
      "insert into ai_assistant_messages (household_id, user_id, question, answer, context_snapshot) values ($1, $2, $3, $4, $5)",
      [householdId, user.id, question, answer, summary]
    );

    return { answer, summary };
  }

  private async householdSummary(householdId: string) {
    const expenses = await this.db.query<{ category: string; amount_cents: number }>(
      `
        select category, sum(amount_cents)::int as amount_cents
        from expenses
        where household_id = $1 and spent_at >= date_trunc('month', current_date)
        group by category
        order by amount_cents desc
      `,
      [householdId]
    );
    const subscriptions = await this.db.query<{ monthly_burn_cents: number }>(
      "select coalesce(sum(case when billing_cycle = 'yearly' then cost_cents / 12 else cost_cents end), 0)::int as monthly_burn_cents from recurring_subscriptions where household_id = $1 and is_active = true",
      [householdId]
    );
    return {
      categorySpend: expenses.rows,
      monthlySubscriptionBurnCents: subscriptions.rows[0]?.monthly_burn_cents || 0
    };
  }

  private localAnswer(question: string, summary: { categorySpend: { category: string; amount_cents: number }[]; monthlySubscriptionBurnCents: number }) {
    const biggest = summary.categorySpend[0];
    const burn = summary.monthlySubscriptionBurnCents;
    const lead = biggest ? `${biggest.category} is currently the largest spending category.` : "There is not enough spending data yet.";
    const subscriptionNote = burn > 0 ? ` Monthly subscriptions add about ${Math.round(burn / 100)} USD of recurring burn.` : "";
    return `${lead}${subscriptionNote} For "${question}", use a conservative rule: keep the purchase below leftover cash after bills, subscriptions, and planned goal contributions.`;
  }

  private async openAiAnswer(question: string, summary: { categorySpend: { category: string; amount_cents: number }[]; monthlySubscriptionBurnCents: number }) {
    const apiKey = this.config.get<string>("OPENAI_API_KEY");
    if (!apiKey) return this.localAnswer(question, summary);

    const model = this.config.get<string>("OPENAI_MODEL") || "gpt-4.1-mini";
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        input: [
          {
            role: "system",
            content: "You are KinLedger's financial assistant. Give concise, practical budgeting guidance. Do not provide investment, legal, or tax advice. Use the provided household summary only."
          },
          {
            role: "user",
            content: JSON.stringify({
              question,
              householdSummary: summary
            })
          }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(await response.text());
    }

    const data = await response.json() as { output_text?: string; output?: { content?: { text?: string }[] }[] };
    return data.output_text || data.output?.flatMap((item) => item.content || []).map((item) => item.text).filter(Boolean).join("\n") || this.localAnswer(question, summary);
  }
}
