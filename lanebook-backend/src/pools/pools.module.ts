import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { PoolsService } from './pools.service';
import { PoolsController } from './pools.controller';

@Module({
  imports: [SupabaseModule],
  controllers: [PoolsController],
  providers: [PoolsService],
  exports: [PoolsService],
})
export class PoolsModule {}

