import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

type InviteEmailInput = {
  to: string;
  inviteUrl: string;
  relationship: string;
};

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly config: ConfigService) {}

  async sendInvite(input: InviteEmailInput) {
    const provider = this.config.get<string>("EMAIL_PROVIDER") || "none";
    if (provider === "none") {
      this.logger.warn(`Email provider is not configured. Invite link for ${input.to}: ${input.inviteUrl}`);
      return { sent: false, reason: "EMAIL_PROVIDER is none", inviteUrl: input.inviteUrl };
    }

    if (provider === "resend") {
      const apiKey = this.config.get<string>("RESEND_API_KEY");
      const from = this.config.get<string>("EMAIL_FROM") || "KinLedger <noreply@example.com>";
      if (!apiKey) return { sent: false, reason: "Missing RESEND_API_KEY", inviteUrl: input.inviteUrl };

      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          from,
          to: input.to,
          subject: "You have been invited to KinLedger",
          html: `<p>You were invited as ${input.relationship}.</p><p><a href="${input.inviteUrl}">Accept invite</a></p><p>${input.inviteUrl}</p>`
        })
      });

      if (!response.ok) {
        return { sent: false, reason: await response.text(), inviteUrl: input.inviteUrl };
      }
      return { sent: true, inviteUrl: input.inviteUrl };
    }

    return { sent: false, reason: `Unsupported EMAIL_PROVIDER ${provider}`, inviteUrl: input.inviteUrl };
  }
}
