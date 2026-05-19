import { Injectable } from "@nestjs/common";
import { AuthUser } from "../../common/http";
import { DatabaseService } from "../database/database.service";
import { HouseholdsService } from "../households/households.service";

type CreateGoalInput = {
  name: string;
  targetCents: number;
  savedCents?: number;
  targetMonth?: string;
};

@Injectable()
export class GoalsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly households: HouseholdsService
  ) {}

  async list(auth: AuthUser, householdId: string) {
    await this.households.assertMember(auth, householdId);
    const result = await this.db.query("select * from goals where household_id = $1 order by created_at desc", [householdId]);
    return result.rows;
  }

  async create(auth: AuthUser, householdId: string, input: CreateGoalInput) {
    const { user } = await this.households.assertMember(auth, householdId);
    const monthlyContribution = this.suggestMonthlyContribution(input.targetCents, input.savedCents || 0, input.targetMonth);
    const result = await this.db.query(
      `
        insert into goals (household_id, created_by, name, target_cents, saved_cents, target_month, monthly_contribution_cents)
        values ($1, $2, $3, $4, $5, $6, $7)
        returning *
      `,
      [householdId, user.id, input.name, input.targetCents, input.savedCents || 0, input.targetMonth ? `${input.targetMonth}-01` : null, monthlyContribution]
    );
    return result.rows[0];
  }

  private suggestMonthlyContribution(targetCents: number, savedCents: number, targetMonth?: string) {
    if (!targetMonth) return targetCents - savedCents;
    const [year, month] = targetMonth.split("-").map(Number);
    const end = new Date(year, month - 1, 1);
    const now = new Date();
    const months = Math.max(1, (end.getFullYear() - now.getFullYear()) * 12 + end.getMonth() - now.getMonth() + 1);
    return Math.max(0, Math.ceil((targetCents - savedCents) / months));
  }
}
