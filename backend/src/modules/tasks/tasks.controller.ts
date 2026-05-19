import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { parseBody, uuidSchema } from "../../common/http";
import { AuthenticatedRequest, FirebaseAuthGuard } from "../auth/firebase-auth.guard";
import { TasksService } from "./tasks.service";

const createTaskSchema = z.object({
  assigneeId: z.string().uuid(),
  title: z.string().min(1).max(180),
  dueDate: z.string().date().optional(),
  priority: z.enum(["low", "medium", "high"]),
  notes: z.string().max(500).optional()
});

@Controller("households/:householdId/tasks")
@UseGuards(FirebaseAuthGuard)
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Get()
  list(@Req() request: AuthenticatedRequest, @Param("householdId") householdId: string) {
    return this.tasks.list(request.user, parseBody(uuidSchema, householdId));
  }

  @Post()
  create(@Req() request: AuthenticatedRequest, @Param("householdId") householdId: string, @Body() body: unknown) {
    return this.tasks.create(request.user, parseBody(uuidSchema, householdId), parseBody(createTaskSchema, body));
  }

  @Patch(":taskId/complete")
  complete(@Req() request: AuthenticatedRequest, @Param("householdId") householdId: string, @Param("taskId") taskId: string) {
    return this.tasks.complete(request.user, parseBody(uuidSchema, householdId), parseBody(uuidSchema, taskId));
  }
}
