-- CHECK Constraints for Ticket Booking System
-- Prisma doesn't support CHECK constraints natively, so these are applied via raw SQL

-- Ensure booking total amount is non-negative
ALTER TABLE "Bookings"
  ADD CONSTRAINT booking_total_positive CHECK ("TotalAmount" >= 0);

-- Ensure booking expires after it was created
ALTER TABLE "Bookings"
  ADD CONSTRAINT booking_expires_after_created CHECK ("ExpiresAt" > "BookingTimestamp");

-- Ensure payment amount is non-negative
ALTER TABLE "Payments"
  ADD CONSTRAINT payment_amount_positive CHECK ("Amount" >= 0);

-- Ensure showtime base price is non-negative
ALTER TABLE "Showtimes"
  ADD CONSTRAINT showtime_base_price_positive CHECK ("BasePrice" >= 0);

-- Ensure seat type price modifier is positive
ALTER TABLE "SeatTypes"
  ADD CONSTRAINT seat_type_modifier_positive CHECK ("PriceModifier" > 0);

-- Ensure ticket final price is non-negative
ALTER TABLE "Tickets"
  ADD CONSTRAINT ticket_price_positive CHECK ("FinalPrice" >= 0);
