import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { SupabaseService } from '../supabase/supabase.service';
import { SupabaseClient } from '@supabase/supabase-js';
import { Inject } from '@nestjs/common';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly supabaseService: SupabaseService,
    @Inject('supabase') private readonly supabaseClient: SupabaseClient,
  ) {}

  async signUp(
    email: string,
    password: string,
    displayName: string,
    phone: string,
    metadata?: Record<string, any>,
  ) {
    try {
      // 1. auth.users에 사용자 생성 (meta에 role: 'user' 포함)
      const { data: authData, error: authError } =
        await this.supabaseClient.auth.signUp({
          email,
          password,
          options: {
            data: {
              role: 'user',
              ...metadata,
            },
          },
        });

      if (authError) {
        throw new HttpException(
          {
            status: HttpStatus.BAD_REQUEST,
            error: authError.message,
          },
          HttpStatus.BAD_REQUEST,
        );
      }

      if (!authData.user) {
        throw new HttpException(
          {
            status: HttpStatus.INTERNAL_SERVER_ERROR,
            error: 'User creation failed',
          },
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      // 2. app_user 테이블에 나머지 정보 저장
      const { error: appUserError } = await this.supabaseClient
        .from('app_user')
        .insert({
          id: authData.user.id,
          display_name: displayName,
          phone: phone,
        });

      if (appUserError) {
        throw new HttpException(
          {
            status: HttpStatus.INTERNAL_SERVER_ERROR,
            error: `Failed to create app_user: ${appUserError.message}`,
          },
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      return {
        user: {
          id: authData.user.id,
          email: authData.user.email,
          display_name: displayName,
          phone: phone,
        },
        message: 'User created successfully',
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          error: error.message || 'Signup failed',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async signIn(email: string, password: string) {
    try {
      // 1. Supabase로 로그인
      const { data: authData, error: authError } =
        await this.supabaseClient.auth.signInWithPassword({
          email,
          password,
        });

      if (authError) {
        throw new HttpException(
          {
            status: HttpStatus.UNAUTHORIZED,
            error: authError.message || 'Invalid email or password',
          },
          HttpStatus.UNAUTHORIZED,
        );
      }

      if (!authData.user) {
        throw new HttpException(
          {
            status: HttpStatus.UNAUTHORIZED,
            error: 'Authentication failed',
          },
          HttpStatus.UNAUTHORIZED,
        );
      }

      // 2. app_user 테이블에서 유저 정보 가져오기
      const userId = authData.user.id;

      const { data: appUser, error: appUserError } = await this.supabaseClient
        .from('app_user')
        .select('id, display_name, phone, created_at')
        .eq('id', userId)
        .maybeSingle();

      if (appUserError) {
        throw new HttpException(
          {
            status: HttpStatus.INTERNAL_SERVER_ERROR,
            error: `Failed to fetch user data: ${appUserError.message}`,
          },
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      if (!appUser) {
        throw new HttpException(
          {
            status: HttpStatus.NOT_FOUND,
            error: 'User profile not found. Please complete your registration.',
          },
          HttpStatus.NOT_FOUND,
        );
      }

      // 3. JWT 토큰 생성 (페이로드에 auth.user의 id 포함)
      const accessToken = this.jwtService.sign({
        sub: authData.user.id,
        email: authData.user.email,
      });

      return {
        user: {
          id: appUser.id,
          email: authData.user.email,
          display_name: appUser.display_name,
          phone: appUser.phone,
          created_at: appUser.created_at,
        },
        accessToken,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          error: error.message || 'Signin failed',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async signOut(accessToken: string) {
    try {
      // 1. JWT 토큰 검증
      let payload: { sub: string; email?: string };
      try {
        payload = this.jwtService.verify(accessToken);
      } catch (error) {
        throw new HttpException(
          {
            status: HttpStatus.UNAUTHORIZED,
            error: 'Invalid or expired token',
          },
          HttpStatus.UNAUTHORIZED,
        );
      }

      if (!payload.sub) {
        throw new HttpException(
          {
            status: HttpStatus.UNAUTHORIZED,
            error: 'Invalid token payload',
          },
          HttpStatus.UNAUTHORIZED,
        );
      }

      // 2. Supabase에서 로그아웃 처리
      // Supabase의 signOut은 클라이언트 측에서 사용하지만,
      // 서버 측에서는 사용자 세션을 무효화하기 위해 호출합니다.
      await this.supabaseClient.auth.signOut();

      // signOut은 클라이언트 측 세션을 종료하는 것이므로,
      // 서버 측에서는 에러가 발생할 수 있지만 무시합니다.
      // 실제로는 JWT 토큰이 만료되면 자동으로 무효화됩니다.

      return {
        message: 'Successfully signed out',
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          error: error.message || 'Signout failed',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
