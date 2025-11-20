import {
  Injectable,
  HttpException,
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { SupabaseService } from '../supabase/supabase.service';
import { SupabaseClient } from '@supabase/supabase-js';
import { Inject } from '@nestjs/common';
import { MembershipStatus, UseStatus } from '../common/enums';

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
        throw new BadRequestException(authError.message);
      }

      if (!authData.user) {
        throw new InternalServerErrorException('User creation failed');
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
        throw new InternalServerErrorException(
          `Failed to create app_user: ${appUserError.message}`,
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
      throw new InternalServerErrorException(
        error.message || 'Signup failed',
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
        throw new UnauthorizedException(
          authError.message || 'Invalid email or password',
        );
      }

      if (!authData.user) {
        throw new UnauthorizedException('Authentication failed');
      }

      // 2. app_user 테이블에서 유저 정보 가져오기
      const userId = authData.user.id;

      const { data: appUser, error: appUserError } = await this.supabaseClient
        .from('app_user')
        .select('id, display_name, phone, created_at')
        .eq('id', userId)
        .maybeSingle();

      if (appUserError) {
        throw new InternalServerErrorException(
          `Failed to fetch user data: ${appUserError.message}`,
        );
      }

      if (!appUser) {
        throw new NotFoundException(
          'User profile not found. Please complete your registration.',
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
      throw new InternalServerErrorException(
        error.message || 'Signin failed',
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
        throw new UnauthorizedException(
          authError.message || 'Invalid email or password',
        );
      }

      if (!authData.user) {
        throw new UnauthorizedException('Authentication failed');
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
        throw new InternalServerErrorException(
          `Failed to fetch admin data: ${adminUserError.message}`,
        );
      }

      if (!adminUser) {
        throw new ForbiddenException(
          'Admin profile not found. This account is not an admin.',
        );
      }

      // 3. role이 'admin'인지 확인 (metadata에서)
      const userRole = authData.user.user_metadata?.role;
      if (userRole !== 'admin') {
        throw new ForbiddenException('This account is not an admin account.');
      }

      // 4. membership 테이블에서 관리하는 수영장 정보 가져오기
      // 4-1. membership에서 pool_id 목록 가져오기
      const { data: membershipList, error: membershipError } =
        await this.supabaseClient
          .from('membership')
          .select('pool_id')
          .eq('admin_id', userId)
          .eq('status', MembershipStatus.ACTIVE); // 활성화된 멤버십만

      if (membershipError) {
        throw new InternalServerErrorException(
          `Failed to fetch membership data: ${membershipError.message}`,
        );
      }

      // 4-2. pool_id 목록 추출
      const poolIds =
        membershipList?.map((m: any) => m.pool_id).filter(Boolean) || [];

      // 4-3. pools 테이블에서 수영장 상세 정보 가져오기
      let pools: any[] = [];
      if (poolIds.length > 0) {
        const { data: poolsData, error: poolsError } = await this.supabaseClient
          .from('pools')
          .select(
            'id, name, desc, address, status, length, starting_block, region, created_at',
          )
          .in('id', poolIds);

        if (poolsError) {
          throw new InternalServerErrorException(
            `Failed to fetch pool data: ${poolsError.message}`,
          );
        }

        pools = poolsData || [];
      }

      // 5. JWT 토큰 생성 (페이로드에 auth.user의 id와 role 포함)
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
        pools: pools,
        accessToken,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException(
        error.message || 'Admin signin failed',
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
        throw new UnauthorizedException('Invalid or expired token');
      }

      if (!payload.sub) {
        throw new UnauthorizedException('Invalid token payload');
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
      throw new InternalServerErrorException(
        error.message || 'Signout failed',
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
        throw new BadRequestException(authError.message);
      }

      if (!authData.user) {
        throw new InternalServerErrorException('User creation failed');
      }

      // 사용자 ID 확인
      const userId = authData.user.id;
      if (!userId) {
        throw new InternalServerErrorException('User ID is missing');
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
          status: UseStatus.USE,
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
        throw new InternalServerErrorException(
          `Failed to create admin_user: ${adminUserError.message}`,
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
          status: UseStatus.USE,
        },
        message: 'Admin user created successfully',
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException(
        error.message || 'Admin signup failed',
      );
    }
  }
}
