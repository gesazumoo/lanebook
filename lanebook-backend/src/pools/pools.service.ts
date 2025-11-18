import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { Inject } from '@nestjs/common';

@Injectable()
export class PoolsService {
  constructor(
    @Inject('supabase') private readonly supabaseClient: SupabaseClient,
  ) {}

  async findAll(region?: string, name?: string) {
    try {
      let query = this.supabaseClient
        .from('pools')
        .select(
          'id, name, desc, address, status, length, starting_block, region, created_at',
        );

      // region 필터 적용
      if (region) {
        query = query.eq('region', region);
      }

      // name 검색 (부분 일치)
      if (name) {
        query = query.ilike('name', `%${name}%`);
      }

      const { data: pools, error } = await query;

      if (error) {
        throw new HttpException(
          {
            status: HttpStatus.INTERNAL_SERVER_ERROR,
            error: `Failed to fetch pools: ${error.message}`,
          },
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      return {
        pools: pools || [],
        count: pools?.length || 0,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          error: error.message || 'Failed to fetch pools',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getLaneScheduleStats(poolId: string, month: number) {
    try {
      // 월 유효성 검사
      if (month < 1 || month > 12) {
        throw new HttpException(
          {
            status: HttpStatus.BAD_REQUEST,
            error: 'Month must be between 1 and 12',
          },
          HttpStatus.BAD_REQUEST,
        );
      }

      // 현재 연도 가져오기 (또는 파라미터로 받을 수도 있음)
      const currentYear = new Date().getFullYear();
      const year = currentYear;

      // 해당 월의 시작일과 종료일 계산
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0); // 다음 달 0일 = 이번 달 마지막 날

      // 날짜를 YYYY-MM-DD 형식으로 변환
      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];

      // lane_schedule 조회 (해당 pool_id와 월 범위)
      const { data: schedules, error } = await this.supabaseClient
        .from('lane_schedule')
        .select('schedule_date, status')
        .eq('pool_id', poolId)
        .gte('schedule_date', startDateStr)
        .lte('schedule_date', endDateStr);

      if (error) {
        throw new HttpException(
          {
            status: HttpStatus.INTERNAL_SERVER_ERROR,
            error: `Failed to fetch lane schedules: ${error.message}`,
          },
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      // 날짜별로 그룹화하고 status별 집계 (조회된 데이터만)
      // 가능: available, 진행중: pending, 마감: confirmed + unavailable
      const statsByDate: Record<
        string,
        { 가능: number; 진행중: number; 마감: number }
      > = {};

      // 실제 데이터로 집계
      schedules?.forEach((schedule) => {
        const dateStr = schedule.schedule_date;
        if (!statsByDate[dateStr]) {
          statsByDate[dateStr] = {
            가능: 0,
            진행중: 0,
            마감: 0,
          };
        }

        const status = schedule.status?.toLowerCase() || '';
        if (status === 'available') {
          statsByDate[dateStr].가능++;
        } else if (status === 'pending') {
          statsByDate[dateStr].진행중++;
        } else if (status === 'confirmed' || status === 'unavailable') {
          statsByDate[dateStr].마감++;
        } else {
          // 다른 status는 마감으로 처리
          statsByDate[dateStr].마감++;
        }
      });

      // 결과를 배열로 변환 (날짜순 정렬)
      const data = Object.keys(statsByDate)
        .sort()
        .map((date) => ({
          [date]: statsByDate[date],
        }))
        .reduce((acc, item) => ({ ...acc, ...item }), {});

      return {
        pool_id: poolId,
        year,
        month,
        data,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          error: error.message || 'Failed to fetch lane schedule stats',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
