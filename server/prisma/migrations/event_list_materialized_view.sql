CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE MATERIALIZED VIEW IF NOT EXISTS "EventListMetrics" AS
WITH first_showtime AS (
  SELECT DISTINCT ON (s."EventID")
    s."EventID",
    s."ShowtimeID",
    s."VenueID",
    s."BasePrice",
    s."StartDateTime",
    v."VenueName"
  FROM "Showtimes" s
  JOIN "Venues" v ON v."VenueID" = s."VenueID"
  ORDER BY s."EventID", s."StartDateTime" ASC, s."ShowtimeID" ASC
),
event_bounds AS (
  SELECT
    s."EventID",
    MIN(s."StartDateTime") AS "FirstShowtime",
    MAX(s."StartDateTime") AS "LatestShowtime"
  FROM "Showtimes" s
  GROUP BY s."EventID"
),
venue_capacity AS (
  SELECT
    s."VenueID",
    COUNT(s."SeatID")::int AS "TotalSeats"
  FROM "Seats" s
  GROUP BY s."VenueID"
),
booked_first_showtime AS (
  SELECT
    bd."ShowtimeID",
    COUNT(bd."SeatID")::int AS "BookedCount"
  FROM "BookingDetails" bd
  JOIN "Bookings" b ON b."BookingID" = bd."BookingID"
  JOIN "BookingStatuses" bs ON bs."StatusID" = b."StatusID"
  WHERE
    bs."StatusName" = 'Completed'
    OR (
      bs."StatusName" = 'Pending'
      AND b."ExpiresAt" > NOW()
    )
  GROUP BY bd."ShowtimeID"
),
booking_event_flags AS (
  SELECT DISTINCT
    s."EventID"
  FROM "Showtimes" s
  JOIN "BookingDetails" bd ON bd."ShowtimeID" = s."ShowtimeID"
)
SELECT
  e."EventID",
  e."Title",
  e."Description",
  e."CategoryID",
  c."CategoryName",
  fs."ShowtimeID" AS "FirstShowtimeID",
  fs."VenueID" AS "VenueID",
  COALESCE(fs."VenueName", '-') AS "VenueName",
  COALESCE(fs."BasePrice", 0) AS "BasePrice",
  eb."FirstShowtime",
  eb."LatestShowtime",
  COALESCE(vc."TotalSeats", 0)::int AS "TotalSeats",
  COALESCE(bfs."BookedCount", 0)::int AS "BookedSeats",
  (COALESCE(vc."TotalSeats", 0) - COALESCE(bfs."BookedCount", 0))::int AS "SeatsRemaining",
  (bef."EventID" IS NOT NULL) AS "HasBookings",
  e."CreatedAt",
  e."UpdatedAt"
FROM "Events" e
LEFT JOIN "EventCategories" c ON c."CategoryID" = e."CategoryID"
LEFT JOIN first_showtime fs ON fs."EventID" = e."EventID"
LEFT JOIN event_bounds eb ON eb."EventID" = e."EventID"
LEFT JOIN venue_capacity vc ON vc."VenueID" = fs."VenueID"
LEFT JOIN booked_first_showtime bfs ON bfs."ShowtimeID" = fs."ShowtimeID"
LEFT JOIN booking_event_flags bef ON bef."EventID" = e."EventID"
WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS idx_event_list_metrics_event
ON "EventListMetrics" ("EventID");

CREATE INDEX IF NOT EXISTS idx_event_list_metrics_event_desc
ON "EventListMetrics" ("EventID" DESC);

CREATE INDEX IF NOT EXISTS idx_event_list_metrics_category_event
ON "EventListMetrics" ("CategoryID", "EventID" DESC);

CREATE INDEX IF NOT EXISTS idx_event_list_metrics_first_showtime
ON "EventListMetrics" ("FirstShowtime", "EventID" DESC);

CREATE INDEX IF NOT EXISTS idx_event_list_metrics_latest_showtime
ON "EventListMetrics" ("LatestShowtime", "EventID" DESC);

CREATE INDEX IF NOT EXISTS idx_event_list_metrics_title_trgm
ON "EventListMetrics" USING gin ("Title" gin_trgm_ops);

REFRESH MATERIALIZED VIEW "EventListMetrics";
