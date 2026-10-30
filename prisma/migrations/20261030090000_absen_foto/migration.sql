
-- AlterTable
ALTER TABLE "attendance_verifications" ADD COLUMN     "runner_up_distance" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "employees" ADD COLUMN     "photo_attendance" BOOLEAN NOT NULL DEFAULT false;

