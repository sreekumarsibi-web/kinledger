import { Injectable } from "@nestjs/common";
import { AuthUser } from "../../common/http";
import { DatabaseService } from "../database/database.service";
import { HouseholdsService } from "../households/households.service";

type CreateTaskInput = {
  assigneeId: string;
  title: string;
  dueDate?: string;
  priority: "low" | "medium" | "high";
  notes?: string;
};

@Injectable()
export class TasksService {
  constructor(
    private readonly db: DatabaseService,
    private readonly households: HouseholdsService
  ) {}

  async list(auth: AuthUser, householdId: string) {
    await this.households.assertMember(auth, householdId);
    const result = await this.db.query(
      `
        select t.*, assignee.display_name as assignee_name, creator.display_name as creator_name
        from tasks t
        join users assignee on assignee.id = t.assignee_id
        join users creator on creator.id = t.created_by
        where t.household_id = $1
        order by t.status asc, t.due_date asc nulls last, t.created_at desc
      `,
      [householdId]
    );
    return result.rows;
  }

  async create(auth: AuthUser, householdId: string, input: CreateTaskInput) {
    const { user } = await this.households.assertMember(auth, householdId);
    const result = await this.db.query(
      `
        insert into tasks (household_id, created_by, assignee_id, title, due_date, priority, notes)
        values ($1, $2, $3, $4, $5, $6, $7)
        returning *
      `,
      [householdId, user.id, input.assigneeId, input.title, input.dueDate || null, input.priority, input.notes || null]
    );
    return result.rows[0];
  }

  async complete(auth: AuthUser, householdId: string, taskId: string) {
    await this.households.assertMember(auth, householdId);
    const result = await this.db.query(
      "update tasks set status = 'completed', completed_at = now() where household_id = $1 and id = $2 returning *",
      [householdId, taskId]
    );
    return result.rows[0];
  }
}
