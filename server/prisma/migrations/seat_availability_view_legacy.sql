CREATE OR REPLACE VIEW "ShowtimeAvailableSeats" AS
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
    JOIN "BookingStatuses" bs ON bs."StatusID" = b."StatusID"
    WHERE bd."ShowtimeID" = sh."ShowtimeID"
      AND bd."SeatID" = s."SeatID"
      AND (
        bs."StatusName" = 'Completed'
        OR (
          bs."StatusName" = 'Pending'
          AND b."ExpiresAt" > NOW()
        )
      )
  ) AS "IsAvailable"
FROM "Showtimes" sh
JOIN "Seats" s ON s."VenueID" = sh."VenueID"
JOIN "SeatTypes" st ON st."SeatTypeID" = s."SeatTypeID";
