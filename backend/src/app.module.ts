import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AiModule } from "./modules/ai/ai.module";
import { AuthModule } from "./modules/auth/auth.module";
import { DatabaseModule } from "./modules/database/database.module";
import { EmailModule } from "./modules/email/email.module";
import { ExpensesModule } from "./modules/expenses/expenses.module";
import { GoalsModule } from "./modules/goals/goals.module";
import { HealthModule } from "./modules/health/health.module";
import { HouseholdsModule } from "./modules/households/households.module";
import { IncomeModule } from "./modules/income/income.module";
import { NetWorthModule } from "./modules/net-worth/net-worth.module";
import { NotificationsModule } from "./modules/notifications/notifications.module";
import { PlansModule } from "./modules/plans/plans.module";
import { SubscriptionsModule } from "./modules/subscriptions/subscriptions.module";
import { TasksModule } from "./modules/tasks/tasks.module";
import { UsersModule } from "./modules/users/users.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    EmailModule,
    AuthModule,
    UsersModule,
    HealthModule,
    HouseholdsModule,
    IncomeModule,
    PlansModule,
    ExpensesModule,
    TasksModule,
    SubscriptionsModule,
    GoalsModule,
    NetWorthModule,
    NotificationsModule,
    AiModule
  ]
})
export class AppModule {}
