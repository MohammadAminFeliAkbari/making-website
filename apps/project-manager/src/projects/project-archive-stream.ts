import { ZipArchive } from 'archiver';
import { constants } from 'node:fs';
import { createReadStream } from 'node:fs';
import type { Response } from 'express';
import type { PreparedProjectArchive } from './project-download.service';

const STREAM_TIMEOUT_MS = 15 * 60 * 1000;

export function streamProjectArchive(project: PreparedProjectArchive, response: Response): Promise<void> {
  return new Promise((resolvePromise) => {
    const archive = new ZipArchive({ forceZip64: true, zlib: { level: 6 } });
    let completed = false;
    let disconnected = false;
    const timeout = setTimeout(() => fail(), STREAM_TIMEOUT_MS);
    timeout.unref();

    const complete = () => {
      if (completed) return;
      completed = true;
      clearTimeout(timeout);
      response.removeListener('close', onClose);
      response.removeListener('finish', complete);
      response.removeListener('error', fail);
      resolvePromise();
    };

    const fail = () => {
      if (completed) return;
      archive.abort();
      archive.destroy();
      if (disconnected || response.destroyed) {
        complete();
        return;
      }
      if (response.headersSent) {
        response.destroy();
      } else {
        response.removeHeader('Content-Disposition');
        response.type('application/json');
        response.status(500).json({ message: 'Unable to create the project download.' });
      }
      complete();
    };

    const onClose = () => {
      if (response.writableEnded) return;
      disconnected = true;
      archive.abort();
      archive.destroy();
      complete();
    };

    response.once('close', onClose);
    response.once('finish', complete);
    response.once('error', fail);
    archive.once('error', fail);
    archive.once('warning', fail);

    response.setHeader('Content-Type', 'application/zip');
    response.setHeader('Content-Disposition', contentDisposition(project.projectName));
    response.setHeader('Cache-Control', 'no-store');
    archive.pipe(response);

    for (const entry of project.entries) {
      if (entry.kind === 'directory') {
        archive.append('', { name: `${entry.archivePath}/` });
        continue;
      }
      const file = createReadStream(entry.sourcePath!, {
        flags: (constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0)) as unknown as string,
      });
      file.once('error', (error) => archive.destroy(error));
      archive.append(file, { name: entry.archivePath });
    }

    Promise.resolve(archive.finalize()).catch(fail);
  });
}

function contentDisposition(projectName: string) {
  const baseName = projectName
    .normalize('NFKD')
    .replace(/[^\x20-\x7e]/g, '_')
    .replace(/["\\/<>:|?*\u0000-\u001f]/g, '_')
    .replace(/^\.+|\.+$/g, '')
    .trim()
    .slice(0, 120) || 'project';
  const utf8Name = encodeURIComponent(`${projectName}.zip`).replace(/['()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
  return `attachment; filename="${baseName}.zip"; filename*=UTF-8''${utf8Name}`;
}
