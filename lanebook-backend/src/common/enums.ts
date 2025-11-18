/**
 * 데이터베이스 enum 타입들을 TypeScript 상수로 관리
 */

// use_status_enum
export const UseStatus = {
  USE: 'use',
  UNUSED: 'unused',
} as const;

export type UseStatusType = typeof UseStatus[keyof typeof UseStatus];

// membership_status_enum
export const MembershipStatus = {
  ACTIVE: 'active',
  DISABLED: 'disabled',
} as const;

export type MembershipStatusType =
  typeof MembershipStatus[keyof typeof MembershipStatus];

// lane_schedule_status_enum
export const LaneScheduleStatus = {
  CONFIRMED: 'confirmed',
  AVAILABLE: 'available',
  PENDING: 'pending',
  BLOCKED: 'blocked',
} as const;

export type LaneScheduleStatusType =
  typeof LaneScheduleStatus[keyof typeof LaneScheduleStatus];

// lane_reservation_status_enum
export const LaneReservationStatus = {
  CONFIRMED: 'confirmed',
  REJECTED: 'rejected',
  PENDING: 'pending',
  CANCELED: 'canceled',
} as const;

export type LaneReservationStatusType =
  typeof LaneReservationStatus[keyof typeof LaneReservationStatus];

// pool_length_enum
export const PoolLength = {
  LENGTH_25M: '25m',
  LENGTH_50M: '50m',
} as const;

export type PoolLengthType = typeof PoolLength[keyof typeof PoolLength];

// starting_block_type_enum
export const StartingBlockType = {
  NEW: 'new',
  OLD: 'old',
  DECK: 'deck',
  MIXED: 'mixed',
} as const;

export type StartingBlockTypeType =
  typeof StartingBlockType[keyof typeof StartingBlockType];

// region_enum
export const Region = {
  SEOUL: '서울',
  GYEONGGI: '경기',
  INCHEON: '인천',
  BUSAN: '부산',
  DAEGU: '대구',
  GWANGJU: '광주',
  DAEJEON: '대전',
  ULSAN: '울산',
  SEJONG: '세종',
  GANGWON: '강원',
  CHUNGBUK: '충북',
  CHUNGNAM: '충남',
  JEONBUK: '전북',
  JEONNAM: '전남',
  GYEONGBUK: '경북',
  GYEONGNAM: '경남',
  JEJU: '제주',
} as const;

export type RegionType = typeof Region[keyof typeof Region];

