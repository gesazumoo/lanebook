-- 슬롯당 1건만 허용 (대기/확정 상태만)
CREATE UNIQUE INDEX IF NOT EXISTS idx_lane_reservation_unique_active_per_schedule
  ON public.lane_reservation (schedule_id)
  WHERE status IN (
    'pending'::lane_reservation_status_enum,
    'confirmed'::lane_reservation_status_enum
  );