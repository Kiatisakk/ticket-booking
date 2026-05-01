-- Report-aligned database constraints and views for Ticket Booking System.
-- Prisma handles table creation, primary keys, normal unique keys, and most FK
-- metadata. This file covers report requirements that Prisma cannot fully
-- express, plus safe corrections for existing databases.

-- Defaults required by the report.
ALTER TABLE "Users" ALTER COLUMN "RoleID" SET DEFAULT 3;
ALTER TABLE "Bookings" ALTER COLUMN "StatusID" SET DEFAULT 1;
ALTER TABLE "Payments" ALTER COLUMN "StatusID" SET DEFAULT 1;
ALTER TABLE "Bookings" ALTER COLUMN "BookingTimestamp" SET DEFAULT NOW();
ALTER TABLE "PaymentMethods" ALTER COLUMN "IsActive" SET DEFAULT TRUE;

-- UpdatedAt should also have a database default for direct SQL inserts.
ALTER TABLE "Roles" ALTER COLUMN "UpdatedAt" SET DEFAULT NOW();
ALTER TABLE "BookingStatuses" ALTER COLUMN "UpdatedAt" SET DEFAULT NOW();
ALTER TABLE "EventCategories" ALTER COLUMN "UpdatedAt" SET DEFAULT NOW();
ALTER TABLE "SeatTypes" ALTER COLUMN "UpdatedAt" SET DEFAULT NOW();
ALTER TABLE "Users" ALTER COLUMN "UpdatedAt" SET DEFAULT NOW();
ALTER TABLE "Venues" ALTER COLUMN "UpdatedAt" SET DEFAULT NOW();
ALTER TABLE "Events" ALTER COLUMN "UpdatedAt" SET DEFAULT NOW();
ALTER TABLE "Seats" ALTER COLUMN "UpdatedAt" SET DEFAULT NOW();
ALTER TABLE "Showtimes" ALTER COLUMN "UpdatedAt" SET DEFAULT NOW();
ALTER TABLE "Bookings" ALTER COLUMN "UpdatedAt" SET DEFAULT NOW();
ALTER TABLE "PaymentMethods" ALTER COLUMN "UpdatedAt" SET DEFAULT NOW();
ALTER TABLE "BookingDetails" ALTER COLUMN "UpdatedAt" SET DEFAULT NOW();
ALTER TABLE "PaymentStatuses" ALTER COLUMN "UpdatedAt" SET DEFAULT NOW();
ALTER TABLE "Payments" ALTER COLUMN "UpdatedAt" SET DEFAULT NOW();
ALTER TABLE "Tickets" ALTER COLUMN "UpdatedAt" SET DEFAULT NOW();

-- Required data columns (NOT NULL) from report section 6.6 and data dictionary.
ALTER TABLE "Roles" ALTER COLUMN "RoleName" SET NOT NULL;
ALTER TABLE "BookingStatuses" ALTER COLUMN "StatusName" SET NOT NULL;
ALTER TABLE "EventCategories" ALTER COLUMN "CategoryName" SET NOT NULL;
ALTER TABLE "SeatTypes" ALTER COLUMN "TypeName" SET NOT NULL;
ALTER TABLE "SeatTypes" ALTER COLUMN "PriceModifier" SET NOT NULL;
ALTER TABLE "Users" ALTER COLUMN "RoleID" SET NOT NULL;
ALTER TABLE "Users" ALTER COLUMN "FullName" SET NOT NULL;
ALTER TABLE "Users" ALTER COLUMN "Email" SET NOT NULL;
ALTER TABLE "Users" ALTER COLUMN "Password" SET NOT NULL;
ALTER TABLE "Venues" ALTER COLUMN "VenueName" SET NOT NULL;
ALTER TABLE "Events" ALTER COLUMN "CategoryID" SET NOT NULL;
ALTER TABLE "Events" ALTER COLUMN "Title" SET NOT NULL;
ALTER TABLE "Seats" ALTER COLUMN "VenueID" SET NOT NULL;
ALTER TABLE "Seats" ALTER COLUMN "SeatTypeID" SET NOT NULL;
ALTER TABLE "Seats" ALTER COLUMN "RowLabel" SET NOT NULL;
ALTER TABLE "Seats" ALTER COLUMN "SeatNumber" SET NOT NULL;
ALTER TABLE "Showtimes" ALTER COLUMN "EventID" SET NOT NULL;
ALTER TABLE "Showtimes" ALTER COLUMN "VenueID" SET NOT NULL;
ALTER TABLE "Showtimes" ALTER COLUMN "StartDateTime" SET NOT NULL;
ALTER TABLE "Showtimes" ALTER COLUMN "BasePrice" SET NOT NULL;
ALTER TABLE "Bookings" ALTER COLUMN "UserID" SET NOT NULL;
ALTER TABLE "Bookings" ALTER COLUMN "StatusID" SET NOT NULL;
ALTER TABLE "Bookings" ALTER COLUMN "BookingTimestamp" SET NOT NULL;
ALTER TABLE "Bookings" ALTER COLUMN "ExpiresAt" SET NOT NULL;
ALTER TABLE "Bookings" ALTER COLUMN "TotalAmount" SET NOT NULL;
ALTER TABLE "PaymentMethods" ALTER COLUMN "MethodName" SET NOT NULL;
ALTER TABLE "BookingDetails" ALTER COLUMN "BookingID" SET NOT NULL;
ALTER TABLE "BookingDetails" ALTER COLUMN "ShowtimeID" SET NOT NULL;
ALTER TABLE "BookingDetails" ALTER COLUMN "SeatID" SET NOT NULL;
ALTER TABLE "PaymentStatuses" ALTER COLUMN "StatusName" SET NOT NULL;
ALTER TABLE "Payments" ALTER COLUMN "BookingID" SET NOT NULL;
ALTER TABLE "Payments" ALTER COLUMN "MethodID" SET NOT NULL;
ALTER TABLE "Payments" ALTER COLUMN "StatusID" SET NOT NULL;
ALTER TABLE "Payments" ALTER COLUMN "TransactionID" SET NOT NULL;
ALTER TABLE "Payments" ALTER COLUMN "Amount" SET NOT NULL;
ALTER TABLE "Tickets" ALTER COLUMN "TicketNo" SET NOT NULL;
ALTER TABLE "Tickets" ALTER COLUMN "DetailID" SET NOT NULL;
ALTER TABLE "Tickets" ALTER COLUMN "FinalPrice" SET NOT NULL;

-- The old global unique (ShowtimeID, SeatID) blocks cancelled/expired pending
-- bookings from releasing seats. The report requires the transactional logic
-- and availability view to decide active occupancy instead.
ALTER TABLE "BookingDetails" DROP CONSTRAINT IF EXISTS "unique_pending_seat";
DROP INDEX IF EXISTS "unique_pending_seat";
ALTER TABLE "BookingDetails" DROP CONSTRAINT IF EXISTS "BookingDetails_ShowtimeID_SeatID_key";
DROP INDEX IF EXISTS "BookingDetails_ShowtimeID_SeatID_key";

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'unique_seat_position'
      AND conrelid = '"Seats"'::regclass
  ) THEN
    ALTER TABLE "Seats"
      ADD CONSTRAINT "unique_seat_position"
      UNIQUE ("VenueID", "RowLabel", "SeatNumber");
  END IF;
END $$;

-- Recreate foreign keys with the ON DELETE behavior documented in report 6.2.
ALTER TABLE "Users" DROP CONSTRAINT IF EXISTS "Users_RoleID_fkey";
ALTER TABLE "Users"
  ADD CONSTRAINT "Users_RoleID_fkey"
  FOREIGN KEY ("RoleID") REFERENCES "Roles"("RoleID")
  ON DELETE SET DEFAULT ON UPDATE CASCADE;

ALTER TABLE "Events" DROP CONSTRAINT IF EXISTS "Events_CategoryID_fkey";
ALTER TABLE "Events"
  ADD CONSTRAINT "Events_CategoryID_fkey"
  FOREIGN KEY ("CategoryID") REFERENCES "EventCategories"("CategoryID")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Seats" DROP CONSTRAINT IF EXISTS "Seats_VenueID_fkey";
ALTER TABLE "Seats"
  ADD CONSTRAINT "Seats_VenueID_fkey"
  FOREIGN KEY ("VenueID") REFERENCES "Venues"("VenueID")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Seats" DROP CONSTRAINT IF EXISTS "Seats_SeatTypeID_fkey";
ALTER TABLE "Seats"
  ADD CONSTRAINT "Seats_SeatTypeID_fkey"
  FOREIGN KEY ("SeatTypeID") REFERENCES "SeatTypes"("SeatTypeID")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Showtimes" DROP CONSTRAINT IF EXISTS "Showtimes_EventID_fkey";
ALTER TABLE "Showtimes"
  ADD CONSTRAINT "Showtimes_EventID_fkey"
  FOREIGN KEY ("EventID") REFERENCES "Events"("EventID")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Showtimes" DROP CONSTRAINT IF EXISTS "Showtimes_VenueID_fkey";
ALTER TABLE "Showtimes"
  ADD CONSTRAINT "Showtimes_VenueID_fkey"
  FOREIGN KEY ("VenueID") REFERENCES "Venues"("VenueID")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Bookings" DROP CONSTRAINT IF EXISTS "Bookings_UserID_fkey";
ALTER TABLE "Bookings"
  ADD CONSTRAINT "Bookings_UserID_fkey"
  FOREIGN KEY ("UserID") REFERENCES "Users"("UserID")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Bookings" DROP CONSTRAINT IF EXISTS "Bookings_StatusID_fkey";
ALTER TABLE "Bookings"
  ADD CONSTRAINT "Bookings_StatusID_fkey"
  FOREIGN KEY ("StatusID") REFERENCES "BookingStatuses"("StatusID")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "BookingDetails" DROP CONSTRAINT IF EXISTS "BookingDetails_BookingID_fkey";
ALTER TABLE "BookingDetails"
  ADD CONSTRAINT "BookingDetails_BookingID_fkey"
  FOREIGN KEY ("BookingID") REFERENCES "Bookings"("BookingID")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "BookingDetails" DROP CONSTRAINT IF EXISTS "BookingDetails_ShowtimeID_fkey";
ALTER TABLE "BookingDetails"
  ADD CONSTRAINT "BookingDetails_ShowtimeID_fkey"
  FOREIGN KEY ("ShowtimeID") REFERENCES "Showtimes"("ShowtimeID")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "BookingDetails" DROP CONSTRAINT IF EXISTS "BookingDetails_SeatID_fkey";
ALTER TABLE "BookingDetails"
  ADD CONSTRAINT "BookingDetails_SeatID_fkey"
  FOREIGN KEY ("SeatID") REFERENCES "Seats"("SeatID")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Payments" DROP CONSTRAINT IF EXISTS "Payments_BookingID_fkey";
ALTER TABLE "Payments"
  ADD CONSTRAINT "Payments_BookingID_fkey"
  FOREIGN KEY ("BookingID") REFERENCES "Bookings"("BookingID")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Payments" DROP CONSTRAINT IF EXISTS "Payments_MethodID_fkey";
ALTER TABLE "Payments"
  ADD CONSTRAINT "Payments_MethodID_fkey"
  FOREIGN KEY ("MethodID") REFERENCES "PaymentMethods"("MethodID")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Payments" DROP CONSTRAINT IF EXISTS "Payments_StatusID_fkey";
ALTER TABLE "Payments"
  ADD CONSTRAINT "Payments_StatusID_fkey"
  FOREIGN KEY ("StatusID") REFERENCES "PaymentStatuses"("StatusID")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Tickets" DROP CONSTRAINT IF EXISTS "Tickets_DetailID_fkey";
ALTER TABLE "Tickets"
  ADD CONSTRAINT "Tickets_DetailID_fkey"
  FOREIGN KEY ("DetailID") REFERENCES "BookingDetails"("DetailID")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- CHECK constraints from report section 6.4.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'booking_total_positive') THEN
    ALTER TABLE "Bookings"
      ADD CONSTRAINT "booking_total_positive" CHECK ("TotalAmount" >= 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'booking_expires_after_created') THEN
    ALTER TABLE "Bookings"
      ADD CONSTRAINT "booking_expires_after_created" CHECK ("ExpiresAt" > "BookingTimestamp");
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payment_amount_positive') THEN
    ALTER TABLE "Payments"
      ADD CONSTRAINT "payment_amount_positive" CHECK ("Amount" >= 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'showtime_base_price_positive') THEN
    ALTER TABLE "Showtimes"
      ADD CONSTRAINT "showtime_base_price_positive" CHECK ("BasePrice" >= 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'seat_type_modifier_positive') THEN
    ALTER TABLE "SeatTypes"
      ADD CONSTRAINT "seat_type_modifier_positive" CHECK ("PriceModifier" > 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ticket_price_positive') THEN
    ALTER TABLE "Tickets"
      ADD CONSTRAINT "ticket_price_positive" CHECK ("FinalPrice" >= 0);
  END IF;
END $$;

-- Availability/pricing view from report section 6.7.
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
