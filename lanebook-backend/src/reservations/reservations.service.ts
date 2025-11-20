import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { Inject } from '@nestjs/common';

@Injectable()
export class ReservationsService {
  constructor(
    @Inject('supabase') private readonly supabaseClient: SupabaseClient,
  ) {}

  async createReservation(userId: string, scheduleIds: string[]) {
    try {
      // 1. schedule_ids 검증 (1-4개)
      if (!scheduleIds || scheduleIds.length === 0) {
        throw new HttpException(
          {
            status: HttpStatus.BAD_REQUEST,
            error: 'At least one schedule ID is required',
          },
          HttpStatus.BAD_REQUEST,
        );
      }

      if (scheduleIds.length > 4) {
        throw new HttpException(
          {
            status: HttpStatus.BAD_REQUEST,
            error: 'Maximum 4 schedule IDs allowed',
          },
          HttpStatus.BAD_REQUEST,
        );
      }

      // 2. reserve_multiple_lanes 함수 호출 (PostgreSQL 함수)
      // 함수와 인덱스가 중복 예약을 방지하므로 사전 확인 불필요
      const { data: reservations, error: reservationError } =
        await this.supabaseClient.rpc('reserve_multiple_lanes', {
          p_user_id: userId,
          p_schedule_ids: scheduleIds,
        });

      if (reservationError) {
        // 함수에서 발생한 에러 처리
        const errorMessage = reservationError.message || 'Reservation failed';

        // 커스텀 에러 코드 확인
        if (errorMessage.includes('slot_already_taken')) {
          throw new HttpException(
            {
              status: HttpStatus.CONFLICT,
              error: 'One or more time slots are already reserved',
            },
            HttpStatus.CONFLICT,
          );
        } else if (errorMessage.includes('invalid_schedule_id')) {
          throw new HttpException(
            {
              status: HttpStatus.BAD_REQUEST,
              error: 'Invalid schedule ID provided',
            },
            HttpStatus.BAD_REQUEST,
          );
        } else if (errorMessage.includes('no_schedules')) {
          throw new HttpException(
            {
              status: HttpStatus.BAD_REQUEST,
              error: 'No schedules provided',
            },
            HttpStatus.BAD_REQUEST,
          );
        }

        throw new HttpException(
          {
            status: HttpStatus.INTERNAL_SERVER_ERROR,
            error: `Reservation failed: ${errorMessage}`,
          },
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      if (!reservations || reservations.length === 0) {
        throw new HttpException(
          {
            status: HttpStatus.INTERNAL_SERVER_ERROR,
            error: 'Reservation failed: No reservations created',
          },
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      // 함수에서 이미 lane_schedule 상태를 pending으로 업데이트하므로 추가 작업 불필요
      return {
        message: 'Reservation created successfully',
        reservations: reservations,
        count: reservations.length,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          error: error.message || 'Failed to create reservation',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
