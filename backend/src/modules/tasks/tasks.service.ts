import { Injectable, NotFoundException } from "@nestjs/common";
import { AuthUser } from "../../common/http";
import { DatabaseService } from "../database/database.service";
import { HouseholdsService } from "../households/households.service";
import { NotificationsService } from "../notifications/notifications.service";

type CreateTaskInput = {
  assigneeId: string;
  title: string;
  dueDate?: string;
  reminderAt?: string;
  priority: "low" | "medium" | "high";
  notes?: string;
  status?: "pending" | "completed";
};
type UpdateTaskInput = Partial<Omit<CreateTaskInput, "status">> & {
  status?: "pending" | "completed" | "missed";
};

@Injectable()
export class TasksService {
  constructor(
    private readonly db: DatabaseService,
    private readonly households: HouseholdsService,
    private readonly notifications: NotificationsService
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
        insert into tasks (household_id, created_by, assignee_id, title, due_date, priority, notes, status, completed_at, reminder_at)
        values ($1, $2, $3, $4, $5, $6, $7, $8, case when $8 = 'completed' then now() else null end, $9)
        returning *
      `,
      [householdId, user.id, input.assigneeId, input.title, input.dueDate || null, input.priority, input.notes || null, input.status || "pending", input.reminderAt || null]
    );
    if (input.assigneeId !== user.id) {
      await this.notifications.notifyUser(
        householdId,
        input.assigneeId,
        "assigned_task",
        "New money task assigned",
        `${user.display_name || "A household member"} assigned: ${input.title}`,
        "kinledger://tasks"
      );
    }
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

  async update(auth: AuthUser, householdId: string, taskId: string, input: UpdateTaskInput) {
    const { user } = await this.households.assertMember(auth, householdId);
    const result = await this.db.query(
      `
        update tasks
        set assignee_id = coalesce($4, assignee_id),
            title = coalesce($5, title),
            due_date = coalesce($6, due_date),
            priority = coalesce($7, priority),
            notes = coalesce($8, notes),
            status = coalesce($9, status),
            reminder_at = coalesce($10, reminder_at),
            reminder_sent_at = case when $10 is not null then null else reminder_sent_at end,
            completed_at = case
              when $9 = 'completed' and completed_at is null then now()
              when $9 = 'pending' then null
              else completed_at
            end
        where id = $1 and household_id = $2 and created_by = $3
        returning *
      `,
      [
        taskId,
        householdId,
        user.id,
        input.assigneeId,
        input.title,
        input.dueDate,
        input.priority,
        input.notes,
        input.status,
        input.reminderAt
      ]
    );
    if (!result.rows[0]) throw new NotFoundException("Task not found");
    return result.rows[0];
  }

  async delete(auth: AuthUser, householdId: string, taskId: string) {
    const { user } = await this.households.assertMember(auth, householdId);
    const result = await this.db.query(
      "delete from tasks where id = $1 and household_id = $2 and created_by = $3 returning id",
      [taskId, householdId, user.id]
    );
    if (!result.rows[0]) throw new NotFoundException("Task not found");
    return { id: result.rows[0].id };
  }
}
