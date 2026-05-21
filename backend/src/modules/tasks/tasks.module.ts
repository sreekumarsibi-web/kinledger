import { Module } from "@nestjs/common";
import { HouseholdsModule } from "../households/households.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { TasksController } from "./tasks.controller";
import { TasksService } from "./tasks.service";

@Module({
  imports: [HouseholdsModule, NotificationsModule],
  controllers: [TasksController],
  providers: [TasksService]
})
export class TasksModule {}
