INSERT INTO public.lane_schedule (
  pool_id,
  lane_id,
  starts_at,
  ends_at,
  status,
  capacity,
  price_amount
)
SELECT
  l.pool_id,
  l.id AS lane_id,
  (d::date + make_time(h, 0, 0)) AT TIME ZONE 'Asia/Seoul' AS starts_at,
  (d::date + make_time(h + 1, 0, 0)) AT TIME ZONE 'Asia/Seoul' AS ends_at,
  'available'::lane_schedule_status_enum AS status,
  NULL::integer AS capacity,
  NULL::numeric AS price_amount
FROM public.lanes AS l
CROSS JOIN LATERAL (
  SELECT d, h
  FROM generate_series('2025-11-01'::date, '2025-11-30'::date, '1 day') AS d
  CROSS JOIN generate_series(8, 15) AS h  -- 08~15 → (08-09, 09-10, ..., 15-16)
  WHERE EXTRACT(ISODOW FROM d) IN (6, 7)  -- 6=토, 7=일
) AS t
WHERE l.pool_id = 'f5bee9c5-824e-4431-81f1-dec2d04d20d4';
--  AND l.is_active = true  -- 이런 플래그 있으면 추가