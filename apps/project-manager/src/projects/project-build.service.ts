import { ConflictException, Injectable, Logger, NotFoundException, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BuildStatus, RuntimeStatus } from '@prisma/client';
import { ChildProcess, spawn } from 'node:child_process';
import { createServer, createConnection } from 'node:net';
import { realpath, readFile, readdir } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { PrismaService } from '../../../../libs/database/src/prisma.service';

const select = { id: true, folderName: true, buildStatus: true, runtimeStatus: true, previewPort: true, previewUrl: true, runtimeProcessId: true, buildStdout: true, buildStderr: true, installStdout: true, installStderr: true, lastBuildError: true } as const;
type LocalProject = { id: string; folderName: string; runtimeProcessId: number | null; previewPort: number | null };

@Injectable()
export class ProjectBuildService implements OnModuleDestroy {
  private readonly logger = new Logger(ProjectBuildService.name);
  private readonly starting = new Set<string>();
  private readonly stopping = new Set<string>();
  private readonly children = new Map<string, ChildProcess>();
  private readonly ports = new Set<number>();
  private readonly outputLimit = 180_000;
  private readonly poller: NodeJS.Timeout;

  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService) {
    this.poller = setInterval(() => void this.detectCrashes(), 5000);
    this.poller.unref();
  }

  async build(userId: string, projectId: string) {
    const project = await this.owned(userId, projectId);
    if (this.starting.has(projectId)) throw new ConflictException('A preview operation is already running for this project');
    this.starting.add(projectId);
    try {
      await this.stopProcess(project);
      const workspace = await this.workspace(project);
      const pkg = JSON.parse(await readFile(resolve(workspace, 'package.json'), 'utf8')) as { scripts?: Record<string, string>; packageManager?: string };
      const files = await readdir(workspace);
      const manager = pkg.packageManager?.split('@')[0] ?? (files.includes('package-lock.json') ? 'npm' : files.includes('pnpm-lock.yaml') ? 'pnpm' : files.includes('yarn.lock') ? 'yarn' : 'npm');
      if (manager !== 'npm') throw new ConflictException('Only npm projects are supported for this test preview');
      if (!pkg.scripts?.dev) throw new ConflictException('This project has no package.json dev script');
      await this.prisma.project.update({ where: { id: projectId }, data: { buildStatus: BuildStatus.INSTALLING, runtimeStatus: RuntimeStatus.STOPPED, previewPort: null, previewUrl: null, runtimeProcessId: null, buildStartedAt: new Date(), buildCompletedAt: null, lastBuildError: null, installStdout: '', installStderr: '', installExitCode: null, buildStdout: '', buildStderr: '', buildExitCode: null } });
      const install = await this.runNpm(workspace, ['install', '--no-audit', '--no-fund'], 300000);
      await this.prisma.project.update({ where: { id: projectId }, data: { installStdout: install.stdout, installStderr: install.stderr, installExitCode: install.exitCode } });
      if (install.exitCode !== 0) {
        const message = `Dependency installation failed (exit ${install.exitCode}): ${install.stderr.slice(-4000)}`;
        await this.prisma.project.update({ where: { id: projectId }, data: { buildStatus: BuildStatus.FAILED, runtimeStatus: RuntimeStatus.FAILED, buildCompletedAt: new Date(), lastBuildError: message } });
        return { projectId, buildStatus: BuildStatus.FAILED, error: message };
      }
      await this.prisma.project.update({ where: { id: projectId }, data: { buildStatus: BuildStatus.BUILDING } });
      return await this.startOwned(userId, project, workspace, pkg.scripts.dev);
    } catch (error) {
      await this.prisma.project.update({ where: { id: projectId }, data: { buildStatus: BuildStatus.FAILED, runtimeStatus: RuntimeStatus.FAILED, buildCompletedAt: new Date(), lastBuildError: this.message(error) } }).catch(() => undefined);
      throw error;
    } finally { this.starting.delete(projectId); }
  }

  async start(userId: string, id: string) {
    const project = await this.owned(userId, id);
    if (project.buildStatus !== BuildStatus.SUCCESS) throw new ConflictException('Install project dependencies before starting its development preview');
    if (project.runtimeStatus === RuntimeStatus.RUNNING && this.children.has(id)) return this.runtime(userId, id);
    if (project.runtimeStatus === RuntimeStatus.RUNNING && !this.children.has(id)) await this.stopProcess(project);
    if (this.starting.has(id)) throw new ConflictException('A preview operation is already running for this project');
    this.starting.add(id);
    try {
      const workspace = await this.workspace(project);
      const pkg = JSON.parse(await readFile(resolve(workspace, 'package.json'), 'utf8')) as { scripts?: Record<string, string> };
      if (!pkg.scripts?.dev) throw new ConflictException('This project has no package.json dev script');
      return await this.startOwned(userId, project, workspace, pkg.scripts.dev);
    } finally { this.starting.delete(id); }
  }

  private async startOwned(userId: string, project: LocalProject, workspace: string, _devScript: string) {
    const id = project.id;
    if (this.children.has(id)) return this.runtime(userId, id);
    const port = await this.reservePort();
    const isVite = await this.isVite(workspace);
    const args = isVite
      ? ['run', 'dev', '--', '--host', '0.0.0.0', '--port', String(port), '--strictPort']
      : ['run', 'dev', '--', '--hostname', '0.0.0.0', '--port', String(port)];
    await this.prisma.project.update({ where: { id }, data: { runtimeStatus: RuntimeStatus.STARTING, previewPort: port, previewUrl: null } });
    const child = spawn('npm', args, { cwd: workspace, shell: false, stdio: ['ignore', 'pipe', 'pipe'], env: this.devEnvironment(workspace) });
    this.children.set(id, child);
    let logs = '';
    let flushed: NodeJS.Timeout | undefined;
    const append = (chunk: Buffer) => {
      logs = (logs + chunk.toString()).slice(-this.outputLimit);
      if (!flushed) flushed = setTimeout(() => {
        flushed = undefined;
        void this.prisma.project.update({ where: { id }, data: { runtimeLogs: logs } }).catch(() => undefined);
      }, 400);
    };
    child.stdout?.on('data', append);
    child.stderr?.on('data', append);
    child.on('error', (error) => { void this.crashed(id, error.message); });
    child.on('close', (code) => {
      this.children.delete(id);
      this.ports.delete(port);
      if (flushed) clearTimeout(flushed);
      if (!this.stopping.has(id)) void this.crashed(id, `Development server exited with code ${code ?? 'unknown'}`);
      this.stopping.delete(id);
    });
    try {
      await this.waitUntilListening(port, child, 45000);
      const base = (this.config.get<string>('PREVIEW_BASE_URL', 'http://localhost')).replace(/\/$/, '');
      const previewUrl = `${base}:${port}`;
      await this.prisma.project.update({ where: { id }, data: { buildStatus: BuildStatus.SUCCESS, buildCompletedAt: new Date(), runtimeStatus: RuntimeStatus.RUNNING, runtimeProcessId: child.pid ?? null, runtimeStartedAt: new Date(), previewUrl, runtimeLogs: logs } });
      this.logger.log(`Started dev preview for project ${id} at ${previewUrl}`);
      return { projectId: id, buildStatus: BuildStatus.SUCCESS, runtimeStatus: RuntimeStatus.RUNNING, previewPort: port, previewUrl };
    } catch (error) {
      this.stopping.add(id);
      child.kill('SIGTERM');
      setTimeout(() => child.kill('SIGKILL'), 2500).unref();
      this.ports.delete(port);
      await this.crashed(id, this.message(error));
      throw error;
    }
  }

  async stop(userId: string, id: string) {
    const project = await this.owned(userId, id);
    await this.stopProcess(project);
    return { projectId: id, runtimeStatus: RuntimeStatus.STOPPED };
  }
  async restart(userId: string, id: string) { const p = await this.owned(userId, id); await this.stopProcess(p); return this.start(userId, id); }
  async preview(userId: string, id: string) {
    const p = await this.owned(userId, id);
    return { projectId: id, buildStatus: p.buildStatus, runtimeStatus: p.runtimeStatus, previewPort: p.previewPort, previewUrl: p.previewUrl };
  }
  async runtime(userId: string, id: string) { return this.preview(userId, id); }
  async logs(userId: string, id: string) {
    const p = await this.owned(userId, id);
    return { buildStdout: p.buildStdout, buildStderr: p.buildStderr, installStdout: p.installStdout, installStderr: p.installStderr, runtimeStdout: p.runtimeLogs ?? '', runtimeStderr: '', lastBuildError: p.lastBuildError };
  }

  private async owned(userId: string, id: string) {
    const p = await this.prisma.project.findFirst({ where: { id, owner: { is: { userId } } }, select: { ...select, runtimeLogs: true } });
    if (!p) throw new NotFoundException('Project not found');
    return p;
  }
  private async workspace(project: { id: string; folderName: string }) {
    if (project.folderName !== `project-${project.id}`) throw new ConflictException('Invalid project workspace');
    const root = await realpath(resolve(this.config.get<string>('WORKSPACES_ROOT', resolve(process.cwd(), 'workspaces'))));
    const target = await realpath(resolve(root, project.folderName));
    if (!target.startsWith(root + sep)) throw new ConflictException('Project workspace is outside the workspace root');
    return target;
  }
  private async isVite(workspace: string) {
    const pkg = JSON.parse(await readFile(resolve(workspace, 'package.json'), 'utf8')) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
    return Boolean(pkg.dependencies?.vite || pkg.devDependencies?.vite);
  }
  private async reservePort() {
    const min = Number(this.config.get<string>('PREVIEW_PORT_START', '4100'));
    const max = Number(this.config.get<string>('PREVIEW_PORT_END', '4199'));
    for (let port = min; port <= max; port++) {
      if (this.ports.has(port)) continue;
      const occupied = await this.prisma.project.findFirst({ where: { previewPort: port }, select: { id: true } });
      if (occupied) continue;
      const server = createServer();
      const available = await new Promise<boolean>((resolvePromise) => {
        server.once('error', () => resolvePromise(false));
        server.listen(port, '0.0.0.0', () => server.close(() => resolvePromise(true)));
      });
      if (available) { this.ports.add(port); return port; }
    }
    throw new ConflictException('No preview ports are available');
  }
  private devEnvironment(workspace: string): NodeJS.ProcessEnv {
    const env: NodeJS.ProcessEnv = { PATH: process.env.PATH ?? '', NODE_ENV: 'development', npm_config_cache: resolve(workspace, '.npm-cache') };
    if (process.env.HOME) env.HOME = process.env.HOME;
    if (process.env.TMPDIR) env.TMPDIR = process.env.TMPDIR;
    return env;
  }
  private runNpm(workspace: string, args: string[], timeout: number) {
    return new Promise<{ stdout: string; stderr: string; exitCode: number }>((resolvePromise, reject) => {
      const child = spawn('npm', args, { cwd: workspace, shell: false, stdio: ['ignore', 'pipe', 'pipe'], env: this.devEnvironment(workspace) });
      let stdout = '', stderr = '';
      const timer = setTimeout(() => { child.kill('SIGTERM'); setTimeout(() => child.kill('SIGKILL'), 2500).unref(); reject(new Error('npm install timed out')); }, timeout);
      child.stdout?.on('data', (b: Buffer) => { stdout = (stdout + b.toString()).slice(-this.outputLimit); });
      child.stderr?.on('data', (b: Buffer) => { stderr = (stderr + b.toString()).slice(-this.outputLimit); });
      child.on('error', (e) => { clearTimeout(timer); reject(new Error(`npm could not start: ${e.message}`)); });
      child.on('close', (code) => { clearTimeout(timer); resolvePromise({ stdout, stderr, exitCode: code ?? 1 }); });
    });
  }
  private async waitUntilListening(port: number, child: ChildProcess, timeout: number) {
    const end = Date.now() + timeout;
    while (Date.now() < end) {
      if (child.exitCode !== null) throw new Error(`Development server exited with code ${child.exitCode}`);
      const connected = await new Promise<boolean>((resolvePromise) => {
        const client = createConnection({ host: '127.0.0.1', port });
        client.once('connect', () => { client.destroy(); resolvePromise(true); });
        client.once('error', () => { client.destroy(); resolvePromise(false); });
      });
      if (connected) return;
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
    }
    throw new Error('Development server did not listen before the startup timeout');
  }
  private async stopProcess(project: LocalProject) {
    const child = this.children.get(project.id);
    this.stopping.add(project.id);
    if (child && child.exitCode === null) {
      child.kill('SIGTERM');
      await Promise.race([new Promise<void>((resolvePromise) => child.once('close', () => resolvePromise())), new Promise<void>((resolvePromise) => setTimeout(resolvePromise, 2500))]);
      if (child.exitCode === null) child.kill('SIGKILL');
    }
    if (!child && project.runtimeProcessId) {
      try { process.kill(project.runtimeProcessId, 'SIGTERM'); } catch { /* stale pid */ }
    }
    this.stopping.delete(project.id);
    this.children.delete(project.id);
    if (project.previewPort) this.ports.delete(project.previewPort);
    await this.prisma.project.update({ where: { id: project.id }, data: { runtimeStatus: RuntimeStatus.STOPPED, runtimeProcessId: null, previewPort: null, previewUrl: null } });
  }
  private async crashed(id: string, message: string) {
    await this.prisma.project.update({ where: { id }, data: { runtimeStatus: RuntimeStatus.CRASHED, runtimeProcessId: null, previewPort: null, previewUrl: null, lastBuildError: message.slice(0, 4000) } }).catch(() => undefined);
    this.logger.warn(`Project ${id} preview stopped: ${message}`);
  }
  private async detectCrashes() {
    const running = await this.prisma.project.findMany({ where: { runtimeStatus: RuntimeStatus.RUNNING, runtimeProcessId: { not: null } }, select: { id: true, runtimeProcessId: true, previewPort: true } }).catch(() => []);
    for (const p of running) {
      if (this.children.has(p.id)) continue;
      try { process.kill(p.runtimeProcessId!, 0); } catch {
        if (p.previewPort) this.ports.delete(p.previewPort);
        await this.crashed(p.id, 'Development server process is no longer running');
      }
    }
  }
  private message(error: unknown) { return error instanceof Error ? error.message.slice(0, 4000) : 'Unknown preview error'; }
  async onModuleDestroy() {
    clearInterval(this.poller);
    const running = await this.prisma.project.findMany({ where: { runtimeProcessId: { not: null } }, select: { id: true, folderName: true, runtimeProcessId: true, previewPort: true } }).catch(() => []);
    await Promise.all(running.map((project) => this.stopProcess(project).catch(() => undefined)));
  }
}
