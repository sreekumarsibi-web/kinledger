import { Module } from "@nestjs/common";
import { UsersModule } from "../users/users.module";
import { HouseholdsController } from "./households.controller";
import { HouseholdsService } from "./households.service";

@Module({
  imports: [UsersModule],
  controllers: [HouseholdsController],
  providers: [HouseholdsService],
  exports: [HouseholdsService]
})
export class HouseholdsModule {}
