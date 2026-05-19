import { Module } from "@nestjs/common";
import { HouseholdsModule } from "../households/households.module";
import { NetWorthController } from "./net-worth.controller";
import { NetWorthService } from "./net-worth.service";

@Module({
  imports: [HouseholdsModule],
  controllers: [NetWorthController],
  providers: [NetWorthService]
})
export class NetWorthModule {}
