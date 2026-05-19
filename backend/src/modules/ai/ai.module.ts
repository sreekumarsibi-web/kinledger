import { Module } from "@nestjs/common";
import { HouseholdsModule } from "../households/households.module";
import { AiController } from "./ai.controller";
import { AiService } from "./ai.service";

@Module({
  imports: [HouseholdsModule],
  controllers: [AiController],
  providers: [AiService]
})
export class AiModule {}
