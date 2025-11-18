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

  async signInAdmin(email: string, password: string) {
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

      // 2. admin_user 테이블에서 관리자 정보 가져오기
      const userId = authData.user.id;

      const { data: adminUser, error: adminUserError } =
        await this.supabaseClient
          .from('admin_user')
          .select('id, display_name, phone, status, created_at')
          .eq('id', userId)
          .maybeSingle();

      if (adminUserError) {
        throw new HttpException(
          {
            status: HttpStatus.INTERNAL_SERVER_ERROR,
            error: `Failed to fetch admin data: ${adminUserError.message}`,
          },
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      if (!adminUser) {
        throw new HttpException(
          {
            status: HttpStatus.FORBIDDEN,
            error: 'Admin profile not found. This account is not an admin.',
          },
          HttpStatus.FORBIDDEN,
        );
      }

      // 3. role이 'admin'인지 확인 (metadata에서)
      const userRole = authData.user.user_metadata?.role;
      if (userRole !== 'admin') {
        throw new HttpException(
          {
            status: HttpStatus.FORBIDDEN,
            error: 'This account is not an admin account.',
          },
          HttpStatus.FORBIDDEN,
        );
      }

      // 4. JWT 토큰 생성 (페이로드에 auth.user의 id와 role 포함)
      const accessToken = this.jwtService.sign({
        sub: authData.user.id,
        email: authData.user.email,
        role: 'admin',
      });

      return {
        user: {
          id: adminUser.id,
          email: authData.user.email,
          display_name: adminUser.display_name,
          phone: adminUser.phone,
          role: 'admin',
          status: adminUser.status,
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
          error: error.message || 'Admin signin failed',
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

  // 편의상 만들어놓음.
  // 관리자는 우리가 계정을 만들어 줄것.
  async signUpAdmin(
    email: string,
    password: string,
    displayName: string,
    phone: string,
    metadata?: Record<string, any>,
  ) {
    try {
      // 1. auth.users에 사용자 생성 (meta에 role: 'admin' 포함)
      const { data: authData, error: authError } =
        await this.supabaseClient.auth.signUp({
          email,
          password,
          options: {
            data: {
              role: 'admin',
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

      // 사용자 ID 확인
      const userId = authData.user.id;
      if (!userId) {
        throw new HttpException(
          {
            status: HttpStatus.INTERNAL_SERVER_ERROR,
            error: 'User ID is missing',
          },
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      // 2. admin_user 테이블에 나머지 정보 저장 (status는 기본값 'use' 사용)
      // auth.users에 사용자가 완전히 생성될 때까지 재시도
      let adminUserData;
      let adminUserError;
      let retries = 0;
      const maxRetries = 5;

      while (retries < maxRetries) {
        const result = await this.supabaseClient.from('admin_user').insert({
          id: userId,
          display_name: displayName,
          phone: phone,
          status: 'use',
        });

        adminUserData = result.data;
        adminUserError = result.error;

        if (!adminUserError) {
          break;
        }

        // Foreign key constraint 에러인 경우 재시도
        if (
          adminUserError.message?.includes('foreign key constraint') ||
          adminUserError.message?.includes('violates foreign key')
        ) {
          retries++;
          if (retries < maxRetries) {
            await new Promise((resolve) => setTimeout(resolve, 200 * retries));
            continue;
          }
        }

        // 다른 에러인 경우 즉시 중단
        break;
      }

      if (adminUserError) {
        throw new HttpException(
          {
            status: HttpStatus.INTERNAL_SERVER_ERROR,
            error: `Failed to create admin_user: ${adminUserError.message}`,
          },
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
      console.log(adminUserData);

      return {
        user: {
          id: authData.user.id,
          email: authData.user.email,
          display_name: displayName,
          phone: phone,
          role: 'admin',
          status: 'use',
        },
        message: 'Admin user created successfully',
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          error: error.message || 'Admin signup failed',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
