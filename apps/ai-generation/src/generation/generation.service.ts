import { Injectable, Logger, NotFoundException, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GenerationJobStatus, Prisma } from '@prisma/client';
import { ChildProcess, spawn } from 'node:child_process';
import { resolve, sep } from 'node:path';
import { EventBusService } from '../../../../libs/messaging/src/rabbitmq-event-bus.service';
import { EventTypes } from '../../../../libs/common/src/contracts/event.contract';
import { createEvent } from '../../../../libs/common/src/contracts/create-event';
import { PrismaService } from '../../../../libs/database/src/prisma.service';

type RequestPayload = { generationId: string; projectId: string; userId: string; prompt: string; folderName: string };
const selection = { id: true, projectId: true, userId: true, status: true, stdout: true, stderr: true, exitCode: true, startedAt: true, completedAt: true, createdAt: true, updatedAt: true } as const;

@Injectable()
export class GenerationService implements OnModuleDestroy {
  private readonly logger = new Logger(GenerationService.name);
  private readonly activeProjects = new Set<string>();
  private readonly children = new Set<ChildProcess>();
  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService, private readonly events: EventBusService) {}

  async receive(payload: RequestPayload): Promise<void> {
    if (!payload || !this.valid(payload)) return;
    try {
      await this.prisma.generationJob.create({ data: { id: payload.generationId, projectId: payload.projectId, userId: payload.userId, prompt: payload.prompt, status: GenerationJobStatus.QUEUED } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return;
      throw error;
    }
    if (this.activeProjects.has(payload.projectId)) {
      await this.finish(payload, null, 'Another generation is already running for this project', 1);
      return;
    }
    this.activeProjects.add(payload.projectId);
    void this.execute(payload).finally(() => this.activeProjects.delete(payload.projectId));
  }

  async list(userId: string, projectId?: string, skip = 0, take = 20) {
    return this.prisma.generationJob.findMany({ where: { userId, ...(projectId ? { projectId } : {}) }, select: selection, orderBy: { createdAt: 'desc' }, skip, take });
  }

  async get(userId: string, id: string) {
    const job = await this.prisma.generationJob.findFirst({ where: { id, userId }, select: selection });
    if (!job) throw new NotFoundException('Generation job not found');
    return job;
  }

  async onModuleDestroy() {
    for (const child of this.children) child.kill('SIGTERM');
  }

  private valid(value: RequestPayload): boolean {
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuid.test(value.generationId) && uuid.test(value.projectId) && uuid.test(value.userId) &&
      typeof value.prompt === 'string' && value.prompt.trim().length > 0 && value.prompt.length <= 4000 &&
      typeof value.folderName === 'string' && value.folderName === `project-${value.projectId}`;
  }

  private async execute(payload: RequestPayload) {
    const root = resolve(this.config.get<string>('WORKSPACES_ROOT', resolve(process.cwd(), 'workspaces')));
    const workspace = resolve(root, payload.folderName);
    if (!workspace.startsWith(root + sep)) return this.finish(payload, null, 'Invalid workspace path', 1);
    const startedAt = new Date();
    await this.prisma.generationJob.update({ where: { id: payload.generationId }, data: { status: GenerationJobStatus.RUNNING, startedAt } });
    await this.events.publish(createEvent(EventTypes.generationStarted, { generationId: payload.generationId, projectId: payload.projectId, userId: payload.userId, status: 'RUNNING', startedAt: startedAt.toISOString() }));
    this.logger.log(`Starting generation ${payload.generationId}`);
    const timeoutMs = this.config.get<number>('GAPCODE_TIMEOUT_MS', 600000);
    const maxOutput = this.config.get<number>('GAPCODE_MAX_OUTPUT_CHARS', 200000);
    let stdout = '', stderr = '', exitCode: number | null = null, failure: string | null = null;
    await new Promise<void>((resolvePromise) => {
      const child = spawn(this.config.get<string>('GAPCODE_BIN', 'gapcode'), ['-C', workspace, '-s', 'workspace-write', '-a', 'never', 'exec', '--skip-git-repo-check', payload.prompt], { cwd: workspace, shell: false, stdio: ['ignore', 'pipe', 'pipe'] });
      this.children.add(child);
      const timer = setTimeout(() => { failure = 'GapCode process timed out'; child.kill('SIGTERM'); setTimeout(() => child.kill('SIGKILL'), 5000).unref(); }, timeoutMs);
      child.stdout.on('data', (chunk: Buffer) => { stdout = (stdout + chunk.toString()).slice(-maxOutput); });
      child.stderr.on('data', (chunk: Buffer) => { stderr = (stderr + chunk.toString()).slice(-maxOutput); });
      child.on('error', (error) => { failure = error.message; });
      child.on('close', (code) => { exitCode = code; clearTimeout(timer); this.children.delete(child); resolvePromise(); });
    });
    await this.finish(payload, stdout, stderr || failure, exitCode, startedAt);
  }

  private async finish(payload: RequestPayload, stdout: string | null, stderr: string | null, exitCode: number | null, startedAt = new Date()) {
    const completedAt = new Date();
    const succeeded = exitCode === 0 && !stderr?.includes('GapCode process timed out');
    const status = succeeded ? GenerationJobStatus.COMPLETED : GenerationJobStatus.FAILED;
    await this.prisma.generationJob.update({ where: { id: payload.generationId }, data: { status, stdout, stderr, exitCode, startedAt, completedAt } });
    await this.events.publish(createEvent(succeeded ? EventTypes.generationCompleted : EventTypes.generationFailed, { generationId: payload.generationId, projectId: payload.projectId, userId: payload.userId, status, exitCode, startedAt: startedAt.toISOString(), completedAt: completedAt.toISOString() }));
    this.logger.log(`Generation ${payload.generationId} finished with ${status}`);
  }
}
