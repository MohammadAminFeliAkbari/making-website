CREATE TYPE "BuildStatus" AS ENUM ('PENDING', 'INSTALLING', 'BUILDING', 'SUCCESS', 'FAILED');
CREATE TYPE "RuntimeStatus" AS ENUM ('STOPPED', 'STARTING', 'RUNNING', 'CRASHED', 'FAILED');

ALTER TABLE "Project"
  ADD COLUMN "buildStatus" "BuildStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "runtimeStatus" "RuntimeStatus" NOT NULL DEFAULT 'STOPPED',
  ADD COLUMN "previewPort" INTEGER,
  ADD COLUMN "previewUrl" TEXT,
  ADD COLUMN "buildStartedAt" TIMESTAMP(3),
  ADD COLUMN "buildCompletedAt" TIMESTAMP(3),
  ADD COLUMN "lastBuildError" TEXT,
  ADD COLUMN "installStdout" TEXT,
  ADD COLUMN "installStderr" TEXT,
  ADD COLUMN "installExitCode" INTEGER,
  ADD COLUMN "buildStdout" TEXT,
  ADD COLUMN "buildStderr" TEXT,
  ADD COLUMN "buildExitCode" INTEGER,
  ADD COLUMN "runtimeContainerId" TEXT,
  ADD COLUMN "runtimeLogs" TEXT,
  ADD COLUMN "runtimeStartedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "Project_previewPort_key" ON "Project"("previewPort");
