-- Strict requirement cleanup for schema/data that exceeded Requirement.txt.

ALTER TABLE "Events" DROP CONSTRAINT IF EXISTS "Events_CreatedByUserID_fkey";
ALTER TABLE "Events" DROP COLUMN IF EXISTS "CreatedByUserID";

DELETE FROM "PaymentStatuses" ps
WHERE ps."StatusName" = 'Refunded'
  AND NOT EXISTS (
    SELECT 1
    FROM "Payments" p
    WHERE p."StatusID" = ps."StatusID"
  );
