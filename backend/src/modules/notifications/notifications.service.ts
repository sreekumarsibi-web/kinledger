import { Injectable } from "@nestjs/common";
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
export class NotificationsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly households: HouseholdsService
  ) {}

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
