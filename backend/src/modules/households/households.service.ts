import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "crypto";
import { AuthUser } from "../../common/http";
import { DatabaseService } from "../database/database.service";
import { EmailService } from "../email/email.service";
import { UsersService } from "../users/users.service";

type CreateHouseholdInput = {
  name: string;
  accountType: "single" | "couple" | "family";
};

type LinkInput = {
  contact: string;
  relationship: "spouse" | "parent" | "child";
  permission: "shared_only" | "summary" | "full";
};

@Injectable()
export class HouseholdsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly users: UsersService,
    private readonly email: EmailService
  ) {}

  async listForUser(auth: AuthUser) {
    const user = await this.users.upsertFromFirebase(auth);
    const result = await this.db.query(
      `
        select h.*, hm.role, hm.permission
        from households h
        join household_members hm on hm.household_id = h.id
        where hm.user_id = $1
        order by h.created_at desc
      `,
      [user.id]
    );
    return result.rows;
  }

  async create(auth: AuthUser, input: CreateHouseholdInput) {
    const user = await this.users.upsertFromFirebase(auth);
    return this.db.transaction(async (db) => {
      const household = await db.query(
        "insert into households (name, account_type, created_by) values ($1, $2, $3) returning *",
        [input.name, input.accountType, user.id]
      );
      await db.query(
        "insert into household_members (household_id, user_id, role, permission, can_edit_shared, can_view_private) values ($1, $2, 'owner', 'full', true, true)",
        [household.rows[0].id, user.id]
      );
      return household.rows[0];
    });
  }

  async assertMember(auth: AuthUser, householdId: string, requireFull = false) {
    const user = await this.users.upsertFromFirebase(auth);
    const result = await this.db.query(
      "select * from household_members where household_id = $1 and user_id = $2",
      [householdId, user.id]
    );
    const member = result.rows[0];
    if (!member) throw new NotFoundException("Household not found");
    if (requireFull && member.permission !== "full") throw new ForbiddenException("Full household permission required");
    return { user, member };
  }

  async invite(auth: AuthUser, householdId: string, input: LinkInput) {
    const { user } = await this.assertMember(auth, householdId, true);
    const result = await this.db.query(
      `
        insert into account_links (household_id, invited_by, invited_contact, relationship, permission, invite_token, expires_at)
        values ($1, $2, $3, $4, $5, $6, now() + interval '14 days')
        returning id, invited_contact, relationship, permission, invite_token, expires_at
      `,
      [householdId, user.id, input.contact, input.relationship, input.permission, randomUUID()]
    );
    const invite = result.rows[0];
    const inviteUrl = `${process.env.APP_PUBLIC_URL || "http://127.0.0.1:8081"}/invite/${invite.invite_token}`;
    const emailResult = await this.email.sendInvite({
      to: input.contact,
      relationship: input.relationship,
      inviteUrl
    });
    return { ...invite, invite_url: inviteUrl, email: emailResult };
  }

  async members(auth: AuthUser, householdId: string) {
    await this.assertMember(auth, householdId);
    const members = await this.db.query(
      `
        select hm.id, hm.role, hm.permission, hm.can_edit_shared, hm.can_view_private,
               u.id as user_id, u.display_name, u.email, u.phone
        from household_members hm
        join users u on u.id = hm.user_id
        where hm.household_id = $1
        order by hm.joined_at asc
      `,
      [householdId]
    );
    const invites = await this.db.query(
      `
        select id, invited_contact, relationship, permission, accepted_at, expires_at
        from account_links
        where household_id = $1 and accepted_at is null
        order by expires_at asc
      `,
      [householdId]
    );
    return { members: members.rows, invites: invites.rows };
  }

  async acceptInvite(auth: AuthUser, token: string) {
    const user = await this.users.upsertFromFirebase(auth);
    return this.db.transaction(async (db) => {
      const inviteResult = await db.query(
        `
          select al.*, h.name as household_name, h.account_type
          from account_links al
          join households h on h.id = al.household_id
          where al.invite_token = $1
          for update
        `,
        [token]
      );
      const invite = inviteResult.rows[0];
      if (!invite) throw new NotFoundException("Invite not found");
      if (invite.accepted_at) throw new BadRequestException("Invite has already been accepted");
      if (new Date(invite.expires_at).getTime() < Date.now()) throw new BadRequestException("Invite has expired");

      await db.query(
        `
          insert into household_members (household_id, user_id, role, permission, can_edit_shared, can_view_private)
          values ($1, $2, $3, $4, true, $5)
          on conflict (household_id, user_id) do update
          set role = excluded.role,
              permission = excluded.permission,
              can_edit_shared = excluded.can_edit_shared,
              can_view_private = excluded.can_view_private
        `,
        [invite.household_id, user.id, invite.relationship, invite.permission, invite.permission === "full"]
      );
      await db.query(
        "update account_links set accepted_user_id = $1, accepted_at = now() where id = $2",
        [user.id, invite.id]
      );

      return {
        householdId: invite.household_id,
        householdName: invite.household_name,
        accountType: invite.account_type,
        role: invite.relationship,
        permission: invite.permission
      };
    });
  }
}
