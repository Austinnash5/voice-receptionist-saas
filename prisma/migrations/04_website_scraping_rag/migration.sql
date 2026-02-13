-- Enable pgvector extension for vector similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- CreateEnum
CREATE TYPE "ScrapeStatus" AS ENUM ('PENDING', 'SCRAPING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "WebsiteSource" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "status" "ScrapeStatus" NOT NULL DEFAULT 'PENDING',
    "pagesFound" INTEGER NOT NULL DEFAULT 0,
    "pagesScraped" INTEGER NOT NULL DEFAULT 0,
    "lastScrapedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebsiteSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebsiteContent" (
    "id" TEXT NOT NULL,
    "websiteSourceId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT,
    "content" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL DEFAULT 0,
    "tokenCount" INTEGER NOT NULL DEFAULT 0,
    "embedding" vector(1536),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebsiteContent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WebsiteSource_tenantId_idx" ON "WebsiteSource"("tenantId");

-- CreateIndex
CREATE INDEX "WebsiteSource_domain_idx" ON "WebsiteSource"("domain");

-- CreateIndex
CREATE INDEX "WebsiteSource_status_idx" ON "WebsiteSource"("status");

-- CreateIndex
CREATE INDEX "WebsiteContent_websiteSourceId_idx" ON "WebsiteContent"("websiteSourceId");

-- CreateIndex
CREATE INDEX "WebsiteContent_tenantId_idx" ON "WebsiteContent"("tenantId");

-- CreateIndex
CREATE INDEX "WebsiteContent_url_idx" ON "WebsiteContent"("url");

-- CreateIndex for vector similarity search (using cosine distance)
CREATE INDEX "WebsiteContent_embedding_idx" ON "WebsiteContent" USING ivfflat ("embedding" vector_cosine_ops);

-- AddForeignKey
ALTER TABLE "WebsiteSource" ADD CONSTRAINT "WebsiteSource_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebsiteContent" ADD CONSTRAINT "WebsiteContent_websiteSourceId_fkey" FOREIGN KEY ("websiteSourceId") REFERENCES "WebsiteSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
