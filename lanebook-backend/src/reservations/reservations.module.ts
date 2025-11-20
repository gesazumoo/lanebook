import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { ReservationsService } from './reservations.service';
import { ReservationsController } from './reservations.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [SupabaseModule, AuthModule],
  controllers: [ReservationsController],
  providers: [ReservationsService],
  exports: [ReservationsService],
})
export class ReservationsModule {}

