CREATE INDEX IF NOT EXISTS idx_bookings_user_timestamp
ON "Bookings" ("UserID", "BookingTimestamp" DESC);

CREATE INDEX IF NOT EXISTS idx_bookings_timestamp
ON "Bookings" ("BookingTimestamp" DESC);

CREATE INDEX IF NOT EXISTS idx_bookings_status_expires
ON "Bookings" ("StatusID", "ExpiresAt");

CREATE INDEX IF NOT EXISTS idx_bookingdetails_showtime_seat
ON "BookingDetails" ("ShowtimeID", "SeatID");

CREATE INDEX IF NOT EXISTS idx_bookingdetails_booking
ON "BookingDetails" ("BookingID");

CREATE INDEX IF NOT EXISTS idx_showtimes_event_start
ON "Showtimes" ("EventID", "StartDateTime");

CREATE INDEX IF NOT EXISTS idx_showtimes_venue
ON "Showtimes" ("VenueID");

CREATE INDEX IF NOT EXISTS idx_seats_venue_type
ON "Seats" ("VenueID", "SeatTypeID");

CREATE INDEX IF NOT EXISTS idx_payments_status_created
ON "Payments" ("StatusID", "CreatedAt" DESC);

CREATE INDEX IF NOT EXISTS idx_payments_created
ON "Payments" ("CreatedAt" DESC);

CREATE INDEX IF NOT EXISTS idx_payments_method_created
ON "Payments" ("MethodID", "CreatedAt" DESC);

CREATE INDEX IF NOT EXISTS idx_payments_booking
ON "Payments" ("BookingID");
