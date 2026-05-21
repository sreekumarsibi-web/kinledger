import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { parseBody, uuidSchema } from "../../common/http";
import { AuthenticatedRequest, FirebaseAuthGuard } from "../auth/firebase-auth.guard";
import { NotificationsService } from "./notifications.service";

const reminderRuleSchema = z.object({
  ruleType: z.enum(["expense_reminder", "bill_reminder", "subscription_renewal", "goal_reminder", "assigned_task", "overspending_alert"]),
  enabled: z.boolean(),
  localTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  likelyFreeWindow: z.record(z.unknown()).optional()
});

const deviceTokenSchema = z.object({
  token: z.string().min(10).max(4096),
  provider: z.enum(["expo", "fcm", "apns"]),
  platform: z.string().max(40).optional(),
  deviceName: z.string().max(120).optional()
});

@Controller("households/:householdId/notifications")
@UseGuards(FirebaseAuthGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@Req() request: AuthenticatedRequest, @Param("householdId") householdId: string) {
    return this.notifications.list(request.user, parseBody(uuidSchema, householdId));
  }

  @Get("rules")
  listRules(@Req() request: AuthenticatedRequest, @Param("householdId") householdId: string) {
    return this.notifications.listRules(request.user, parseBody(uuidSchema, householdId));
  }

  @Post("rules")
  upsertRule(@Req() request: AuthenticatedRequest, @Param("householdId") householdId: string, @Body() body: unknown) {
    return this.notifications.upsertRule(request.user, parseBody(uuidSchema, householdId), parseBody(reminderRuleSchema, body));
  }

  @Post("devices")
  registerDevice(@Req() request: AuthenticatedRequest, @Param("householdId") householdId: string, @Body() body: unknown) {
    return this.notifications.registerDevice(request.user, parseBody(uuidSchema, householdId), parseBody(deviceTokenSchema, body));
  }

  @Post("test")
  sendTest(@Req() request: AuthenticatedRequest, @Param("householdId") householdId: string) {
    return this.notifications.sendTest(request.user, parseBody(uuidSchema, householdId));
  }

  @Patch(":notificationId/read")
  markRead(@Req() request: AuthenticatedRequest, @Param("householdId") householdId: string, @Param("notificationId") notificationId: string) {
    return this.notifications.markRead(request.user, parseBody(uuidSchema, householdId), parseBody(uuidSchema, notificationId));
  }
}
