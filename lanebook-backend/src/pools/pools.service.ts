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

  async getLaneScheduleDetail(poolId: string, date: string) {
    try {
      // 날짜 형식 검증 (YYYY-MM-DD)
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(date)) {
        throw new HttpException(
          {
            status: HttpStatus.BAD_REQUEST,
            error: 'Date must be in YYYY-MM-DD format',
          },
          HttpStatus.BAD_REQUEST,
        );
      }

      // lane_schedule 조회 (pool_id와 schedule_date로 필터링)
      // lanes 테이블과 join해서 lane_no 정보도 가져오기
      const { data: schedules, error } = await this.supabaseClient
        .from('lane_schedule')
        .select(
          `
          id,
          lane_id,
          starts_at,
          ends_at,
          status,
          capacity,
          price_amount,
          lanes!lane_schedule_lane_id_fkey (
            lane_no
          )
        `,
        )
        .eq('pool_id', poolId)
        .eq('schedule_date', date)
        .order('starts_at', { ascending: true });

      if (error) {
        throw new HttpException(
          {
            status: HttpStatus.INTERNAL_SERVER_ERROR,
            error: `Failed to fetch lane schedules: ${error.message}`,
          },
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      if (!schedules || schedules.length === 0) {
        return {
          pool_id: poolId,
          date,
          data: [],
        };
      }

      // 레인별로 그룹화
      const lanesMap = new Map<
        string,
        {
          lane_id: string;
          name: string;
          schedule: Array<{
            time: string;
            status: string;
            capacity: number | null;
            price_amount: number | null;
            description: string | null;
          }>;
        }
      >();

      schedules.forEach((schedule: any) => {
        const laneId = schedule.lane_id;
        const laneNo = schedule.lanes?.lane_no || 0;
        const laneName = `${laneNo}레인`;

        if (!lanesMap.has(laneId)) {
          lanesMap.set(laneId, {
            lane_id: laneId,
            name: laneName,
            schedule: [],
          });
        }

        // 시간 형식 변환 (HH:MM ~ HH:MM)
        const startTime = new Date(schedule.starts_at);
        const endTime = new Date(schedule.ends_at);
        const startHours = String(startTime.getHours()).padStart(2, '0');
        const startMinutes = String(startTime.getMinutes()).padStart(2, '0');
        const endHours = String(endTime.getHours()).padStart(2, '0');
        const endMinutes = String(endTime.getMinutes()).padStart(2, '0');
        const timeRange = `${startHours}:${startMinutes} ~ ${endHours}:${endMinutes}`;

        const laneData = lanesMap.get(laneId);
        if (laneData) {
          laneData.schedule.push({
            time: timeRange,
            status: schedule.status || 'available',
            capacity: schedule.capacity,
            price_amount: schedule.price_amount,
            description: null, // description 필드가 없으므로 null 처리
          });
        }
      });

      // 레인 번호순으로 정렬하고 배열로 변환
      const data = Array.from(lanesMap.values()).sort((a, b) => {
        const aNo = parseInt(a.name.replace('레인', ''));
        const bNo = parseInt(b.name.replace('레인', ''));
        return aNo - bNo;
      });

      return {
        pool_id: poolId,
        date,
        data,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          error: error.message || 'Failed to fetch lane schedule detail',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
