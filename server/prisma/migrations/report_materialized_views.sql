CREATE MATERIALIZED VIEW IF NOT EXISTS "ReportPaymentDetailFacts" AS
SELECT
  p."PaymentID" AS "PaymentID",
  p."BookingID" AS "BookingID",
  b."UserID" AS "UserID",
  p."Amount"::numeric AS "Amount",
  p."PaidAt" AS "PaidAt",
  EXTRACT(YEAR FROM p."PaidAt")::int AS "PaidYear",
  EXTRACT(MONTH FROM p."PaidAt")::int AS "PaidMonth",
  b."BookingTimestamp" AS "BookingTimestamp",
  EXTRACT(YEAR FROM b."BookingTimestamp")::int AS "BookingYear",
  EXTRACT(MONTH FROM b."BookingTimestamp")::int AS "BookingMonth",
  bd."DetailID" AS "DetailID",
  bd."ShowtimeID" AS "ShowtimeID",
  bd."SeatID" AS "SeatID",
  s."VenueID" AS "VenueID",
  v."VenueName" AS "VenueName",
  s."EventID" AS "EventID",
  e."CategoryID" AS "CategoryID",
  ec."CategoryName" AS "CategoryName",
  s."StartDateTime" AS "ShowtimeStart"
FROM "Payments" p
JOIN "Bookings" b ON p."BookingID" = b."BookingID"
JOIN "BookingDetails" bd ON bd."BookingID" = b."BookingID"
JOIN "Showtimes" s ON bd."ShowtimeID" = s."ShowtimeID"
JOIN "Venues" v ON s."VenueID" = v."VenueID"
JOIN "Events" e ON s."EventID" = e."EventID"
JOIN "EventCategories" ec ON e."CategoryID" = ec."CategoryID"
WHERE p."StatusID" = 2
  AND p."PaidAt" IS NOT NULL
WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS idx_report_payment_detail_facts_detail
ON "ReportPaymentDetailFacts" ("DetailID");

CREATE INDEX IF NOT EXISTS idx_report_payment_detail_facts_paid
ON "ReportPaymentDetailFacts" ("PaidAt");

CREATE INDEX IF NOT EXISTS idx_report_payment_detail_facts_paid_category_venue
ON "ReportPaymentDetailFacts" ("PaidAt", "CategoryName", "VenueID");

CREATE INDEX IF NOT EXISTS idx_report_payment_detail_facts_category_month
ON "ReportPaymentDetailFacts" ("CategoryName", "PaidYear", "PaidMonth");

CREATE INDEX IF NOT EXISTS idx_report_payment_detail_facts_venue_month
ON "ReportPaymentDetailFacts" ("VenueName", "PaidYear", "PaidMonth");

CREATE INDEX IF NOT EXISTS idx_report_payment_detail_facts_payment
ON "ReportPaymentDetailFacts" ("PaymentID");

CREATE MATERIALIZED VIEW IF NOT EXISTS "ReportBookingDetailFacts" AS
SELECT
  b."BookingID" AS "BookingID",
  b."UserID" AS "UserID",
  b."StatusID" AS "BookingStatusID",
  bs."StatusName" AS "BookingStatusName",
  b."BookingTimestamp" AS "BookingTimestamp",
  EXTRACT(YEAR FROM b."BookingTimestamp")::int AS "BookingYear",
  EXTRACT(MONTH FROM b."BookingTimestamp")::int AS "BookingMonth",
  bd."DetailID" AS "DetailID",
  bd."ShowtimeID" AS "ShowtimeID",
  bd."SeatID" AS "SeatID",
  s."VenueID" AS "VenueID",
  v."VenueName" AS "VenueName",
  s."EventID" AS "EventID",
  e."CategoryID" AS "CategoryID",
  ec."CategoryName" AS "CategoryName",
  s."StartDateTime" AS "ShowtimeStart"
FROM "Bookings" b
JOIN "BookingStatuses" bs ON b."StatusID" = bs."StatusID"
JOIN "BookingDetails" bd ON bd."BookingID" = b."BookingID"
JOIN "Showtimes" s ON bd."ShowtimeID" = s."ShowtimeID"
JOIN "Venues" v ON s."VenueID" = v."VenueID"
JOIN "Events" e ON s."EventID" = e."EventID"
JOIN "EventCategories" ec ON e."CategoryID" = ec."CategoryID"
WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS idx_report_booking_detail_facts_detail
ON "ReportBookingDetailFacts" ("DetailID");

CREATE INDEX IF NOT EXISTS idx_report_booking_detail_facts_booking_time
ON "ReportBookingDetailFacts" ("BookingTimestamp");

CREATE INDEX IF NOT EXISTS idx_report_booking_detail_facts_status_time
ON "ReportBookingDetailFacts" ("BookingStatusID", "BookingTimestamp");

CREATE INDEX IF NOT EXISTS idx_report_booking_detail_facts_category_month
ON "ReportBookingDetailFacts" ("CategoryName", "BookingYear", "BookingMonth");

CREATE INDEX IF NOT EXISTS idx_report_booking_detail_facts_time_category_venue
ON "ReportBookingDetailFacts" ("BookingTimestamp", "CategoryName", "VenueID");

REFRESH MATERIALIZED VIEW "ReportPaymentDetailFacts";
REFRESH MATERIALIZED VIEW "ReportBookingDetailFacts";
