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

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_events_event_desc
ON "Events" ("EventID" DESC);

CREATE INDEX IF NOT EXISTS idx_events_category_event_desc
ON "Events" ("CategoryID", "EventID" DESC);

CREATE INDEX IF NOT EXISTS idx_events_title_trgm
ON "Events" USING gin ("Title" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_showtimes_event_start_covering
ON "Showtimes" ("EventID", "StartDateTime", "ShowtimeID")
INCLUDE ("VenueID", "BasePrice");

CREATE INDEX IF NOT EXISTS idx_showtimes_venue_start_id
ON "Showtimes" ("VenueID", "StartDateTime", "ShowtimeID");

CREATE INDEX IF NOT EXISTS idx_bookingdetails_showtime_booking_seat
ON "BookingDetails" ("ShowtimeID", "BookingID", "SeatID");

CREATE INDEX IF NOT EXISTS idx_bookingdetails_booking_showtime_seat
ON "BookingDetails" ("BookingID", "ShowtimeID", "SeatID");

CREATE INDEX IF NOT EXISTS idx_bookingdetails_seat
ON "BookingDetails" ("SeatID");

CREATE INDEX IF NOT EXISTS idx_seats_venue_row_number
ON "Seats" ("VenueID", "RowLabel", "SeatNumber", "SeatID");

CREATE INDEX IF NOT EXISTS idx_users_role_created
ON "Users" ("RoleID", "CreatedAt" DESC, "UserID");

CREATE INDEX IF NOT EXISTS idx_users_fullname_trgm
ON "Users" USING gin ("FullName" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_users_email_trgm
ON "Users" USING gin ("Email" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_bookings_user_timestamp_booking
ON "Bookings" ("UserID", "BookingTimestamp" DESC, "BookingID" DESC);

CREATE INDEX IF NOT EXISTS idx_bookings_status_expires_booking
ON "Bookings" ("StatusID", "ExpiresAt", "BookingID");

CREATE INDEX IF NOT EXISTS idx_payments_status_paidat_payment
ON "Payments" ("StatusID", "PaidAt" DESC, "PaymentID" DESC);

CREATE INDEX IF NOT EXISTS idx_payments_paidat_payment
ON "Payments" ("PaidAt" DESC, "PaymentID" DESC);

CREATE INDEX IF NOT EXISTS idx_payments_transaction_trgm
ON "Payments" USING gin ("TransactionID" gin_trgm_ops);
