import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { createClient } from '@supabase/supabase-js';
import { SupabaseService } from './supabase.service';

@Module({
  imports: [ConfigModule],
  exports: ['supabase', SupabaseService],
  providers: [
    {
      provide: 'supabase',
      useFactory: (configService: ConfigService) => {
        const supabaseUrl = configService.get<string>('SUPABASE_URL');
        const supabaseKey = configService.get<string>('SUPABASE_KEY');

        if (!supabaseUrl || !supabaseKey) {
          throw new Error('SUPABASE_URL and SUPABASE_KEY must be set');
        }

        return createClient(supabaseUrl, supabaseKey, {
          auth: {
            autoRefreshToken: true,
            persistSession: false,
          },
          db: {
            schema: 'public',
          },
        });
      },
      inject: [ConfigService],
    },
    SupabaseService,
  ],
})
export class SupabaseModule {}
