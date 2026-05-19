import { Global, Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { FirebaseAuthGuard } from "./firebase-auth.guard";
import { FirebaseService } from "./firebase.service";

@Global()
@Module({
  imports: [ConfigModule],
  providers: [FirebaseService, FirebaseAuthGuard],
  exports: [FirebaseService, FirebaseAuthGuard]
})
export class AuthModule {}
