import { Injectable, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ProjectStatus } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { cp, mkdir, rm } from 'node:fs/promises';
import { basename, isAbsolute, resolve, sep } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { PrismaService } from '../../../../libs/database/src/prisma.service';
import { createEvent } from '../../../../libs/common/src/contracts/create-event';
import { EventTypes } from '../../../../libs/common/src/contracts/event.contract';
import { EventBusService } from '../../../../libs/messaging/src/rabbitmq-event-bus.service';

const execFileAsync = promisify(execFile);
const safeProjectSelect = { id: true, name: true, folderName: true, status: true, createdAt: true, updatedAt: true } as const;

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly events: EventBusService,
  ) {}

  async create(userId: string, name: string) {
    const id = randomUUID();
    const folderName = `project-${id}`;
    const root = resolve(this.config.get<string>('WORKSPACES_ROOT', resolve(process.cwd(), 'workspaces')));
    const template = resolve(this.config.get<string>('STARTER_TEMPLATE_PATH', resolve(process.cwd(), 'templates/sample-fronted')));
    const destination = resolve(root, folderName);
    if (!isAbsolute(root) || !isAbsolute(template) || !destination.startsWith(root + sep)) {
      throw new InternalServerErrorException('Workspace configuration is invalid');
    }

    let projectCreated = false;
    try {
      await mkdir(root, { recursive: true });
      await this.prisma.project.create({ data: { id, name: name.trim(), folderName, status: ProjectStatus.CREATING } });
      projectCreated = true;
      await cp(template, destination, {
        recursive: true,
        filter: (source) => !['node_modules', 'dist', '.git'].includes(basename(source)),
      });
      await this.prisma.$transaction([
        this.prisma.projectUser.create({ data: { projectId: id, userId } }),
        this.prisma.project.update({ where: { id }, data: { status: ProjectStatus.READY } }),
      ]);
      try { await execFileAsync('git', ['init'], { cwd: destination }); } catch { /* git is optional */ }
      const project = await this.prisma.project.findUniqueOrThrow({ where: { id }, select: safeProjectSelect });
      await this.events.publish(createEvent(EventTypes.projectCreated, { ...project, userId }));
      return project;
    } catch (error) {
      await rm(destination, { recursive: true, force: true }).catch(() => undefined);
      if (projectCreated) await this.prisma.project.update({ where: { id }, data: { status: ProjectStatus.FAILED } }).catch(() => undefined);
      throw error;
    }
  }

  list(userId: string) {
    return this.prisma.project.findMany({
      where: { owner: { is: { userId } } }, select: safeProjectSelect, orderBy: { createdAt: 'desc' },
    });
  }

  async get(userId: string, id: string) {
    const project = await this.prisma.project.findFirst({ where: { id, owner: { is: { userId } } }, select: safeProjectSelect });
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }

  async delete(userId: string, id: string) {
    const project = await this.prisma.project.findFirst({ where: { id, owner: { is: { userId } } }, select: safeProjectSelect });
    if (!project) throw new NotFoundException('Project not found');
    const root = resolve(this.config.get<string>('WORKSPACES_ROOT', resolve(process.cwd(), 'workspaces')));
    const folder = resolve(root, project.folderName);
    if (!folder.startsWith(root + sep)) throw new InternalServerErrorException('Invalid project folder');
    await rm(folder, { recursive: true, force: true });
    await this.prisma.project.delete({ where: { id } });
    await this.events.publish(createEvent(EventTypes.projectDeleted, { projectId: id, userId }));
    return { id, deleted: true };
  }

  async generate(userId: string, id: string, prompt: string) {
    const project = await this.prisma.project.findFirst({ where: { id, owner: { is: { userId } } }, select: safeProjectSelect });
    if (!project) throw new NotFoundException('Project not found');
    const generationId = randomUUID();
    await this.events.publish(createEvent(EventTypes.generationRequested, {
      generationId, projectId: id, userId, prompt: prompt.trim(), folderName: project.folderName,
    }));
    await this.prisma.project.update({ where: { id }, data: { status: ProjectStatus.GENERATING } });
    return { generationId, status: 'QUEUED' };
  }

  async handleGenerationEvent(eventType: string, payload: { projectId?: string }) {
    if (!payload.projectId) return;
    await this.prisma.project.updateMany({
      where: { id: payload.projectId },
      data: { status: eventType === EventTypes.generationCompleted ? ProjectStatus.READY : ProjectStatus.FAILED },
    });
  }
}
