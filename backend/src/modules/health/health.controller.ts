import { Controller, Get } from "@nestjs/common";

@Controller("health")
export class HealthController {
  @Get()
  check() {
    return {
      ok: true,
      service: "kinledger-backend",
      timestamp: new Date().toISOString()
    };
  }
}
