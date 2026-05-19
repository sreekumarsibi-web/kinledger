import { Injectable } from "@nestjs/common";
import { AuthUser } from "../../common/http";
import { DatabaseService } from "../database/database.service";

export type DbUser = {
  id: string;
  firebase_uid: string;
  display_name: string;
  email: string | null;
  phone: string | null;
};

@Injectable()
export class UsersService {
  constructor(private readonly db: DatabaseService) {}

  async upsertFromFirebase(user: AuthUser, displayName?: string): Promise<DbUser> {
    const result = await this.db.query<DbUser>(
      `
        insert into users (firebase_uid, display_name, email, phone)
        values ($1, $2, $3, $4)
        on conflict (firebase_uid)
        do update set
          display_name = excluded.display_name,
          email = coalesce(excluded.email, users.email),
          phone = coalesce(excluded.phone, users.phone),
          updated_at = now()
        returning id, firebase_uid, display_name, email, phone
      `,
      [user.firebaseUid, displayName || user.name || user.email || user.phone || "Member", user.email || null, user.phone || null]
    );
    return result.rows[0];
  }

  async findByFirebaseUid(firebaseUid: string): Promise<DbUser | undefined> {
    const result = await this.db.query<DbUser>(
      "select id, firebase_uid, display_name, email, phone from users where firebase_uid = $1",
      [firebaseUid]
    );
    return result.rows[0];
  }

  async deleteByFirebaseUid(firebaseUid: string) {
    return this.db.transaction(async (db) => {
      const user = await db.query<DbUser>(
        "select id, firebase_uid, display_name, email, phone from users where firebase_uid = $1",
        [firebaseUid]
      );
      const current = user.rows[0];
      if (!current) return null;

      await db.query("delete from households where created_by = $1", [current.id]);
      await db.query("delete from household_members where user_id = $1", [current.id]);
      await db.query("delete from account_links where invited_by = $1 or accepted_user_id = $1", [current.id]);
      await db.query("delete from notifications where user_id = $1", [current.id]);
      await db.query("delete from reminder_rules where user_id = $1", [current.id]);
      await db.query("delete from ai_assistant_messages where user_id = $1", [current.id]);

      const deleted = await db.query<DbUser>(
        "delete from users where id = $1 returning id, firebase_uid, display_name, email, phone",
        [current.id]
      );
      return deleted.rows[0] || null;
    });
  }
}
