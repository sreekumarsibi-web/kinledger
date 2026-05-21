import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AuthUser } from "../../common/http";
import { DatabaseService } from "../database/database.service";
import { HouseholdsService } from "../households/households.service";

type ReminderRuleInput = {
  ruleType: "expense_reminder" | "bill_reminder" | "subscription_renewal" | "goal_reminder" | "assigned_task" | "overspending_alert";
  enabled: boolean;
  localTime?: string;
  likelyFreeWindow?: Record<string, unknown>;
};

type DeviceTokenInput = {
  token: string;
  provider: "expo" | "fcm" | "apns";
  platform?: string;
  deviceName?: string;
};

@Injectable()
export class NotificationsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationsService.name);
  private scheduler?: NodeJS.Timeout;

  constructor(
    private readonly db: DatabaseService,
    private readonly households: HouseholdsService,
    private readonly config: ConfigService
  ) {}

  onModuleInit() {
    if (this.config.get<string>("NOTIFICATION_WORKER_ENABLED") === "false") return;
    this.scheduler = setInterval(() => {
      this.processDueReminders().catch((error) => this.logger.error(error));
    }, 60_000);
    this.processDueReminders().catch((error) => this.logger.error(error));
  }

  onModuleDestroy() {
    if (this.scheduler) clearInterval(this.scheduler);
  }

  async list(auth: AuthUser, householdId: string) {
    const { user } = await this.households.assertMember(auth, householdId);
    const result = await this.db.query(
      "select * from notifications where household_id = $1 and user_id = $2 order by created_at desc limit 100",
      [householdId, user.id]
    );
    return result.rows;
  }

  async listRules(auth: AuthUser, householdId: string) {
    const { user } = await this.households.assertMember(auth, householdId);
    const result = await this.db.query(
      "select * from reminder_rules where household_id = $1 and user_id = $2 order by created_at desc",
      [householdId, user.id]
    );
    return result.rows;
  }

  async upsertRule(auth: AuthUser, householdId: string, input: ReminderRuleInput) {
    const { user } = await this.households.assertMember(auth, householdId);
    return this.db.transaction(async (db) => {
      await db.query(
        "delete from reminder_rules where household_id = $1 and user_id = $2 and rule_type = $3",
        [householdId, user.id, input.ruleType]
      );
      const result = await db.query(
        `
          insert into reminder_rules (household_id, user_id, rule_type, enabled, local_time, likely_free_window)
          values ($1, $2, $3, $4, $5, $6)
          returning *
        `,
        [householdId, user.id, input.ruleType, input.enabled, input.localTime || null, input.likelyFreeWindow || null]
      );
      return result.rows[0];
    });
  }

  async registerDevice(auth: AuthUser, householdId: string, input: DeviceTokenInput) {
    const { user } = await this.households.assertMember(auth, householdId);
    const result = await this.db.query(
      `
        insert into device_tokens (user_id, provider, token, platform, device_name, is_active, last_seen_at)
        values ($1, $2, $3, $4, $5, true, now())
        on conflict (token) do update
        set user_id = excluded.user_id,
            provider = excluded.provider,
            platform = excluded.platform,
            device_name = excluded.device_name,
            is_active = true,
            last_seen_at = now()
        returning id, provider, platform, device_name, is_active, last_seen_at
      `,
      [user.id, input.provider, input.token, input.platform || null, input.deviceName || null]
    );
    return result.rows[0];
  }

  async sendTest(auth: AuthUser, householdId: string) {
    const { user } = await this.households.assertMember(auth, householdId);
    const tokens = await this.db.query<{ token: string; provider: string }>(
      "select token, provider from device_tokens where user_id = $1 and is_active = true order by last_seen_at desc limit 5",
      [user.id]
    );

    const notification = await this.db.query(
      `
        insert into notifications (household_id, user_id, type, title, body, deep_link, scheduled_for, sent_at)
        values ($1, $2, 'expense_reminder', 'KinLedger test', 'Push notifications are connected.', 'kinledger://notifications', now(), now())
        returning *
      `,
      [householdId, user.id]
    );

    const deliveries = [];
    for (const row of tokens.rows) {
      if (row.provider === "expo") {
        deliveries.push(await this.sendExpo(row.token, "KinLedger test", "Push notifications are connected."));
      } else {
        deliveries.push({ provider: row.provider, sent: false, reason: "Provider sender not configured yet" });
      }
    }

    return { notification: notification.rows[0], deliveries, tokenCount: tokens.rowCount };
  }

  async markRead(auth: AuthUser, householdId: string, notificationId: string) {
    const { user } = await this.households.assertMember(auth, householdId);
    const result = await this.db.query(
      "update notifications set read_at = now() where id = $1 and household_id = $2 and user_id = $3 returning *",
      [notificationId, householdId, user.id]
    );
    return result.rows[0] || null;
  }

  async notifyUser(householdId: string, userId: string, type: ReminderRuleInput["ruleType"], title: string, body: string, deepLink: string) {
    const notification = await this.db.query(
      `
        insert into notifications (household_id, user_id, type, title, body, deep_link, scheduled_for, sent_at)
        values ($1, $2, $3, $4, $5, $6, now(), now())
        returning *
      `,
      [householdId, userId, type, title, body, deepLink]
    );
    await this.sendToUserDevices(userId, title, body);
    return notification.rows[0];
  }

  async processDueReminders() {
    const dueRules = await this.db.query<{
      id: string;
      household_id: string;
      user_id: string;
      rule_type: ReminderRuleInput["ruleType"];
      local_time: string;
    }>(
      `
        select id, household_id, user_id, rule_type, local_time::text
        from reminder_rules
        where enabled = true
          and local_time is not null
          and to_char(local_time::time, 'HH24:MI') = to_char(now() at time zone coalesce(likely_free_window->>'timeZone', 'UTC'), 'HH24:MI')
          and not exists (
            select 1
            from notifications n
            where n.household_id = reminder_rules.household_id
              and n.user_id = reminder_rules.user_id
              and n.type = reminder_rules.rule_type
              and (n.created_at at time zone coalesce(reminder_rules.likely_free_window->>'timeZone', 'UTC'))::date = (now() at time zone coalesce(reminder_rules.likely_free_window->>'timeZone', 'UTC'))::date
          )
        limit 100
      `
    );

    for (const rule of dueRules.rows) {
      await this.createAndSendReminder(rule.household_id, rule.user_id, rule.rule_type);
    }

    await this.processDueTaskReminders();
  }

  private async processDueTaskReminders() {
    const tasks = await this.db.query<{
      id: string;
      household_id: string;
      assignee_id: string;
      title: string;
    }>(
      `
        update tasks
        set reminder_sent_at = now()
        where status = 'pending'
          and reminder_at is not null
          and reminder_sent_at is null
          and reminder_at <= now()
        returning id, household_id, assignee_id, title
      `
    );

    for (const task of tasks.rows) {
      await this.notifyUser(
        task.household_id,
        task.assignee_id,
        "assigned_task",
        "Task reminder",
        `Reminder: ${task.title}`,
        "kinledger://tasks"
      );
    }
  }

  private async createAndSendReminder(householdId: string, userId: string, ruleType: ReminderRuleInput["ruleType"]) {
    const copy = this.reminderCopy(ruleType);
    return this.notifyUser(householdId, userId, ruleType, copy.title, copy.body, copy.deepLink);
  }

  private async sendToUserDevices(userId: string, title: string, body: string) {
    const tokens = await this.db.query<{ token: string; provider: string }>(
      "select token, provider from device_tokens where user_id = $1 and is_active = true order by last_seen_at desc limit 5",
      [userId]
    );

    for (const row of tokens.rows) {
      if (row.provider === "expo") {
        await this.sendExpo(row.token, title, body);
      }
    }
  }

  private reminderCopy(ruleType: ReminderRuleInput["ruleType"]) {
    const copy: Record<ReminderRuleInput["ruleType"], { title: string; body: string; deepLink: string }> = {
      expense_reminder: {
        title: "Add today's expenses",
        body: "Take a minute to log anything you spent today.",
        deepLink: "kinledger://expenses"
      },
      bill_reminder: {
        title: "Bill reminder",
        body: "Check upcoming bills and mark payments before they are missed.",
        deepLink: "kinledger://subscriptions"
      },
      subscription_renewal: {
        title: "Subscription renewal",
        body: "Review upcoming renewals and cancel anything you no longer use.",
        deepLink: "kinledger://subscriptions"
      },
      goal_reminder: {
        title: "Goal contribution",
        body: "Review your goals and add this month's contribution.",
        deepLink: "kinledger://goals"
      },
      assigned_task: {
        title: "Money task reminder",
        body: "Check your pending household finance tasks.",
        deepLink: "kinledger://tasks"
      },
      overspending_alert: {
        title: "Spending check",
        body: "Review your latest spending before the budget drifts.",
        deepLink: "kinledger://analytics"
      }
    };
    return copy[ruleType];
  }

  private async sendExpo(token: string, title: string, body: string) {
    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        to: token,
        sound: "default",
        title,
        body
      })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) return { provider: "expo", sent: false, reason: data, token };
    return { provider: "expo", sent: true, response: data };
  }
}
