-- Add route metrics columns (idempotent)
alter table routes
  add column if not exists distance_km double precision,
  add column if not exists duration_sec integer,
  add column if not exists drive_time_sec integer,
  add column if not exists service_time_sec integer,
  add column if not exists metrics_updated_at timestamptz;

-- Create index for faster metrics queries
create index if not exists idx_routes_metrics_updated_at on routes(metrics_updated_at);

-- Add comment for documentation
comment on column routes.distance_km is 'Total route distance in kilometers';
comment on column routes.duration_sec is 'Total route duration in seconds (drive + service time)';
comment on column routes.drive_time_sec is 'Total driving time in seconds';
comment on column routes.service_time_sec is 'Total service time in seconds';
comment on column routes.metrics_updated_at is 'Last time metrics were calculated';
