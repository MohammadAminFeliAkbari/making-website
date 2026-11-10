import { Injectable, InternalServerErrorException, NotFoundException, PayloadTooLargeException, RequestTimeoutException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { lstat, readdir, realpath } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep, posix } from 'node:path';
import { PrismaService } from '../../../../libs/database/src/prisma.service';

export type ProjectArchiveEntry = {
  sourcePath?: string;
  archivePath: string;
  kind: 'file' | 'directory';
  size: number;
};

export type PreparedProjectArchive = {
  projectName: string;
  entries: ProjectArchiveEntry[];
};

const MAX_ARCHIVE_FILES = 50_000;
const MAX_ARCHIVE_BYTES = 1_000_000_000;
const PREPARATION_TIMEOUT_MS = 120_000;
const IGNORED_DIRECTORIES = new Set([
  '.git', '.hg', '.svn', 'node_modules', 'dist', 'build', 'out', '.next',
  '.nuxt', '.svelte-kit', '.angular', '.vercel', '.output', 'coverage',
  '.cache', '.turbo', '.parcel-cache', 'playwright-report', 'test-results',
  'tmp', 'temp', '.aws', '.ssh',
]);
const SECRET_FILE_NAME = /(?:^|[._-])(?:secret|secrets|credential|credentials|service-account|firebase-adminsdk|id_rsa|id_ed25519|id_ecdsa|id_dsa|private-key)(?:[._-]|$)/i;
const PRIVATE_KEY_EXTENSION = /\.(?:pem|key|p8|der|p12|pfx|p7b|p7c|jks|keystore)$/i;
const TEMPORARY_FILE = /(?:\.tmp|\.temp|\.swp|\.swo|~)$/i;

@Injectable()
export class ProjectDownloadService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async prepare(userId: string, projectId: string): Promise<PreparedProjectArchive> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, owner: { is: { userId } } },
      select: { id: true, name: true, folderName: true },
    });
    if (!project) throw new NotFoundException('Project not found');
    if (project.folderName !== `project-${project.id}`) {
      throw new InternalServerErrorException('Project workspace is unavailable');
    }

    const configuredRoot = resolve(this.config.get<string>('WORKSPACES_ROOT', resolve(process.cwd(), 'workspaces')));
    let workspaceRoot: string;
    let workspace: string;
    try {
      workspaceRoot = await realpath(configuredRoot);
      workspace = await realpath(resolve(workspaceRoot, project.folderName));
    } catch {
      throw new NotFoundException('Project workspace not found');
    }
    if (!isWithin(workspaceRoot, workspace) || workspace === workspaceRoot) {
      throw new InternalServerErrorException('Project workspace is unavailable');
    }
    const rootStat = await lstat(workspace).catch(() => null);
    if (!rootStat?.isDirectory() || rootStat.isSymbolicLink()) {
      throw new NotFoundException('Project workspace not found');
    }

    const deadline = Date.now() + PREPARATION_TIMEOUT_MS;
    const entries: ProjectArchiveEntry[] = [];
    let fileCount = 0;
    let totalBytes = 0;

    const visit = async (directory: string, relativeDirectory: string, depth: number): Promise<void> => {
      if (Date.now() > deadline) throw new RequestTimeoutException('Project archive preparation timed out');
      if (depth > 100) throw new PayloadTooLargeException('Project directory structure is too deep');
      const children = await readdir(directory, { withFileTypes: true });
      children.sort((a, b) => a.name.localeCompare(b.name));
      for (const child of children) {
        if (Date.now() > deadline) throw new RequestTimeoutException('Project archive preparation timed out');
        if (!isSafePathComponent(child.name) || isExcludedName(child.name)) continue;
        const sourcePath = resolve(directory, child.name);
        const archivePath = posix.join(relativeDirectory, child.name);
        const metadata = await lstat(sourcePath).catch(() => null);
        if (!metadata || metadata.isSymbolicLink()) continue;

        if (metadata.isDirectory()) {
          const canonicalPath = await realpath(sourcePath).catch(() => null);
          if (!canonicalPath || !isWithin(workspace, canonicalPath)) continue;
          entries.push({ archivePath, kind: 'directory', size: 0 });
          enforceFileLimit(++fileCount);
          await visit(canonicalPath, archivePath, depth + 1);
          continue;
        }
        if (!metadata.isFile()) continue;

        const canonicalPath = await realpath(sourcePath).catch(() => null);
        if (!canonicalPath || !isWithin(workspace, canonicalPath)) continue;
        totalBytes += metadata.size;
        enforceFileLimit(++fileCount);
        if (totalBytes > MAX_ARCHIVE_BYTES) {
          throw new PayloadTooLargeException('Project source exceeds the download size limit');
        }
        entries.push({ sourcePath: canonicalPath, archivePath, kind: 'file', size: metadata.size });
      }
    };

    await visit(workspace, '', 0);
    if (!entries.some((entry) => entry.kind === 'file')) {
      throw new NotFoundException('Project contains no source files to download');
    }
    return { projectName: project.name, entries };
  }
}

function enforceFileLimit(count: number) {
  if (count > MAX_ARCHIVE_FILES) throw new PayloadTooLargeException('Project contains too many files to download');
}

function isSafePathComponent(name: string) {
  return name !== '.' && name !== '..' && !name.includes('/') && !name.includes('\\') && !name.includes(':') && !name.includes('\0');
}

function isExcludedName(name: string) {
  const lower = name.toLowerCase();
  if (IGNORED_DIRECTORIES.has(lower)) return true;
  if (lower === '.npmrc' || lower === '.pypirc' || lower === '.netrc' || lower === '.dockercfg' || lower === '.dockerconfigjson') return true;
  if (lower === '.env' || lower.startsWith('.env.')) return true;
  if (SECRET_FILE_NAME.test(name) || PRIVATE_KEY_EXTENSION.test(name) || TEMPORARY_FILE.test(name)) return true;
  if (lower.endsWith('.log') || lower === '.ds_store' || lower === 'thumbs.db') return true;
  return false;
}

function isWithin(parent: string, candidate: string) {
  const path = relative(parent, candidate);
  return path !== '' && path !== '..' && !path.startsWith(`..${sep}`) && !isAbsolute(path);
}
