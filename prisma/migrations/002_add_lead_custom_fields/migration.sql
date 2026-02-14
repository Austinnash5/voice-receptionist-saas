-- Create LeadField table for storing custom lead field responses
CREATE TABLE "LeadField" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadField_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LeadField_leadId_idx" ON "LeadField"("leadId");

-- AddForeignKey
ALTER TABLE "LeadField" ADD CONSTRAINT "LeadField_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
