-- CreateTable
CREATE TABLE "Roles" (
    "RoleID" SERIAL NOT NULL,
    "RoleName" TEXT NOT NULL,
    "Description" TEXT,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Roles_pkey" PRIMARY KEY ("RoleID")
);

-- CreateTable
CREATE TABLE "BookingStatuses" (
    "StatusID" SERIAL NOT NULL,
    "StatusName" TEXT NOT NULL,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingStatuses_pkey" PRIMARY KEY ("StatusID")
);

-- CreateTable
CREATE TABLE "EventCategories" (
    "CategoryID" SERIAL NOT NULL,
    "CategoryName" TEXT NOT NULL,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventCategories_pkey" PRIMARY KEY ("CategoryID")
);

-- CreateTable
CREATE TABLE "SeatTypes" (
    "SeatTypeID" SERIAL NOT NULL,
    "TypeName" TEXT NOT NULL,
    "PriceModifier" DECIMAL(65,30) NOT NULL,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SeatTypes_pkey" PRIMARY KEY ("SeatTypeID")
);

-- CreateTable
CREATE TABLE "Users" (
    "UserID" SERIAL NOT NULL,
    "RoleID" INTEGER NOT NULL DEFAULT 3,
    "FullName" TEXT NOT NULL,
    "Email" TEXT NOT NULL,
    "Password" TEXT NOT NULL,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Users_pkey" PRIMARY KEY ("UserID")
);

-- CreateTable
CREATE TABLE "Venues" (
    "VenueID" SERIAL NOT NULL,
    "VenueName" TEXT NOT NULL,
    "Location" TEXT,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Venues_pkey" PRIMARY KEY ("VenueID")
);

-- CreateTable
CREATE TABLE "Events" (
    "EventID" SERIAL NOT NULL,
    "CategoryID" INTEGER NOT NULL,
    "CreatedByUserID" INTEGER,
    "Title" TEXT NOT NULL,
    "Description" TEXT,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Events_pkey" PRIMARY KEY ("EventID")
);

-- CreateTable
CREATE TABLE "Seats" (
    "SeatID" SERIAL NOT NULL,
    "VenueID" INTEGER NOT NULL,
    "SeatTypeID" INTEGER NOT NULL,
    "RowLabel" TEXT NOT NULL,
    "SeatNumber" TEXT NOT NULL,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Seats_pkey" PRIMARY KEY ("SeatID")
);

-- CreateTable
CREATE TABLE "Showtimes" (
    "ShowtimeID" SERIAL NOT NULL,
    "EventID" INTEGER NOT NULL,
    "VenueID" INTEGER NOT NULL,
    "StartDateTime" TIMESTAMP(3) NOT NULL,
    "BasePrice" DECIMAL(65,30) NOT NULL,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Showtimes_pkey" PRIMARY KEY ("ShowtimeID")
);

-- CreateTable
CREATE TABLE "Bookings" (
    "BookingID" SERIAL NOT NULL,
    "UserID" INTEGER NOT NULL,
    "StatusID" INTEGER NOT NULL DEFAULT 1,
    "BookingTimestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ExpiresAt" TIMESTAMP(3) NOT NULL,
    "TotalAmount" DECIMAL(65,30) NOT NULL,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bookings_pkey" PRIMARY KEY ("BookingID")
);

-- CreateTable
CREATE TABLE "PaymentMethods" (
    "MethodID" SERIAL NOT NULL,
    "MethodName" TEXT NOT NULL,
    "IsActive" BOOLEAN NOT NULL DEFAULT true,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentMethods_pkey" PRIMARY KEY ("MethodID")
);

-- CreateTable
CREATE TABLE "BookingDetails" (
    "DetailID" SERIAL NOT NULL,
    "BookingID" INTEGER NOT NULL,
    "ShowtimeID" INTEGER NOT NULL,
    "SeatID" INTEGER NOT NULL,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingDetails_pkey" PRIMARY KEY ("DetailID")
);

-- CreateTable
CREATE TABLE "PaymentStatuses" (
    "StatusID" SERIAL NOT NULL,
    "StatusName" TEXT NOT NULL,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentStatuses_pkey" PRIMARY KEY ("StatusID")
);

-- CreateTable
CREATE TABLE "Payments" (
    "PaymentID" SERIAL NOT NULL,
    "BookingID" INTEGER NOT NULL,
    "MethodID" INTEGER NOT NULL,
    "StatusID" INTEGER NOT NULL DEFAULT 1,
    "TransactionID" TEXT NOT NULL,
    "Amount" DECIMAL(65,30) NOT NULL,
    "PaidAt" TIMESTAMP(3),
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payments_pkey" PRIMARY KEY ("PaymentID")
);

-- CreateTable
CREATE TABLE "Tickets" (
    "TicketID" SERIAL NOT NULL,
    "TicketNo" VARCHAR(20) NOT NULL,
    "DetailID" INTEGER NOT NULL,
    "FinalPrice" DECIMAL(10,2) NOT NULL,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tickets_pkey" PRIMARY KEY ("TicketID")
);

-- CreateIndex
CREATE UNIQUE INDEX "Users_Email_key" ON "Users"("Email");

-- CreateIndex
CREATE UNIQUE INDEX "Seats_VenueID_RowLabel_SeatNumber_key" ON "Seats"("VenueID", "RowLabel", "SeatNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Payments_BookingID_key" ON "Payments"("BookingID");

-- CreateIndex
CREATE UNIQUE INDEX "Payments_TransactionID_key" ON "Payments"("TransactionID");

-- CreateIndex
CREATE UNIQUE INDEX "Tickets_TicketNo_key" ON "Tickets"("TicketNo");

-- CreateIndex
CREATE UNIQUE INDEX "Tickets_DetailID_key" ON "Tickets"("DetailID");

-- AddForeignKey
ALTER TABLE "Users" ADD CONSTRAINT "Users_RoleID_fkey" FOREIGN KEY ("RoleID") REFERENCES "Roles"("RoleID") ON DELETE SET DEFAULT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Events" ADD CONSTRAINT "Events_CategoryID_fkey" FOREIGN KEY ("CategoryID") REFERENCES "EventCategories"("CategoryID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Events" ADD CONSTRAINT "Events_CreatedByUserID_fkey" FOREIGN KEY ("CreatedByUserID") REFERENCES "Users"("UserID") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Seats" ADD CONSTRAINT "Seats_VenueID_fkey" FOREIGN KEY ("VenueID") REFERENCES "Venues"("VenueID") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Seats" ADD CONSTRAINT "Seats_SeatTypeID_fkey" FOREIGN KEY ("SeatTypeID") REFERENCES "SeatTypes"("SeatTypeID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Showtimes" ADD CONSTRAINT "Showtimes_EventID_fkey" FOREIGN KEY ("EventID") REFERENCES "Events"("EventID") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Showtimes" ADD CONSTRAINT "Showtimes_VenueID_fkey" FOREIGN KEY ("VenueID") REFERENCES "Venues"("VenueID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bookings" ADD CONSTRAINT "Bookings_UserID_fkey" FOREIGN KEY ("UserID") REFERENCES "Users"("UserID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bookings" ADD CONSTRAINT "Bookings_StatusID_fkey" FOREIGN KEY ("StatusID") REFERENCES "BookingStatuses"("StatusID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingDetails" ADD CONSTRAINT "BookingDetails_BookingID_fkey" FOREIGN KEY ("BookingID") REFERENCES "Bookings"("BookingID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingDetails" ADD CONSTRAINT "BookingDetails_ShowtimeID_fkey" FOREIGN KEY ("ShowtimeID") REFERENCES "Showtimes"("ShowtimeID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingDetails" ADD CONSTRAINT "BookingDetails_SeatID_fkey" FOREIGN KEY ("SeatID") REFERENCES "Seats"("SeatID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payments" ADD CONSTRAINT "Payments_BookingID_fkey" FOREIGN KEY ("BookingID") REFERENCES "Bookings"("BookingID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payments" ADD CONSTRAINT "Payments_MethodID_fkey" FOREIGN KEY ("MethodID") REFERENCES "PaymentMethods"("MethodID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payments" ADD CONSTRAINT "Payments_StatusID_fkey" FOREIGN KEY ("StatusID") REFERENCES "PaymentStatuses"("StatusID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tickets" ADD CONSTRAINT "Tickets_DetailID_fkey" FOREIGN KEY ("DetailID") REFERENCES "BookingDetails"("DetailID") ON DELETE RESTRICT ON UPDATE CASCADE;
