import { Body, Controller, Param, Post, Req, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { parseBody, uuidSchema } from "../../common/http";
import { AuthenticatedRequest, FirebaseAuthGuard } from "../auth/firebase-auth.guard";
import { AiService } from "./ai.service";

const askSchema = z.object({
  question: z.string().min(3).max(1000)
});

@Controller("households/:householdId/assistant")
@UseGuards(FirebaseAuthGuard)
export class AiController {
  constructor(private readonly ai: AiService) {}

  @Post("ask")
  ask(@Req() request: AuthenticatedRequest, @Param("householdId") householdId: string, @Body() body: unknown) {
    const dto = parseBody(askSchema, body);
    return this.ai.ask(request.user, parseBody(uuidSchema, householdId), dto.question);
  }
}
