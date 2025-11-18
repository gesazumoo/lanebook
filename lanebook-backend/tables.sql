-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.admin_user (
  id uuid NOT NULL,
  display_name text,
  phone text,
  status USER-DEFINED NOT NULL DEFAULT 'use'::use_status_enum,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT admin_user_pkey PRIMARY KEY (id),
  CONSTRAINT admin_user_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);
CREATE TABLE public.app_user (
  id uuid NOT NULL,
  display_name text,
  phone text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT app_user_pkey PRIMARY KEY (id),
  CONSTRAINT app_user_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);
CREATE TABLE public.lane_reservation (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  pool_id uuid NOT NULL,
  lane_id uuid NOT NULL,
  schedule_id uuid,
  user_id uuid NOT NULL,
  status USER-DEFINED NOT NULL DEFAULT 'pending'::lane_reservation_status_enum,
  requested_at timestamp with time zone NOT NULL DEFAULT now(),
  decided_at timestamp with time zone,
  note text,
  final_price_amount numeric,
  CONSTRAINT lane_reservation_pkey PRIMARY KEY (id),
  CONSTRAINT lane_reservation_pool_id_fkey FOREIGN KEY (pool_id) REFERENCES public.pools(id),
  CONSTRAINT lane_reservation_lane_id_fkey FOREIGN KEY (lane_id) REFERENCES public.lanes(id),
  CONSTRAINT lane_reservation_schedule_id_fkey FOREIGN KEY (schedule_id) REFERENCES public.lane_schedule(id),
  CONSTRAINT lane_reservation_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.app_user(id)
);
CREATE TABLE public.lane_schedule (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  pool_id uuid NOT NULL,
  lane_id uuid NOT NULL,
  starts_at timestamp with time zone NOT NULL,
  ends_at timestamp with time zone NOT NULL,
  status USER-DEFINED NOT NULL DEFAULT 'available'::lane_schedule_status_enum,
  capacity integer,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  price_amount numeric,
  CONSTRAINT lane_schedule_pkey PRIMARY KEY (id),
  CONSTRAINT lane_schedule_pool_id_fkey FOREIGN KEY (pool_id) REFERENCES public.pools(id),
  CONSTRAINT lane_schedule_lane_id_fkey FOREIGN KEY (lane_id) REFERENCES public.lanes(id),
  CONSTRAINT lane_schedule_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.admin_user(id)
);
CREATE TABLE public.lanes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  pool_id uuid NOT NULL,
  lane_no integer NOT NULL,
  status USER-DEFINED NOT NULL DEFAULT 'use'::use_status_enum,
  memo text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT lanes_pkey PRIMARY KEY (id),
  CONSTRAINT lanes_pool_id_fkey FOREIGN KEY (pool_id) REFERENCES public.pools(id)
);
CREATE TABLE public.membership (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL,
  pool_id uuid NOT NULL,
  status USER-DEFINED NOT NULL DEFAULT 'active'::membership_status_enum,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT membership_pkey PRIMARY KEY (id),
  CONSTRAINT membership_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES public.admin_user(id),
  CONSTRAINT membership_pool_id_fkey FOREIGN KEY (pool_id) REFERENCES public.pools(id)
);
CREATE TABLE public.pools (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  desc text,
  name text NOT NULL,
  status USER-DEFINED NOT NULL DEFAULT 'use'::use_status_enum,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  address text,
  length USER-DEFINED NOT NULL DEFAULT '25m'::pool_length_enum,
  starting_block USER-DEFINED,
  region USER-DEFINED,
  CONSTRAINT pools_pkey PRIMARY KEY (id)
);