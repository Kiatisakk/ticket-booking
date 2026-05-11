CREATE INDEX IF NOT EXISTS idx_bookingdetails_showtime_seat_booking
ON "BookingDetails" ("ShowtimeID", "SeatID", "BookingID");

CREATE INDEX IF NOT EXISTS idx_bookings_status_expires_booking
ON "Bookings" ("StatusID", "ExpiresAt", "BookingID");

CREATE INDEX IF NOT EXISTS idx_seats_venue_seat_order
ON "Seats" ("VenueID", "RowLabel", "SeatNumber", "SeatID");

CREATE OR REPLACE VIEW "ShowtimeAvailableSeats" AS
WITH active_statuses AS (
  SELECT
    MAX("StatusID") FILTER (WHERE "StatusName" = 'Completed') AS "CompletedStatusID",
    MAX("StatusID") FILTER (WHERE "StatusName" = 'Pending') AS "PendingStatusID"
  FROM "BookingStatuses"
)
SELECT
  sh."ShowtimeID",
  sh."EventID",
  sh."VenueID",
  sh."StartDateTime",
  s."SeatID",
  s."RowLabel",
  s."SeatNumber",
  st."SeatTypeID",
  st."TypeName" AS "SeatTypeName",
  sh."BasePrice",
  st."PriceModifier",
  (sh."BasePrice" * st."PriceModifier")::DECIMAL(10, 2) AS "CalculatedPrice",
  NOT EXISTS (
    SELECT 1
    FROM "BookingDetails" bd
    JOIN "Bookings" b ON b."BookingID" = bd."BookingID"
    CROSS JOIN active_statuses active
    WHERE bd."ShowtimeID" = sh."ShowtimeID"
      AND bd."SeatID" = s."SeatID"
      AND (
        b."StatusID" = active."CompletedStatusID"
        OR (
          b."StatusID" = active."PendingStatusID"
          AND b."ExpiresAt" > NOW()
        )
      )
  ) AS "IsAvailable"
FROM "Showtimes" sh
JOIN "Seats" s ON s."VenueID" = sh."VenueID"
JOIN "SeatTypes" st ON st."SeatTypeID" = s."SeatTypeID";
