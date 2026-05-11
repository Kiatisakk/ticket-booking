DROP MATERIALIZED VIEW IF EXISTS "ReportCancellationSummary";
DROP MATERIALIZED VIEW IF EXISTS "ReportHourlyBookingSummary";
DROP MATERIALIZED VIEW IF EXISTS "ReportSeatTypeRevenueSummary";
DROP MATERIALIZED VIEW IF EXISTS "ReportVenueRevenueSummary";
DROP MATERIALIZED VIEW IF EXISTS "ReportMonthlyRevenueSummary";

CREATE MATERIALIZED VIEW IF NOT EXISTS "ReportMonthlyRevenueSummary" AS
WITH payment_scope AS (
  SELECT DISTINCT
    f."PaymentID",
    f."BookingID",
    f."UserID",
    f."Amount"::numeric AS "Amount",
    f."PaidAt",
    f."PaidAt"::date AS "PaidDate",
    f."PaidYear",
    f."PaidMonth",
    f."CategoryName",
    f."VenueID",
    f."VenueName"
  FROM "ReportPaymentDetailFacts" f
),
payment_rollup AS (
  SELECT
    "PaidDate",
    "PaidYear",
    "PaidMonth",
    "CategoryName",
    "VenueID",
    "VenueName",
    COUNT("PaymentID")::int AS "PaymentCount",
    COUNT(DISTINCT "BookingID")::int AS "BookingCount",
    COUNT(DISTINCT "UserID")::int AS "UserCount",
    COALESCE(SUM("Amount"), 0)::numeric AS "Revenue"
  FROM payment_scope
  GROUP BY "PaidDate", "PaidYear", "PaidMonth", "CategoryName", "VenueID", "VenueName"
),
detail_rollup AS (
  SELECT
    f."PaidAt"::date AS "PaidDate",
    f."PaidYear",
    f."PaidMonth",
    f."CategoryName",
    f."VenueID",
    f."VenueName",
    COUNT(f."DetailID")::int AS "TicketCount"
  FROM "ReportPaymentDetailFacts" f
  GROUP BY f."PaidAt"::date, f."PaidYear", f."PaidMonth", f."CategoryName", f."VenueID", f."VenueName"
)
SELECT
  p."PaidDate",
  p."PaidYear",
  p."PaidMonth",
  p."CategoryName",
  p."VenueID",
  p."VenueName",
  p."PaymentCount",
  p."BookingCount",
  p."UserCount",
  COALESCE(d."TicketCount", 0)::int AS "TicketCount",
  p."Revenue"
FROM payment_rollup p
LEFT JOIN detail_rollup d ON d."PaidDate" = p."PaidDate"
  AND d."PaidYear" = p."PaidYear"
  AND d."PaidMonth" = p."PaidMonth"
  AND d."CategoryName" = p."CategoryName"
  AND d."VenueID" = p."VenueID"
WITH DATA;

CREATE INDEX IF NOT EXISTS idx_report_monthly_revenue_date_category_venue
ON "ReportMonthlyRevenueSummary" ("PaidDate", "CategoryName", "VenueID");

CREATE INDEX IF NOT EXISTS idx_report_monthly_revenue_month_category
ON "ReportMonthlyRevenueSummary" ("PaidYear", "PaidMonth", "CategoryName");

CREATE MATERIALIZED VIEW IF NOT EXISTS "ReportVenueRevenueSummary" AS
SELECT
  "PaidDate",
  "PaidYear",
  "PaidMonth",
  "CategoryName",
  "VenueID",
  "VenueName",
  SUM("PaymentCount")::int AS "PaymentCount",
  SUM("BookingCount")::int AS "BookingCount",
  SUM("UserCount")::int AS "UserCount",
  SUM("TicketCount")::int AS "TicketCount",
  COALESCE(SUM("Revenue"), 0)::numeric AS "Revenue"
FROM "ReportMonthlyRevenueSummary"
GROUP BY "PaidDate", "PaidYear", "PaidMonth", "CategoryName", "VenueID", "VenueName"
WITH DATA;

CREATE INDEX IF NOT EXISTS idx_report_venue_revenue_date_category
ON "ReportVenueRevenueSummary" ("PaidDate", "CategoryName", "VenueID");

CREATE INDEX IF NOT EXISTS idx_report_venue_revenue_month_venue
ON "ReportVenueRevenueSummary" ("PaidYear", "PaidMonth", "VenueName");

CREATE MATERIALIZED VIEW IF NOT EXISTS "ReportSeatTypeRevenueSummary" AS
SELECT
  s."StartDateTime"::date AS "ShowtimeDate",
  EXTRACT(YEAR FROM s."StartDateTime")::int AS "ShowtimeYear",
  EXTRACT(MONTH FROM s."StartDateTime")::int AS "ShowtimeMonth",
  ec."CategoryName",
  st."TypeName" AS "SeatType",
  COUNT(t."TicketID")::int AS "TotalTicketsSold",
  COALESCE(SUM(t."FinalPrice"), 0)::numeric AS "TotalRevenue",
  COALESCE(SUM(EXTRACT(EPOCH FROM (s."StartDateTime" - b."BookingTimestamp")) / 86400), 0)::numeric AS "TotalDaysInAdvance"
FROM "Tickets" t
JOIN "BookingDetails" bd ON t."DetailID" = bd."DetailID"
JOIN "Bookings" b ON bd."BookingID" = b."BookingID"
JOIN "Showtimes" s ON bd."ShowtimeID" = s."ShowtimeID"
JOIN "Seats" seat ON bd."SeatID" = seat."SeatID"
JOIN "SeatTypes" st ON seat."SeatTypeID" = st."SeatTypeID"
JOIN "Events" e ON s."EventID" = e."EventID"
JOIN "EventCategories" ec ON e."CategoryID" = ec."CategoryID"
WHERE b."StatusID" = (SELECT "StatusID" FROM "BookingStatuses" WHERE "StatusName" = 'Completed' LIMIT 1)
GROUP BY s."StartDateTime"::date, EXTRACT(YEAR FROM s."StartDateTime"), EXTRACT(MONTH FROM s."StartDateTime"), ec."CategoryName", st."TypeName"
WITH DATA;

CREATE INDEX IF NOT EXISTS idx_report_seat_type_revenue_date_category
ON "ReportSeatTypeRevenueSummary" ("ShowtimeDate", "CategoryName", "SeatType");

CREATE MATERIALIZED VIEW IF NOT EXISTS "ReportHourlyBookingSummary" AS
SELECT
  s."StartDateTime"::date AS "ShowtimeDate",
  EXTRACT(YEAR FROM s."StartDateTime")::int AS "ShowtimeYear",
  EXTRACT(MONTH FROM s."StartDateTime")::int AS "ShowtimeMonth",
  EXTRACT(HOUR FROM s."StartDateTime")::int AS "ShowtimeHour",
  ec."CategoryName",
  COUNT(t."TicketID")::int AS "Tickets"
FROM "Tickets" t
JOIN "BookingDetails" bd ON t."DetailID" = bd."DetailID"
JOIN "Showtimes" s ON bd."ShowtimeID" = s."ShowtimeID"
JOIN "Events" e ON s."EventID" = e."EventID"
JOIN "EventCategories" ec ON e."CategoryID" = ec."CategoryID"
GROUP BY s."StartDateTime"::date, EXTRACT(YEAR FROM s."StartDateTime"), EXTRACT(MONTH FROM s."StartDateTime"), EXTRACT(HOUR FROM s."StartDateTime"), ec."CategoryName"
WITH DATA;

CREATE INDEX IF NOT EXISTS idx_report_hourly_booking_date_category
ON "ReportHourlyBookingSummary" ("ShowtimeDate", "CategoryName", "ShowtimeHour");

CREATE MATERIALIZED VIEW IF NOT EXISTS "ReportCancellationSummary" AS
SELECT
  b."BookingTimestamp"::date AS "BookingDate",
  EXTRACT(YEAR FROM b."BookingTimestamp")::int AS "BookingYear",
  EXTRACT(MONTH FROM b."BookingTimestamp")::int AS "BookingMonth",
  EXTRACT(HOUR FROM s."StartDateTime")::int AS "ShowtimeHour",
  v."VenueID",
  v."VenueName",
  st."TypeName" AS "SeatType",
  e."EventID",
  e."Title" AS "EventTitle",
  ec."CategoryID",
  ec."CategoryName",
  COUNT(bd."DetailID")::int AS "TotalBooking",
  SUM(CASE WHEN bs."StatusName" = 'Cancelled' THEN 1 ELSE 0 END)::int AS "CancelledCount",
  ROUND(
    (SUM(CASE WHEN bs."StatusName" = 'Cancelled' THEN 1 ELSE 0 END)::numeric
      / NULLIF(COUNT(bd."DetailID"), 0) * 100),
    2
  )::float8 AS "CancelRatePercentage"
FROM "BookingDetails" bd
JOIN "Bookings" b ON bd."BookingID" = b."BookingID"
JOIN "BookingStatuses" bs ON b."StatusID" = bs."StatusID"
JOIN "Seats" seat ON bd."SeatID" = seat."SeatID"
JOIN "SeatTypes" st ON seat."SeatTypeID" = st."SeatTypeID"
JOIN "Showtimes" s ON bd."ShowtimeID" = s."ShowtimeID"
JOIN "Venues" v ON s."VenueID" = v."VenueID"
JOIN "Events" e ON s."EventID" = e."EventID"
JOIN "EventCategories" ec ON e."CategoryID" = ec."CategoryID"
GROUP BY b."BookingTimestamp"::date, EXTRACT(YEAR FROM b."BookingTimestamp"), EXTRACT(MONTH FROM b."BookingTimestamp"),
  EXTRACT(HOUR FROM s."StartDateTime"), v."VenueID", v."VenueName", st."TypeName", e."EventID", e."Title",
  ec."CategoryID", ec."CategoryName"
WITH DATA;

CREATE INDEX IF NOT EXISTS idx_report_cancellation_date_category_venue
ON "ReportCancellationSummary" ("BookingDate", "CategoryName", "VenueID");

CREATE INDEX IF NOT EXISTS idx_report_cancellation_heatmap_dims
ON "ReportCancellationSummary" ("VenueName", "SeatType", "BookingYear", "BookingMonth", "ShowtimeHour");

REFRESH MATERIALIZED VIEW "ReportMonthlyRevenueSummary";
REFRESH MATERIALIZED VIEW "ReportVenueRevenueSummary";
REFRESH MATERIALIZED VIEW "ReportSeatTypeRevenueSummary";
REFRESH MATERIALIZED VIEW "ReportHourlyBookingSummary";
REFRESH MATERIALIZED VIEW "ReportCancellationSummary";
