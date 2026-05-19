import { Module } from "@nestjs/common";
import { HouseholdsModule } from "../households/households.module";
import { IncomeController } from "./income.controller";
import { IncomeService } from "./income.service";

@Module({
  imports: [HouseholdsModule],
  controllers: [IncomeController],
  providers: [IncomeService]
})
export class IncomeModule {}
