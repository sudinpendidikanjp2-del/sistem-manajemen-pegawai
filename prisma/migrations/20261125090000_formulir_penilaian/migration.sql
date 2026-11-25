-- AlterTable
ALTER TABLE "assessment_assignments" ADD COLUMN     "form_snapshot" JSONB;

-- CreateTable
CREATE TABLE "assessment_forms" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "pass_score" INTEGER NOT NULL DEFAULT 75,
    "groups" JSONB NOT NULL,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "assessment_forms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment_form_units" (
    "id" UUID NOT NULL,
    "form_id" UUID NOT NULL,
    "unit_id" UUID NOT NULL,
    "include_subunits" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "assessment_form_units_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "assessment_form_units_unit_id_key" ON "assessment_form_units"("unit_id");

-- CreateIndex
CREATE INDEX "assessment_form_units_form_id_idx" ON "assessment_form_units"("form_id");

-- AddForeignKey
ALTER TABLE "assessment_form_units" ADD CONSTRAINT "assessment_form_units_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "assessment_forms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_form_units" ADD CONSTRAINT "assessment_form_units_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "organization_units"("id") ON DELETE CASCADE ON UPDATE CASCADE;

