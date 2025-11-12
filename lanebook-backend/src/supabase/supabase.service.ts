import { Injectable } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
  constructor(
    @Inject('supabase')
    private readonly supabaseClient: SupabaseClient,
  ) {}
}
