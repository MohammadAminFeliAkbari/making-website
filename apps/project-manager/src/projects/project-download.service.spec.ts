import { InternalServerErrorException, NotFoundException, PayloadTooLargeException, RequestMethod, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdtemp, mkdir, readFile, rm, symlink, truncate, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { PassThrough } from 'node:stream';
import type { Response } from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../../../../libs/database/src/prisma.service';
import { JwtAuthGuard } from '../../../../libs/auth/src/jwt-auth.guard';
import { ProjectDownloadService } from './project-download.service';
import { streamProjectArchive } from './project-archive-stream';
import { ProjectsController } from './projects.controller';
import { GUARDS_METADATA, METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import type { ExecutionContext } from '@nestjs/common';
import type { JwtService } from '@nestjs/jwt';
import { JwtModule, JwtService as RealJwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { Response as SupertestResponse } from 'superagent';
import { ProjectBuildService } from './project-build.service';
import { ProjectsService } from './projects.service';

const execFileAsync = promisify(execFile);
const projectId = '123e4567-e89b-42d3-a456-426614174000';
const userId = '123e4567-e89b-42d3-a456-426614174001';

class TestResponse extends PassThrough {
  headersSent = false;
  statusCode = 200;
  headers = new Map<string, string>();
  jsonBody: unknown;

  setHeader(name: string, value: string) { this.headers.set(name.toLowerCase(), value); return this; }
  removeHeader(name: string) { this.headers.delete(name.toLowerCase()); }
  type(value: string) { this.setHeader('content-type', value); return this; }
  status(value: number) { this.statusCode = value; return this; }
  json(value: unknown) { this.jsonBody = value; this.end(JSON.stringify(value)); return this; }
}

describe('ProjectDownloadService', () => {
  let root: string;
  let workspace: string;
  let service: ProjectDownloadService;
  let findFirst: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'project-download-test-'));
    workspace = join(root, `project-${projectId}`);
    await mkdir(join(workspace, 'src'), { recursive: true });
    await mkdir(join(workspace, 'public'), { recursive: true });
    await mkdir(join(workspace, 'node_modules', 'private-package'), { recursive: true });
    await mkdir(join(workspace, 'dist'), { recursive: true });
    await mkdir(join(workspace, '.git'), { recursive: true });
    await writeFile(join(workspace, 'package.json'), '{"scripts":{"dev":"vite"}}');
    await writeFile(join(workspace, 'package-lock.json'), '{}');
    await writeFile(join(workspace, 'index.html'), '<div id="root"></div>');
    await writeFile(join(workspace, 'src', 'App.tsx'), 'export default function App() { return <main />; }');
    await writeFile(join(workspace, 'public', 'logo.svg'), '<svg/>');
    await writeFile(join(workspace, 'src', 'token.ts'), 'export const tokenName = "access-token";');
    await writeFile(join(workspace, '.git', 'config'), '[remote "origin"]');
    await writeFile(join(workspace, 'node_modules', 'private-package', 'index.js'), 'should not ship');
    await writeFile(join(workspace, 'dist', 'bundle.js'), 'generated output');
    await writeFile(join(workspace, '.env'), 'TOKEN=secret');
    await writeFile(join(workspace, '.env.local'), 'PASSWORD=secret');
    await writeFile(join(workspace, '.env.production'), 'API_KEY=secret');
    await writeFile(join(workspace, '.env.example'), 'API_KEY=replace-me');
    await writeFile(join(workspace, '.npmrc'), '//registry.npmjs.org/:_authToken=secret');
    await writeFile(join(workspace, 'credentials.json'), '{"private":"secret"}');
    await writeFile(join(workspace, 'private.pem'), 'private key');
    await writeFile(join(workspace, 'debug.log'), 'runtime log');
    await symlink('/etc/passwd', join(workspace, 'outside-link'));

    findFirst = vi.fn().mockResolvedValue({ id: projectId, name: 'Demo Website', folderName: `project-${projectId}` });
    const prisma = { project: { findFirst } } as unknown as PrismaService;
    const config = { get: vi.fn((key: string, fallback: string) => key === 'WORKSPACES_ROOT' ? root : fallback) } as unknown as ConfigService;
    service = new ProjectDownloadService(prisma, config);
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('prepares source files and excludes dependencies, output, secrets, logs, and symlinks', async () => {
    const prepared = await service.prepare(userId, projectId);
    const paths = prepared.entries.map((entry) => entry.archivePath);
    expect(paths).toContain('package.json');
    expect(paths).toContain('package-lock.json');
    expect(paths).toContain('index.html');
    expect(paths).toContain('src/App.tsx');
    expect(paths).toContain('src/token.ts');
    expect(paths).toContain('public/logo.svg');
    expect(paths.some((path) => path.startsWith('node_modules/'))).toBe(false);
    expect(paths.some((path) => path.startsWith('dist/'))).toBe(false);
    expect(paths.some((path) => path.startsWith('.git/'))).toBe(false);
    expect(paths.some((path) => path.startsWith('.env'))).toBe(false);
    expect(paths).not.toContain('.npmrc');
    expect(paths).not.toContain('credentials.json');
    expect(paths).not.toContain('private.pem');
    expect(paths).not.toContain('debug.log');
    expect(paths).not.toContain('outside-link');
  });

  it('uses an owner-scoped project query and hides projects owned by someone else', async () => {
    findFirst.mockResolvedValueOnce(null);
    await expect(service.prepare('another-user', projectId)).rejects.toBeInstanceOf(NotFoundException);
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: projectId, owner: { is: { userId: 'another-user' } } },
    }));
  });

  it('returns not found when the project does not exist', async () => {
    findFirst.mockResolvedValueOnce(null);
    await expect(service.prepare(userId, projectId)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects a database folder name that is not the project canonical folder', async () => {
    findFirst.mockResolvedValueOnce({ id: projectId, name: 'Demo', folderName: '../outside' });
    await expect(service.prepare(userId, projectId)).rejects.toBeInstanceOf(InternalServerErrorException);
  });

  it('rejects a workspace symlink that resolves outside WORKSPACES_ROOT', async () => {
    const outside = await mkdtemp(join(tmpdir(), 'project-download-outside-'));
    try {
      await rm(workspace, { recursive: true, force: true });
      await symlink(outside, workspace);
      await expect(service.prepare(userId, projectId)).rejects.toBeInstanceOf(InternalServerErrorException);
    } finally {
      await rm(outside, { recursive: true, force: true });
    }
  });

  it('returns not found when the project workspace directory is missing', async () => {
    await rm(workspace, { recursive: true, force: true });
    await expect(service.prepare(userId, projectId)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('streams a ZIP with files at the archive root that extracts to a runnable project', async () => {
    const prepared = await service.prepare(userId, projectId);
    const response = new TestResponse();
    const chunks: Buffer[] = [];
    response.on('data', (chunk: Buffer) => { response.headersSent = true; chunks.push(chunk); });

    await streamProjectArchive(prepared, response as unknown as Response);
    expect(response.headers.get('content-type')).toBe('application/zip');
    expect(response.headers.get('content-disposition')).toContain('filename="Demo Website.zip"');

    const archivePath = join(root, 'download.zip');
    const extractPath = join(root, 'extracted');
    await writeFile(archivePath, Buffer.concat(chunks));
    await mkdir(extractPath);
    const listing = await execFileAsync('unzip', ['-Z1', archivePath]);
    expect(listing.stdout.split('\n')).toContain('package.json');
    expect(listing.stdout.split('\n')).toContain('src/App.tsx');
    expect(listing.stdout.split('\n').some((path) => path.includes('project-' + projectId))).toBe(false);
    await execFileAsync('unzip', ['-q', archivePath, '-d', extractPath]);
    expect(await readFile(join(extractPath, 'src', 'App.tsx'), 'utf8')).toContain('function App');
    expect(JSON.parse(await readFile(join(extractPath, 'package.json'), 'utf8')).scripts.dev).toBe('vite');
  });

  it('handles an archive read error without exposing the filesystem path', async () => {
    const response = new TestResponse();
    const chunks: Buffer[] = [];
    response.on('data', (chunk: Buffer) => { response.headersSent = true; chunks.push(chunk); });
    await streamProjectArchive({
      projectName: 'Broken project',
      entries: [{ sourcePath: resolve(root, 'missing-source-file'), archivePath: 'src/app.ts', kind: 'file', size: 10 }],
    }, response as unknown as Response);
    expect(response.statusCode === 500 || response.destroyed).toBe(true);
    expect(Buffer.concat(chunks).toString()).not.toContain(root);
  });

  it('stops archive generation when the client disconnects', async () => {
    const prepared = await service.prepare(userId, projectId);
    const response = new TestResponse();
    response.once('data', () => response.destroy());
    await expect(streamProjectArchive(prepared, response as unknown as Response)).resolves.toBeUndefined();
    expect(response.destroyed).toBe(true);
  });

  it('rejects projects with no files and enforces archive size limits', async () => {
    const emptyRoot = await mkdtemp(join(tmpdir(), 'project-download-empty-'));
    const emptyWorkspace = join(emptyRoot, `project-${projectId}`);
    await mkdir(emptyWorkspace);
    try {
      const config = { get: vi.fn((key: string, fallback: string) => key === 'WORKSPACES_ROOT' ? emptyRoot : fallback) } as unknown as ConfigService;
      const emptyService = new ProjectDownloadService({ project: { findFirst } } as unknown as PrismaService, config);
      await expect(emptyService.prepare(userId, projectId)).rejects.toBeInstanceOf(NotFoundException);
    } finally {
      await rm(emptyRoot, { recursive: true, force: true });
    }
    const largeFile = join(workspace, 'oversized-source.bin');
    await writeFile(largeFile, 'x');
    await truncate(largeFile, 1_000_000_001);
    await expect(service.prepare(userId, projectId)).rejects.toBeInstanceOf(PayloadTooLargeException);
  });
});

describe('project download endpoint access', () => {
  it('is a GET route protected by the existing JWT guard', async () => {
    const handler = ProjectsController.prototype.download;
    expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe(':projectId/download');
    expect(Reflect.getMetadata(METHOD_METADATA, handler)).toBe(RequestMethod.GET);
    expect(Reflect.getMetadata(GUARDS_METADATA, ProjectsController)).toContain(JwtAuthGuard);

    const guard = new JwtAuthGuard({ verifyAsync: vi.fn() } as unknown as JwtService);
    const context = { switchToHttp: () => ({ getRequest: () => ({ headers: {} }) }) } as unknown as ExecutionContext;
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('downloads and extracts the ZIP over the authenticated HTTP endpoint', async () => {
    const root = await mkdtemp(join(tmpdir(), 'project-download-http-'));
    const workspace = join(root, `project-${projectId}`);
    await mkdir(join(workspace, 'src'), { recursive: true });
    await writeFile(join(workspace, 'package.json'), '{"name":"downloaded-project","version":"1.0.0","scripts":{"dev":"node server.js"}}');
    await writeFile(join(workspace, 'src', 'main.ts'), 'export const ready = true;');
    await writeFile(join(workspace, 'server.js'), "const http=require('node:http');const server=http.createServer((_req,res)=>res.end('Project is running'));server.listen(Number(process.env.PORT||0),'127.0.0.1',()=>console.log('server-ready:'+server.address().port));");

    const projectFindFirst = vi.fn(async ({ where }: { where: { owner: { is: { userId: string } } } }) =>
      where.owner.is.userId === userId ? { id: projectId, name: 'HTTP Project', folderName: `project-${projectId}` } : null,
    );
    const appModule = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: 'project-download-test-secret' })],
      controllers: [ProjectsController],
      providers: [
        { provide: ProjectsService, useValue: {} },
        { provide: ProjectBuildService, useValue: {} },
        { provide: PrismaService, useValue: { project: { findFirst: projectFindFirst } } },
        { provide: ConfigService, useValue: { get: (_key: string, fallback: string) => root || fallback } },
        ProjectDownloadService,
        JwtAuthGuard,
      ],
    }).compile();
    const app = appModule.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();

    try {
      const jwt = appModule.get<RealJwtService>(RealJwtService);
      const ownerToken = jwt.sign({ sub: userId, email: 'owner@example.com' });
      const otherToken = jwt.sign({ sub: '123e4567-e89b-42d3-a456-426614174002', email: 'other@example.com' });
      const unauthenticated = await request(app.getHttpServer()).get(`/api/projects/${projectId}/download`);
      expect(unauthenticated.status).toBe(401);

      const unauthorizedOwner = await request(app.getHttpServer())
        .get(`/api/projects/${projectId}/download`)
        .set('Authorization', `Bearer ${otherToken}`);
      expect(unauthorizedOwner.status).toBe(404);

      const downloaded = await request(app.getHttpServer())
        .get(`/api/projects/${projectId}/download`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .buffer(true)
        .parse((response: SupertestResponse, callback: (error: Error | null, body?: Buffer) => void) => {
          const chunks: Buffer[] = [];
          response.on('data', (chunk: Buffer) => chunks.push(chunk));
          response.on('end', () => callback(null, Buffer.concat(chunks)));
        });
      expect(downloaded.status).toBe(200);
      expect(downloaded.headers['content-type']).toContain('application/zip');
      expect(downloaded.headers['content-disposition']).toContain('HTTP Project.zip');

      const archivePath = join(root, 'http-download.zip');
      const extracted = join(root, 'http-extracted');
      await writeFile(archivePath, downloaded.body as Buffer);
      await mkdir(extracted);
      await execFileAsync('unzip', ['-q', archivePath, '-d', extracted]);
      expect(await readFile(join(extracted, 'src', 'main.ts'), 'utf8')).toContain('ready = true');
      await execFileAsync('npm', ['install', '--ignore-scripts', '--offline', '--package-lock=false'], { cwd: extracted });
      const devServer = spawn('npm', ['run', 'dev'], { cwd: extracted, env: { ...process.env, PORT: '0' }, stdio: ['ignore', 'pipe', 'pipe'] });
      try {
        const port = await new Promise<string>((resolvePort, reject) => {
          let output = '';
          const timer = setTimeout(() => reject(new Error('Extracted project server did not start')), 10_000);
          devServer.stdout?.on('data', (chunk: Buffer) => {
            output += chunk.toString();
            const match = output.match(/server-ready:(\d+)/);
            if (match) { clearTimeout(timer); resolvePort(match[1]); }
          });
          devServer.once('error', (error) => { clearTimeout(timer); reject(error); });
          devServer.once('exit', (code) => {
            if (code !== null && code !== 0) { clearTimeout(timer); reject(new Error(`Extracted project exited with code ${code}`)); }
          });
        });
        const page = await fetch(`http://127.0.0.1:${port}`);
        expect(await page.text()).toBe('Project is running');
      } finally {
        devServer.kill('SIGTERM');
      }
    } finally {
      await app.close();
      await rm(root, { recursive: true, force: true });
    }
  });
});
