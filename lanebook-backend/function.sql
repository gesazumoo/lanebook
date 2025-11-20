CREATE OR REPLACE FUNCTION public.reserve_multiple_lanes(
  p_user_id uuid,
  p_schedule_ids uuid[]
)
RETURNS SETOF public.lane_reservation AS $$
DECLARE
  v_schedule_id uuid;
  v_res         public.lane_reservation;
  v_pool_id     uuid;
  v_lane_id     uuid;
BEGIN
  IF p_schedule_ids IS NULL OR array_length(p_schedule_ids, 1) = 0 THEN
    RAISE EXCEPTION 'no_schedules'
      USING ERRCODE = 'P0001';
  END IF;

  FOREACH v_schedule_id IN ARRAY p_schedule_ids
  LOOP
    -- schedule에서 pool_id, lane_id 가져오기
    SELECT ls.pool_id, ls.lane_id
    INTO v_pool_id, v_lane_id
    FROM public.lane_schedule AS ls
    WHERE ls.id = v_schedule_id;

    IF v_pool_id IS NULL OR v_lane_id IS NULL THEN
      RAISE EXCEPTION 'invalid_schedule_id %', v_schedule_id
        USING ERRCODE = 'P0001';
    END IF;

    INSERT INTO public.lane_reservation (
      pool_id,
      lane_id,
      schedule_id,
      user_id,
      status
    )
    VALUES (
      v_pool_id,
      v_lane_id,
      v_schedule_id,
      p_user_id,
      'pending'::lane_reservation_status_enum
    )
    RETURNING * INTO v_res;

    RETURN NEXT v_res;
  END LOOP;

  RETURN;

EXCEPTION
  WHEN unique_violation THEN
    -- 유니크 인덱스에 걸리면 전체 롤백 + 커스텀 에러로 변환
    RAISE EXCEPTION 'slot_already_taken'
      USING ERRCODE = 'P0001';
END;
$$ LANGUAGE plpgsql;