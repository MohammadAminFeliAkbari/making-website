'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity, ArrowLeft, ArrowUpRight, Check, ChevronDown, Code2, Download, ExternalLink,
  Globe2, LoaderCircle, Maximize2, MessageSquare, Monitor, RefreshCw,
  Send, Smartphone, Sparkles, Tablet, TerminalSquare, WandSparkles,
} from 'lucide-react';
import Link from 'next/link';
import type { Generation, Project } from '@/lib/api';

type ProjectLogs = {
  buildStdout: string | null;
  buildStderr: string | null;
  installStdout: string | null;
  installStderr: string | null;
  runtimeStdout: string;
  runtimeStderr: string;
  lastBuildError: string | null;
};

type LocalRequest = { generationId: string; prompt: string; createdAt: string };
type Viewport = 'desktop' | 'tablet' | 'mobile';

export function ProjectWorkspace({
  project, jobs, logs, busy, downloadBusy, onGenerate, onAction, onRefresh, onDownload,
}: {
  project: Project;
  jobs: Generation[];
  logs: ProjectLogs | null;
  busy: boolean;
  downloadBusy: boolean;
  onGenerate: (prompt: string) => Promise<string>;
  onAction: (action: 'build' | 'start' | 'stop' | 'restart') => Promise<void>;
  onRefresh: () => void;
  onDownload: () => void;
}) {
  const [prompt, setPrompt] = useState('');
  const [localRequests, setLocalRequests] = useState<LocalRequest[]>([]);
  const [requesting, setRequesting] = useState(false);
  const [pendingPrompt, setPendingPrompt] = useState('');
  const [requestError, setRequestError] = useState('');
  const [viewport, setViewport] = useState<Viewport>('desktop');
  const [mobileTab, setMobileTab] = useState<'chat' | 'preview'>('chat');
  const [leftPercent, setLeftPercent] = useState(35);
  const [isResizing, setIsResizing] = useState(false);
  const [refreshId, setRefreshId] = useState(0);
  const [previewLoadFailed, setPreviewLoadFailed] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const conversationRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  const orderedJobs = useMemo(() => [...jobs].sort((a, b) => a.createdAt.localeCompare(b.createdAt)), [jobs]);
  const activeGeneration = jobs.some((job) => job.status === 'QUEUED' || job.status === 'RUNNING');
  const buildInProgress = project.buildStatus === 'INSTALLING' || project.buildStatus === 'BUILDING';
  const canSubmit = Boolean(prompt.trim()) && !busy && !requesting && !activeGeneration;

  useEffect(() => {
    conversationRef.current?.scrollTo({ top: conversationRef.current.scrollHeight, behavior: 'smooth' });
  }, [jobs, localRequests, project.buildStatus]);

  useEffect(() => {
    if (!isResizing) return;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    return () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = prompt.trim();
    if (!text || !canSubmit) return;
    setPrompt('');
    setRequesting(true);
    setPendingPrompt(text);
    setRequestError('');
    try {
      const generationId = await onGenerate(text);
      setLocalRequests((items) => [...items, { generationId, prompt: text, createdAt: new Date().toISOString() }]);
    } catch (error) {
      setPrompt(text);
      setRequestError((error as Error).message || 'Your request could not be submitted.');
    } finally {
      setRequesting(false);
      setPendingPrompt('');
      composerRef.current?.focus();
    }
  }

  async function action(name: 'build' | 'start' | 'stop' | 'restart') {
    setActionBusy(true);
    try { await onAction(name); } finally { setActionBusy(false); }
  }

  function onResizeStart(event: React.PointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsResizing(true);
  }

  function onResizeMove(event: React.PointerEvent<HTMLButtonElement>) {
    if (!isResizing) return;
    const bounds = event.currentTarget.parentElement?.getBoundingClientRect();
    if (!bounds || bounds.width === 0) return;
    const percent = ((event.clientX - bounds.left) / bounds.width) * 100;
    setLeftPercent(Math.min(55, Math.max(28, percent)));
  }

  function onResizeEnd(event: React.PointerEvent<HTMLButtonElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setIsResizing(false);
  }

  const hasPreview = Boolean(project.previewUrl && project.runtimeStatus === 'RUNNING');
  const previewState = previewLoadFailed && hasPreview ? 'Preview loading failed' : getPreviewState(project);
  const previewTitle = previewState === 'running' ? 'Website is running' : previewState;
  const iframeSrc = project.previewUrl && hasPreview
    ? `${project.previewUrl}${project.previewUrl.includes('?') ? '&' : '?'}workspaceRefresh=${refreshId}`
    : undefined;

  return (
    <main className="workspace-shell" style={{ '--chat-width': `${leftPercent}%` } as React.CSSProperties}>
      <header className="workspace-header">
        <Link href="/" className="workspace-back" aria-label="All projects"><ArrowLeft size={17}/></Link>
        <div className="workspace-project-icon"><Globe2 size={18}/></div>
        <div className="workspace-project-name"><strong>{project.name}</strong><span>Website workspace</span></div>
        <div className="workspace-project-status"><span>Project <Status status={project.status}/></span><span>Generation <Status status={generationStatus(jobs)}/></span><span>Build <Status status={project.buildStatus}/></span><span>Runtime <Status status={project.runtimeStatus}/></span></div>
        <div className="workspace-header-actions">
          <button className="secondary compact workspace-download-button" disabled={downloadBusy} onClick={onDownload} title="دانلود فایل‌های سورس پروژه به‌صورت ZIP" aria-label="دانلود پروژه">
            {downloadBusy ? <LoaderCircle className="spin" size={15}/> : <Download size={15}/>}
            <span>دانلود پروژه</span>
          </button>
          <button className="secondary compact workspace-build-button" disabled={actionBusy || busy || buildInProgress} onClick={() => void action('build')} title="Install dependencies and run preview" aria-label="Build"><Code2 size={15}/> Build</button>
          {project.runtimeStatus === 'RUNNING'
            ? <button className="secondary compact" title="Stop preview" aria-label="Stop preview" disabled={actionBusy} onClick={() => void action('stop')}>Stop</button>
            : <button className="secondary compact" title="Start preview" aria-label="Start preview" disabled={actionBusy || project.buildStatus !== 'SUCCESS'} onClick={() => void action('start')}>Start</button>}
          <button className="icon-button" onClick={onRefresh} title="Refresh project status"><RefreshCw size={16}/></button>
        </div>
      </header>

      <nav className="workspace-mobile-tabs" aria-label="Workspace panels">
        <button className={mobileTab === 'chat' ? 'selected' : ''} onClick={() => setMobileTab('chat')}><MessageSquare size={16}/> Chat</button>
        <button className={mobileTab === 'preview' ? 'selected' : ''} onClick={() => setMobileTab('preview')}><Globe2 size={16}/> Preview</button>
      </nav>

      <div className="workspace-panels">
        <section className={`workspace-chat ${mobileTab === 'preview' ? 'mobile-hidden' : ''}`} aria-label="AI conversation">
          <div className="chat-heading">
            <span className="chat-assistant-mark"><Sparkles size={17}/></span>
            <div><strong>AI Website Builder</strong><small>Working in {project.name}</small></div>
            <Status status={generationStatus(jobs)}/>
          </div>

          <div className="chat-history" ref={conversationRef}>
            <div className="chat-welcome">
              <span className="chat-welcome-icon"><WandSparkles size={19}/></span>
              <h2>What would you like to change?</h2>
              <p>Describe a change to this project. Your requests update its existing workspace.</p>
              {jobs.length === 0 && <div className="prompt-suggestions">
                {['Add a testimonials section to the homepage', 'Make the navigation responsive', 'Improve the mobile layout'].map((suggestion) => <button key={suggestion} onClick={() => { setPrompt(suggestion); composerRef.current?.focus(); }}>{suggestion}</button>)}
              </div>}
            </div>

            {orderedJobs.map((job) => {
              const request = localRequests.find((item) => item.generationId === job.id);
              const requestPrompt = request?.prompt ?? job.prompt;
              return <article className="conversation-turn" key={job.id}>
                {requestPrompt && <div className="chat-message user-message"><span className="message-role">You</span><p>{requestPrompt}</p><time>{formatTime(request?.createdAt ?? job.createdAt)}</time></div>}
                <div className={`chat-message assistant-message ${job.status === 'FAILED' ? 'message-failed' : ''}`}>
                  <span className="message-role"><Sparkles size={13}/> Forma</span>
                  <p>{generationMessage(job, project)}</p>
                  <div className="message-progress"><Status status={job.status}/>{job.status === 'QUEUED' || job.status === 'RUNNING' ? <LoaderCircle className="spin" size={14}/> : job.status === 'COMPLETED' ? <Check size={14}/> : null}</div>
                  {job.stderr && <details className="inline-output"><summary>Generation details</summary><pre>{safeLog(job.stderr)}</pre></details>}
                  {job.stdout && <details className="inline-output"><summary>Generation output</summary><pre>{safeLog(job.stdout)}</pre></details>}
                  <time>{job.completedAt ? formatTime(job.completedAt) : formatTime(job.createdAt)}</time>
                </div>
              </article>;
            })}

            {pendingPrompt && <div className="conversation-turn"><div className="chat-message user-message"><span className="message-role">You</span><p>{pendingPrompt}</p><time>Just now</time></div><div className="chat-message assistant-message"><span className="message-role"><Sparkles size={13}/> Forma</span><p>Sending your request to the generation service…</p><div className="message-progress"><LoaderCircle className="spin" size={14}/></div></div></div>}

            {(activeGeneration || buildInProgress) && <div className="chat-message assistant-message workspace-progress-card"><span className="message-role"><Activity size={13}/> Project progress</span>
              <ProgressStep label="Generate changes" state={activeGeneration ? 'active' : jobs.some((job) => job.status === 'COMPLETED') ? 'done' : 'waiting'}/>
              <ProgressStep label={project.buildStatus === 'INSTALLING' ? 'Installing dependencies' : 'Build'} state={project.buildStatus === 'INSTALLING' || project.buildStatus === 'BUILDING' ? 'active' : project.buildStatus === 'SUCCESS' ? 'done' : project.buildStatus === 'FAILED' ? 'failed' : 'waiting'}/>
              <ProgressStep label="Start preview" state={project.runtimeStatus === 'STARTING' ? 'active' : project.runtimeStatus === 'RUNNING' ? 'done' : project.runtimeStatus === 'CRASHED' || project.runtimeStatus === 'FAILED' ? 'failed' : 'waiting'}/>
            </div>}

            {project.buildStatus === 'FAILED' && <div className="chat-message assistant-message message-failed"><span className="message-role"><Activity size={13}/> Build failed</span><p>The generated changes are saved, but the preview could not be updated. Review build logs or run Build again.</p></div>}
          </div>

          <form className="workspace-composer" onSubmit={submit}>
            {requestError && <div className="workspace-inline-error" role="alert">{requestError}</div>}
            <label className="sr-only" htmlFor="workspace-prompt">Request a website change</label>
            <textarea ref={composerRef} id="workspace-prompt" value={prompt} maxLength={4000} rows={3} onChange={(event) => setPrompt(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); if (canSubmit) event.currentTarget.form?.requestSubmit(); } }} placeholder="Ask for a change to your website…" disabled={busy || requesting || activeGeneration}/>
            <div className="composer-hints"><span>Enter to send · Shift + Enter for a new line</span><button className="primary workspace-send" disabled={!canSubmit}>{requesting ? <LoaderCircle className="spin" size={16}/> : <Send size={15}/>}<span>Send</span></button></div>
          </form>
        </section>

        <button className={`workspace-resizer ${isResizing ? 'is-resizing' : ''}`} onPointerDown={onResizeStart} onPointerMove={onResizeMove} onPointerUp={onResizeEnd} onPointerCancel={onResizeEnd} onKeyDown={(event) => { if (event.key === 'ArrowLeft') setLeftPercent((value) => Math.max(28, value - 2)); if (event.key === 'ArrowRight') setLeftPercent((value) => Math.min(55, value + 2)); }} aria-label="Resize chat and preview panels" role="separator" aria-orientation="vertical" aria-valuemin={28} aria-valuemax={55} aria-valuenow={leftPercent} tabIndex={0}/>

        <section className={`workspace-preview-panel ${mobileTab === 'chat' ? 'mobile-hidden' : ''}`} aria-label="Live website preview">
          <div className="preview-workspace-toolbar">
            <div className="preview-title"><Globe2 size={16}/><strong>Preview</strong><span className={`preview-live-dot ${hasPreview ? 'is-live' : ''}`}/><span className="preview-state-label">{previewTitle}</span></div>
            <div className="preview-url" title={project.previewUrl ?? 'No preview URL yet'}>{project.previewUrl ?? 'Preview URL will appear here'}</div>
            <div className="preview-toolbar-actions">
              <div className="viewport-switch" aria-label="Preview viewport">
                <button className={viewport === 'desktop' ? 'active' : ''} aria-label="Desktop viewport" title="Desktop" onClick={() => setViewport('desktop')}><Monitor size={15}/></button>
                <button className={viewport === 'tablet' ? 'active' : ''} aria-label="Tablet viewport" title="Tablet" onClick={() => setViewport('tablet')}><Tablet size={15}/></button>
                <button className={viewport === 'mobile' ? 'active' : ''} aria-label="Mobile viewport" title="Mobile" onClick={() => setViewport('mobile')}><Smartphone size={15}/></button>
              </div>
              <button className="icon-button" disabled={!hasPreview} onClick={() => setRefreshId((value) => value + 1)} title="Refresh preview"><RefreshCw size={15}/></button>
              {hasPreview && <a className="icon-button" href={project.previewUrl!} target="_blank" rel="noopener noreferrer" title="Open preview in a new tab"><ExternalLink size={15}/></a>}
              <button className="icon-button" disabled={!hasPreview} onClick={() => void previewRef.current?.requestFullscreen?.()} title="Fullscreen"><Maximize2 size={15}/></button>
            </div>
          </div>
          <div className="preview-canvas" ref={previewRef}>
            {hasPreview && iframeSrc ? <div className={`preview-device preview-device-${viewport}`}>
              <iframe key={iframeSrc} src={iframeSrc} title={`${project.name} live website`} className="workspace-iframe" sandbox="allow-scripts allow-forms allow-same-origin allow-popups" referrerPolicy="strict-origin-when-cross-origin" onLoad={() => setPreviewLoadFailed(false)} onError={() => setPreviewLoadFailed(true)} />
              {previewLoadFailed && <div className="preview-load-error"><Globe2 size={22}/><strong>Preview could not be loaded</strong><span>Check that the preview server is reachable, then refresh it.</span><button className="secondary compact" onClick={() => { setPreviewLoadFailed(false); setRefreshId((value) => value + 1); }}><RefreshCw size={13}/> Try again</button></div>}
            </div> : <PreviewEmpty project={project} state={previewState} busy={actionBusy} onBuild={() => void action('build')}/>}
          </div>
          <div className="preview-bottom-bar">
            <span><span className={`preview-live-dot ${hasPreview ? 'is-live' : ''}`}/>{project.previewUrl ?? 'No active preview URL'}</span>
            <div className="preview-runtime-actions">
              {project.runtimeStatus === 'RUNNING' ? <button className="secondary compact" disabled={actionBusy} onClick={() => void action('restart')}><RefreshCw size={13}/> Restart</button> : <button className="secondary compact" disabled={actionBusy || project.buildStatus === 'INSTALLING' || project.buildStatus === 'BUILDING'} onClick={() => void action('build')}><Code2 size={13}/> Build &amp; run</button>}
            </div>
          </div>
          {logs && <details className="workspace-build-logs"><summary><TerminalSquare size={14}/> Build and runtime logs <ChevronDown size={14}/></summary><pre>{safeLog([logs.lastBuildError, logs.installStdout, logs.installStderr, logs.buildStdout, logs.buildStderr, logs.runtimeStdout, logs.runtimeStderr].filter(Boolean).join('\n')) || 'No logs are available yet.'}</pre></details>}
        </section>
      </div>
    </main>
  );
}

function PreviewEmpty({ project, state, busy, onBuild }: { project: Project; state: string; busy: boolean; onBuild: () => void }) {
  let heading = 'Your preview will appear here';
  let detail = 'Send a request in chat to create or update this website. Once generation and the build finish, the live site will load here.';
  if (project.status === 'CREATING') { heading = 'Setting up your project'; detail = 'The project workspace is being prepared. You can send your first request in chat.'; }
  else if (state === 'Installing dependencies') { heading = 'Installing dependencies'; detail = 'The project manager is installing this website’s dependencies.'; }
  else if (state === 'Building') { heading = 'Building your website'; detail = 'The preview will refresh after the build and server start succeed.'; }
  else if (state === 'Starting preview') { heading = 'Starting preview server'; detail = 'Waiting for the real project preview URL from the project manager.'; }
  else if (state === 'Build failed') { heading = 'Build needs attention'; detail = safeLog(project.lastBuildError || 'The build failed. Review logs below, then try Build & run again.'); }
  else if (state === 'Runtime crashed' || state === 'Runtime failed') { heading = 'Preview stopped unexpectedly'; detail = safeLog(project.lastBuildError || 'The preview server stopped. Review the logs or restart the preview.'); }
  else if (state === 'Preview loading failed') { heading = 'Preview could not be loaded'; }
  return <div className="workspace-preview-empty"><span className="preview-empty-icon"><Globe2 size={25}/></span><h2>{heading}</h2><p>{detail}</p>{project.buildStatus !== 'INSTALLING' && project.buildStatus !== 'BUILDING' && project.runtimeStatus !== 'STARTING' && <button className="secondary" disabled={busy} onClick={onBuild}><Code2 size={15}/>{project.buildStatus === 'SUCCESS' ? 'Restart preview' : 'Build & run preview'}</button>}</div>;
}

function ProgressStep({ label, state }: { label: string; state: 'waiting' | 'active' | 'done' | 'failed' }) {
  return <div className={`progress-step progress-${state}`}><span>{state === 'active' ? <LoaderCircle className="spin" size={13}/> : state === 'done' ? <Check size={13}/> : state === 'failed' ? '!' : <i/>}</span>{label}</div>;
}

function Status({ status }: { status: string }) {
  return <span className={`status status-${status.toLowerCase()}`}><i/>{statusLabel(status)}</span>;
}

function generationStatus(jobs: Generation[]) {
  if (jobs.some((job) => job.status === 'RUNNING')) return 'RUNNING';
  if (jobs.some((job) => job.status === 'QUEUED')) return 'QUEUED';
  return jobs[0]?.status ?? 'IDLE';
}

function generationMessage(job: Generation, project: Project) {
  if (job.status === 'QUEUED') return 'Your request is queued and waiting for the AI generation service.';
  if (job.status === 'RUNNING') return 'The AI is modifying this project workspace. Progress will update here.';
  if (job.status === 'FAILED') return 'Generation failed. Review the generation details below, then submit another request.';
  if (project.buildStatus === 'FAILED') return 'Generation finished, but the site build failed. Review the build logs before trying again.';
  if (project.buildStatus === 'INSTALLING') return 'The changes are generated. Installing dependencies before the preview can update.';
  if (project.buildStatus === 'BUILDING' || project.runtimeStatus === 'STARTING') return 'The changes are generated. Building and starting the live preview now.';
  if (project.runtimeStatus === 'RUNNING') return 'Changes completed and the live preview is running.';
  return 'Generation completed. The project manager is preparing the updated preview.';
}

function getPreviewState(project: Project) {
  if (project.runtimeStatus === 'RUNNING' && project.previewUrl) return 'running';
  if (project.buildStatus === 'INSTALLING') return 'Installing dependencies';
  if (project.buildStatus === 'BUILDING') return 'Building';
  if (project.runtimeStatus === 'STARTING') return 'Starting preview';
  if (project.buildStatus === 'FAILED') return 'Build failed';
  if (project.runtimeStatus === 'CRASHED') return 'Runtime crashed';
  if (project.runtimeStatus === 'FAILED') return 'Runtime failed';
  return 'No preview available';
}

function statusLabel(status: string) {
  const labels: Record<string, string> = { RUNNING: 'Generating', QUEUED: 'Queued', COMPLETED: 'Completed', FAILED: 'Failed', INSTALLING: 'Installing', BUILDING: 'Building', SUCCESS: 'Ready', STARTING: 'Starting', STOPPED: 'Stopped', CRASHED: 'Crashed', READY: 'Ready', CREATING: 'Creating', GENERATING: 'Generating', PENDING: 'Pending', IDLE: 'Idle' };
  return labels[status] ?? status.toLowerCase();
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function safeLog(value: string) {
  return value
    .replace(/((?:[A-Z0-9_]*(?:TOKEN|SECRET|PASSWORD|API[_-]?KEY|DATABASE_URL)[A-Z0-9_]*)\s*[=:]\s*)[^\s"']+/gi, '$1[redacted]')
    .replace(/(authorization\s*:\s*bearer\s+)[^\s]+/gi, '$1[redacted]')
    .replace(/((?:token|secret|password|api[_-]?key)\s*[=:]\s*)[^\s"']+/gi, '$1[redacted]')
    .replace(/(?:\/(?:home|Users|tmp|var|workspace|workspaces|srv|app)\/[^\s:]+|[A-Z]:\\Users\\[^\s\\]+)/g, '[local path]');
}
