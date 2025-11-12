import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class AuthService {
  constructor(
    @Inject('supabase')
    private readonly supabaseClient: SupabaseClient,
    private readonly jwtService: JwtService,
  ) {}

  async signUp(
    email: string,
    password: string,
    displayName: string,
    phone: string,
    metadata?: Record<string, any>,
  ) {
    try {
      // Set role to 'user' in metadata
      const userMetadata = {
        role: 'user',
        ...(metadata || {}),
      };

      const { data, error } = await this.supabaseClient.auth.signUp({
        email,
        password,
        options: {
          data: userMetadata,
        },
      });

      if (error) {
        throw new HttpException(
          {
            status: HttpStatus.BAD_REQUEST,
            error: error.message,
          },
          HttpStatus.BAD_REQUEST,
        );
      }

      // Insert into app_user table
      if (data.user) {
        const { error: appUserError } = await this.supabaseClient
          .from('app_user')
          .insert({
            id: data.user.id,
            display_name: displayName,
            phone: phone,
          });

        if (appUserError) {
          // If app_user insert fails, we should handle it
          // Optionally rollback auth user creation, but Supabase doesn't support that easily
          throw new HttpException(
            {
              status: HttpStatus.INTERNAL_SERVER_ERROR,
              error: `Failed to create app_user: ${appUserError.message}`,
            },
            HttpStatus.INTERNAL_SERVER_ERROR,
          );
        }
      }

      return {
        user: data.user,
        session: data.session,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          error: 'Failed to sign up',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async signIn(email: string, password: string) {
    try {
      // Check auth.user credentials
      const { data, error } = await this.supabaseClient.auth.signInWithPassword(
        {
          email,
          password,
        },
      );

      if (error) {
        throw new HttpException(
          {
            status: HttpStatus.UNAUTHORIZED,
            error: error.message || 'Invalid email or password',
          },
          HttpStatus.UNAUTHORIZED,
        );
      }

      if (!data.user) {
        throw new HttpException(
          {
            status: HttpStatus.UNAUTHORIZED,
            error: 'User not found',
          },
          HttpStatus.UNAUTHORIZED,
        );
      }

      // Get app_user information
      const { data: appUser, error: appUserError } = await this.supabaseClient
        .from('app_user')
        .select('*')
        .eq('id', data.user.id)
        .single();

      if (appUserError || !appUser) {
        throw new HttpException(
          {
            status: HttpStatus.NOT_FOUND,
            error: 'App user not found',
          },
          HttpStatus.NOT_FOUND,
        );
      }

      // Generate JWT token with app_user.id in payload
      const payload = { sub: appUser.id };
      const accessToken = this.jwtService.sign(payload);

      return {
        user: appUser,
        accessToken,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          error: 'Failed to sign in',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async signOut(accessToken: string) {
    try {
      // Set the session before signing out
      await this.supabaseClient.auth.setSession({
        access_token: accessToken,
        refresh_token: '',
      });

      const { error } = await this.supabaseClient.auth.signOut();

      if (error) {
        throw new HttpException(
          {
            status: HttpStatus.BAD_REQUEST,
            error: error.message,
          },
          HttpStatus.BAD_REQUEST,
        );
      }

      return { message: 'Successfully signed out' };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          error: 'Failed to sign out',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
