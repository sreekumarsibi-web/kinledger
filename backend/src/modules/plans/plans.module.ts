import { Module } from "@nestjs/common";
import { HouseholdsModule } from "../households/households.module";
import { PlansController } from "./plans.controller";
import { PlansService } from "./plans.service";

@Module({
  imports: [HouseholdsModule],
  controllers: [PlansController],
  providers: [PlansService]
})
export class PlansModule {}
