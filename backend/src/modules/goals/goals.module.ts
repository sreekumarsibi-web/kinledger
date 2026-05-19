import { Module } from "@nestjs/common";
import { HouseholdsModule } from "../households/households.module";
import { GoalsController } from "./goals.controller";
import { GoalsService } from "./goals.service";

@Module({
  imports: [HouseholdsModule],
  controllers: [GoalsController],
  providers: [GoalsService]
})
export class GoalsModule {}
