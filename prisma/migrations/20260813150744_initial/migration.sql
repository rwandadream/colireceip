-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('admin', 'agent');

-- CreateEnum
CREATE TYPE "parcel_status" AS ENUM ('received', 'pending', 'in_transit', 'arrived', 'delivered', 'cancelled');

-- CreateEnum
CREATE TYPE "trip_status" AS ENUM ('planned', 'in_transit', 'arrived', 'closed', 'cancelled');

-- CreateEnum
CREATE TYPE "payment_method" AS ENUM ('cash', 'orange_money', 'wave', 'bank_transfer');

-- CreateEnum
CREATE TYPE "payment_condition" AS ENUM ('paid_origin', 'paid_destination', 'partial', 'unpaid');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "full_name" TEXT NOT NULL,
    "role" "user_role" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "company_name" TEXT,
    "email" TEXT,
    "city" TEXT NOT NULL,
    "neighborhood" TEXT,
    "address" TEXT NOT NULL,
    "reference" TEXT,
    "notes" TEXT NOT NULL DEFAULT '',
    "created_by" TEXT NOT NULL,
    "created_by_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "default_price" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parcels" (
    "id" TEXT NOT NULL,
    "tracking_number" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "client_name" TEXT NOT NULL,
    "client_phone" TEXT NOT NULL,
    "recipient_name" TEXT NOT NULL,
    "recipient_phone" TEXT NOT NULL,
    "recipient_address" TEXT NOT NULL,
    "merchandise_type" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "weight" DECIMAL(10,2) NOT NULL,
    "vehicle" TEXT NOT NULL,
    "origin" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "departure_branch" TEXT NOT NULL,
    "arrival_branch" TEXT NOT NULL,
    "package_type" TEXT NOT NULL,
    "payment_condition" "payment_condition" NOT NULL,
    "sub_total" DECIMAL(10,2) NOT NULL,
    "transport_price" DECIMAL(10,2) NOT NULL,
    "additional_fees" DECIMAL(10,2) NOT NULL,
    "total_amount" DECIMAL(10,2) NOT NULL,
    "amount_paid" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "balance" DECIMAL(10,2) NOT NULL,
    "registered_by" TEXT NOT NULL,
    "registered_by_name" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "agent_name" TEXT NOT NULL,
    "status" "parcel_status" NOT NULL DEFAULT 'received',
    "received_date" TIMESTAMP(3) NOT NULL,
    "departure_date" TIMESTAMP(3),
    "arrival_date" TIMESTAMP(3),
    "delivery_date" TIMESTAMP(3),
    "trip_id" TEXT,
    "trip_vehicle_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "parcels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parcel_items" (
    "id" TEXT NOT NULL,
    "parcel_id" TEXT NOT NULL,
    "product_id" TEXT,
    "designation" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit_price" DECIMAL(10,2) NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "parcel_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "parcel_id" TEXT NOT NULL,
    "parcel_tracking" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "client_name" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "payment_method" "payment_method" NOT NULL,
    "payment_date" DATE NOT NULL,
    "recorded_by" TEXT NOT NULL,
    "recorded_by_name" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trips" (
    "id" TEXT NOT NULL,
    "trip_number" TEXT NOT NULL,
    "trip_date" DATE NOT NULL,
    "origin" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "status" "trip_status" NOT NULL DEFAULT 'planned',
    "created_by" TEXT NOT NULL,
    "created_by_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trips_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trip_vehicles" (
    "id" TEXT NOT NULL,
    "trip_id" TEXT NOT NULL,
    "vehicle_number" INTEGER NOT NULL,
    "registration" TEXT NOT NULL,
    "road_bamako_frontier" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "customs_fee" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "frontier_formalities" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "road_frontier_bouake" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "road_bouake_abidjan" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "road_abidjan" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "loading_fee" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "unloading_fee" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "truck_quota" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "monthly_fee" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trip_vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expense_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expense_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trip_expenses" (
    "id" TEXT NOT NULL,
    "parcel_id" TEXT NOT NULL,
    "trip_id" TEXT,
    "trip_vehicle_id" TEXT,
    "category_id" TEXT,
    "category_name" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "expense_date" DATE NOT NULL,
    "location" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "created_by" TEXT NOT NULL,
    "created_by_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trip_expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "status_history" (
    "id" TEXT NOT NULL,
    "parcel_id" TEXT NOT NULL,
    "parcel_tracking" TEXT NOT NULL,
    "previous_status" "parcel_status",
    "new_status" "parcel_status" NOT NULL,
    "changed_by" TEXT NOT NULL,
    "changed_by_name" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "user_name" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "details" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachments" (
    "id" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "storage_path" TEXT,
    "url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_settings" (
    "id" TEXT NOT NULL DEFAULT '1',
    "company_name" TEXT NOT NULL,
    "company_phone" TEXT NOT NULL,
    "company_email" TEXT NOT NULL,
    "bamako_address" TEXT NOT NULL,
    "abidjan_address" TEXT NOT NULL,
    "default_transport_price" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'FCFA',
    "default_origin" TEXT,
    "default_destination" TEXT,
    "updated_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE INDEX "users_phone_idx" ON "users"("phone");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_active_idx" ON "users"("active");

-- CreateIndex
CREATE INDEX "clients_created_by_idx" ON "clients"("created_by");

-- CreateIndex
CREATE INDEX "clients_phone_idx" ON "clients"("phone");

-- CreateIndex
CREATE INDEX "clients_city_idx" ON "clients"("city");

-- CreateIndex
CREATE UNIQUE INDEX "products_name_key" ON "products"("name");

-- CreateIndex
CREATE INDEX "products_name_idx" ON "products"("name");

-- CreateIndex
CREATE UNIQUE INDEX "parcels_tracking_number_key" ON "parcels"("tracking_number");

-- CreateIndex
CREATE INDEX "parcels_tracking_number_idx" ON "parcels"("tracking_number");

-- CreateIndex
CREATE INDEX "parcels_client_id_idx" ON "parcels"("client_id");

-- CreateIndex
CREATE INDEX "parcels_registered_by_idx" ON "parcels"("registered_by");

-- CreateIndex
CREATE INDEX "parcels_agent_id_idx" ON "parcels"("agent_id");

-- CreateIndex
CREATE INDEX "parcels_status_idx" ON "parcels"("status");

-- CreateIndex
CREATE INDEX "parcels_trip_id_idx" ON "parcels"("trip_id");

-- CreateIndex
CREATE INDEX "parcels_trip_vehicle_id_idx" ON "parcels"("trip_vehicle_id");

-- CreateIndex
CREATE INDEX "parcels_received_date_idx" ON "parcels"("received_date");

-- CreateIndex
CREATE INDEX "parcel_items_parcel_id_idx" ON "parcel_items"("parcel_id");

-- CreateIndex
CREATE INDEX "payments_parcel_id_idx" ON "payments"("parcel_id");

-- CreateIndex
CREATE INDEX "payments_client_id_idx" ON "payments"("client_id");

-- CreateIndex
CREATE INDEX "payments_recorded_by_idx" ON "payments"("recorded_by");

-- CreateIndex
CREATE INDEX "payments_payment_date_idx" ON "payments"("payment_date");

-- CreateIndex
CREATE UNIQUE INDEX "trips_trip_number_key" ON "trips"("trip_number");

-- CreateIndex
CREATE INDEX "trips_created_by_idx" ON "trips"("created_by");

-- CreateIndex
CREATE INDEX "trips_trip_date_idx" ON "trips"("trip_date");

-- CreateIndex
CREATE INDEX "trips_status_idx" ON "trips"("status");

-- CreateIndex
CREATE INDEX "trip_vehicles_trip_id_idx" ON "trip_vehicles"("trip_id");

-- CreateIndex
CREATE INDEX "trip_vehicles_registration_idx" ON "trip_vehicles"("registration");

-- CreateIndex
CREATE UNIQUE INDEX "trip_vehicles_trip_id_vehicle_number_key" ON "trip_vehicles"("trip_id", "vehicle_number");

-- CreateIndex
CREATE UNIQUE INDEX "expense_categories_name_key" ON "expense_categories"("name");

-- CreateIndex
CREATE INDEX "expense_categories_name_idx" ON "expense_categories"("name");

-- CreateIndex
CREATE INDEX "trip_expenses_trip_id_idx" ON "trip_expenses"("trip_id");

-- CreateIndex
CREATE INDEX "trip_expenses_parcel_id_idx" ON "trip_expenses"("parcel_id");

-- CreateIndex
CREATE INDEX "trip_expenses_trip_vehicle_id_idx" ON "trip_expenses"("trip_vehicle_id");

-- CreateIndex
CREATE INDEX "trip_expenses_created_by_idx" ON "trip_expenses"("created_by");

-- CreateIndex
CREATE INDEX "trip_expenses_expense_date_idx" ON "trip_expenses"("expense_date");

-- CreateIndex
CREATE INDEX "status_history_parcel_id_idx" ON "status_history"("parcel_id");

-- CreateIndex
CREATE INDEX "status_history_created_at_idx" ON "status_history"("created_at");

-- CreateIndex
CREATE INDEX "activity_logs_user_id_idx" ON "activity_logs"("user_id");

-- CreateIndex
CREATE INDEX "activity_logs_entity_type_entity_id_idx" ON "activity_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "activity_logs_created_at_idx" ON "activity_logs"("created_at");

-- CreateIndex
CREATE INDEX "attachments_entity_type_entity_id_idx" ON "attachments"("entity_type", "entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "app_settings_updated_by_key" ON "app_settings"("updated_by");

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parcels" ADD CONSTRAINT "parcels_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parcels" ADD CONSTRAINT "parcels_registered_by_fkey" FOREIGN KEY ("registered_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parcels" ADD CONSTRAINT "parcels_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parcels" ADD CONSTRAINT "parcels_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parcels" ADD CONSTRAINT "parcels_trip_vehicle_id_fkey" FOREIGN KEY ("trip_vehicle_id") REFERENCES "trip_vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parcel_items" ADD CONSTRAINT "parcel_items_parcel_id_fkey" FOREIGN KEY ("parcel_id") REFERENCES "parcels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parcel_items" ADD CONSTRAINT "parcel_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_parcel_id_fkey" FOREIGN KEY ("parcel_id") REFERENCES "parcels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trips" ADD CONSTRAINT "trips_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_vehicles" ADD CONSTRAINT "trip_vehicles_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_expenses" ADD CONSTRAINT "trip_expenses_parcel_id_fkey" FOREIGN KEY ("parcel_id") REFERENCES "parcels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_expenses" ADD CONSTRAINT "trip_expenses_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_expenses" ADD CONSTRAINT "trip_expenses_trip_vehicle_id_fkey" FOREIGN KEY ("trip_vehicle_id") REFERENCES "trip_vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_expenses" ADD CONSTRAINT "trip_expenses_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "expense_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_expenses" ADD CONSTRAINT "trip_expenses_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "status_history" ADD CONSTRAINT "status_history_parcel_id_fkey" FOREIGN KEY ("parcel_id") REFERENCES "parcels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "status_history" ADD CONSTRAINT "status_history_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_settings" ADD CONSTRAINT "app_settings_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
