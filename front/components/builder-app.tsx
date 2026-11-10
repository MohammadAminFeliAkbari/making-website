'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Activity,
  ArrowDown,
  ArrowLeft,
  ArrowUpRight,
  Check,
  ChevronDown,
  CircleHelp,
  Clock3,
  Code2,
  FilePlus2,
  Globe2,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  Menu,
  Monitor,
  Plus,
  Search,
  Smartphone,
  Sparkles,
  WandSparkles,
  X,
} from 'lucide-react';
import {
  authApi,
  generationsApi,
  Generation,
  Project,
  projectsApi,
  tokenStore,
  User,
} from '@/lib/api';

export function BuilderApp({
  projectId,
  authMode,
}: {
  projectId?: string;
  authMode?: 'login' | 'register';
}) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [project, setProject] = useState<Project | null>(null);
  const [jobs, setJobs] = useState<Generation[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [modal, setModal] = useState(false);
  const [name, setName] = useState('');
  const [prompt, setPrompt] = useState('');
  const [mobile, setMobile] = useState(false);
  const [logs, setLogs] = useState<{
    buildStdout: string | null;
    buildStderr: string | null;
    installStdout: string | null;
    installStderr: string | null;
    runtimeStdout: string;
    runtimeStderr: string;
    lastBuildError: string | null;
  } | null>(null);

  const refresh = useCallback(async () => {
    const [me, list] = await Promise.all([authApi.me(), projectsApi.list()]);
    setUser(me);
    setProjects(list);
    if (projectId) {
      const [item, history, runtime, projectLogs] = await Promise.all([
        projectsApi.get(projectId),
        generationsApi.list(projectId),
        projectsApi.preview(projectId),
        projectsApi.logs(projectId),
      ]);
      setProject({ ...item, ...runtime });
      setJobs(history);
      setLogs(projectLogs);
    }
  }, [projectId]);

  useEffect(() => {
    if (authMode) return;
    if (!tokenStore.get()) {
      router.replace('/auth/login');
      return;
    }
    refresh().catch((e) => setError(e.message));
  }, [authMode, refresh, router]);

  useEffect(() => {
    const generationActive = jobs.some((j) => j.status === 'QUEUED' || j.status === 'RUNNING');
    const buildExpected = jobs.some((j) => j.status === 'COMPLETED') && project?.buildStatus === 'PENDING';
    if (
      !projectId ||
      (!generationActive && !buildExpected &&
        !['INSTALLING', 'BUILDING'].includes(project?.buildStatus ?? '') &&
        project?.runtimeStatus !== 'STARTING')
    )
      return;
    const timer = window.setInterval(async () => {
      try {
        const [list, item, runtime, projectLogs] = await Promise.all([
          generationsApi.list(projectId),
          projectsApi.get(projectId),
          projectsApi.preview(projectId),
          projectsApi.logs(projectId),
        ]);
        setJobs(list);
        setProject({ ...item, ...runtime });
        setLogs(projectLogs);
      } catch (e) {
        setError((e as Error).message);
      }
    }, 3000);
    return () => window.clearInterval(timer);
  }, [jobs, projectId, project?.buildStatus, project?.runtimeStatus]);

  async function authenticate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const data = new FormData(event.currentTarget);
    try {
      const result =
        authMode === 'register'
          ? await authApi.register(
              String(data.get('email')),
              String(data.get('password')),
            )
          : await authApi.login(
              String(data.get('email')),
              String(data.get('password')),
            );
      tokenStore.set(result.accessToken);
      router.replace('/');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function createProject(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const item = await projectsApi.create(name);
      setProjects((p) => [item, ...p]);
      setModal(false);
      setName('');
      router.push(`/projects/${item.id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function submitPrompt(event: React.FormEvent) {
    event.preventDefault();
    if (!project || busy || !prompt.trim()) return;
    setBusy(true);
    setError('');
    try {
      const result = await projectsApi.generate(project.id, prompt.trim());
      setPrompt('');
      const now = new Date().toISOString();
      setJobs((list) => [
        {
          id: result.generationId,
          projectId: project.id,
          status: 'QUEUED',
          stdout: null,
          stderr: null,
          exitCode: null,
          createdAt: now,
          completedAt: null,
        },
        ...list,
      ]);
      setProject(await projectsApi.get(project.id));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function projectAction(action: 'build' | 'start' | 'stop' | 'restart') {
    if (!project) return;
    setBusy(true);
    setError('');
    try {
      await projectsApi[action](project.id);
      const [item, runtime, projectLogs] = await Promise.all([
        projectsApi.get(project.id),
        projectsApi.preview(project.id),
        projectsApi.logs(project.id),
      ]);
      setProject({ ...item, ...runtime });
      setLogs(projectLogs);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function logout() {
    tokenStore.clear();
    router.replace('/auth/login');
  }

  if (authMode)
    return (
      <main className="auth-shell">
        <div className="auth-art">
          <Link href="/" className="brand light">
            <span className="brand-mark">
              <Sparkles size={18} />
            </span>
            forma
          </Link>
          <div className="art-copy">
            <span className="eyebrow light-eyebrow">
              <i /> YOUR NEXT IDEA STARTS HERE
            </span>
            <h1>
              Build something
              <br />
              <em>remarkable.</em>
            </h1>
            <p>
              Turn a clear idea into a website that feels unmistakably yours.
            </p>
          </div>
          <div className="art-card">
            <div className="art-window">
              <div className="window-dots">
                <i />
                <i />
                <i />
              </div>
              <div className="art-sun" />
              <div className="art-line" />
              <div className="art-line short" />
              <div className="art-button" />
            </div>
            <span className="art-caption">
              A little imagination goes a long way.
            </span>
          </div>
          <span className="art-foot">
            DESIGNED FOR WHAT’S NEXT <span>© 2025 FORMA</span>
          </span>
        </div>
        <div className="auth-form-side">
          <div className="auth-top">
            <span>Already have a workspace?</span>
            <Link
              href={authMode === 'login' ? '/auth/register' : '/auth/login'}
              className="text-link"
            >
              {authMode === 'login' ? 'Create account' : 'Sign in'}{' '}
              <ArrowUpRight size={15} />
            </Link>
          </div>
          <form className="auth-card" onSubmit={authenticate}>
            <span className="eyebrow">
              {authMode === 'login' ? 'WELCOME BACK' : 'GET STARTED'}
            </span>
            <h2>
              {authMode === 'login'
                ? 'Sign in to Forma'
                : 'Create your account'}
            </h2>
            <p className="muted">
              {authMode === 'login'
                ? 'Pick up where your creativity left off.'
                : 'Your next great website is a few clicks away.'}
            </p>
            <label>
              Email address
              <input
                name="email"
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
                required
              />
            </label>
            <label>
              Password
              <input
                name="password"
                type="password"
                placeholder="At least 8 characters"
                minLength={8}
                autoComplete={
                  authMode === 'login' ? 'current-password' : 'new-password'
                }
                required
              />
            </label>
            {error && <div className="alert">{error}</div>}
            <button className="primary full" disabled={busy}>
              {busy ? (
                <LoaderCircle className="spin" size={17} />
              ) : authMode === 'login' ? (
                'Sign in'
              ) : (
                'Create account'
              )}
              <ArrowUpRight size={16} />
            </button>
            <small>
              By continuing, you agree to our Terms of Service and Privacy
              Policy.
            </small>
          </form>
          <div className="auth-bottom">
            <span>Thoughtfully made for makers.</span>
            <span>
              NEED HELP? <a href="mailto:hello@forma.studio">CONTACT US</a>
            </span>
          </div>
        </div>
      </main>
    );

  if (!user)
    return (
      <main className="loading-screen">
        <div className="loader-brand">
          <span className="brand-mark">
            <Sparkles size={18} />
          </span>
          forma
        </div>
        <LoaderCircle className="spin" />
        Preparing your workspace…
      </main>
    );
  const initials = user.email.slice(0, 2).toUpperCase();
  const filtered = projects.filter((p) =>
    p.name.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <Link href="/" className="brand">
          <span className="brand-mark">
            <Sparkles size={18} />
          </span>
          forma
        </Link>
        <div className="workspace-switch">
          <span className="workspace-icon">{initials}</span>
          <span>
            <b>Personal workspace</b>
            <small>Free plan</small>
          </span>
          <ChevronDown size={15} />
        </div>
        <div className="side-label">WORKSPACE</div>
        <Link href="/" className="nav-item active">
          <LayoutDashboard size={17} />
          Overview
        </Link>
        <button className="nav-item" onClick={() => setModal(true)}>
          <FilePlus2 size={17} />
          Projects<kbd>⌘ K</kbd>
        </button>
        <div className="side-label space-top">
          YOUR PROJECTS <span>{projects.length}</span>
        </div>
        <div className="project-nav">
          {projects.slice(0, 6).map((p) => (
            <Link
              key={p.id}
              href={`/projects/${p.id}`}
              className="project-link"
            >
              <span className="project-dot" />
              {p.name}
            </Link>
          ))}
        </div>
        <div className="sidebar-bottom">
          <button className="nav-item">
            <CircleHelp size={17} />
            Help & support
          </button>
          <div className="profile-row">
            <span className="avatar">{initials}</span>
            <span className="profile-copy">
              <b>{user.email.split('@')[0]}</b>
              <small>{user.email}</small>
            </span>
            <button className="icon-button" onClick={logout} title="Log out">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>
      <section className="main-area">
        <header className="topbar">
          <div className="breadcrumb">
            <span>Workspace</span>
            <span className="slash">/</span>
            <b>{project ? project.name : 'Overview'}</b>
          </div>
          <div className="top-actions">
            <button className="help-button">
              <CircleHelp size={16} />
              Help center
            </button>
            <span className="avatar small-avatar">{initials}</span>
          </div>
        </header>
        {error && (
          <div className="toast">
            <span>{error}</span>
            <button onClick={() => setError('')}>
              <X size={16} />
            </button>
          </div>
        )}
        {projectId && project ? (
          <div className="project-page">
            <div className="project-head">
              <div>
                <Link href="/" className="back-link">
                  <ArrowLeft size={15} /> All projects
                </Link>
                <div className="project-title-row">
                  <div className="large-project-icon">
                    <Globe2 size={22} />
                  </div>
                  <div>
                    <h1>{project.name}</h1>
                    <div className="project-meta">
                      <Status status={project.status} />
                      <span>
                        Created{' '}
                        {new Date(project.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              <button className="secondary" onClick={() => setMobile(!mobile)}>
                {mobile ? <Smartphone size={16} /> : <Monitor size={16} />}{' '}
                {mobile ? 'Mobile preview' : 'Desktop preview'}
              </button>
            </div>
            <div className="build-toolbar">
              <span>Setup <Status status={project.buildStatus} /></span>
              <span>Runtime <Status status={project.runtimeStatus} /></span>
              <div className="build-actions">
                <button className="secondary compact" disabled={busy} onClick={() => projectAction('build')}>Install &amp; run</button>
                {project.runtimeStatus === 'RUNNING' ? <button className="secondary compact" disabled={busy} onClick={() => projectAction('stop')}>Stop</button> : <button className="secondary compact" disabled={busy || project.buildStatus !== 'SUCCESS'} onClick={() => projectAction('start')}>Start</button>}
                <button className="secondary compact" disabled={busy || project.buildStatus !== 'SUCCESS'} onClick={() => projectAction('restart')}>Restart</button>
                {project.previewUrl && <a className="secondary compact" href={project.previewUrl} target="_blank" rel="noopener noreferrer">Open preview <ArrowUpRight size={14}/></a>}
              </div>
            </div>
            <div className="studio-grid">
              <section className="studio-main">
                <div className="section-head">
                  <div>
                    <span className="eyebrow">LIVE PREVIEW</span>
                    <h2>Your website, taking shape.</h2>
                  </div>
                  <span className="preview-status">
                    <i /> {project.previewUrl ?? 'PREVIEW NOT RUNNING'}
                  </span>
                </div>
                <div
                  className={`preview-frame ${mobile ? 'mobile-preview' : ''}`}
                >
                  <div className="preview-toolbar">
                    <span />
                    <span />
                    <span />
                    <div>project preview</div>
                    <Code2 size={15} />
                  </div>
                  {project.runtimeStatus === 'RUNNING' && project.previewUrl ? (
                    <iframe src={project.previewUrl} title={`${project.name} website preview`} className="website-iframe" sandbox="allow-scripts allow-forms allow-same-origin" />
                  ) : <div className="preview-unavailable">
                    <div className="preview-orbit">
                      <Globe2 size={25} />
                      <span />
                    </div>
                    <h3>{project.buildStatus === 'INSTALLING' ? 'Installing dependencies…' : project.buildStatus === 'BUILDING' ? 'Starting your development server…' : project.buildStatus === 'FAILED' ? 'Preview setup needs attention' : project.runtimeStatus === 'CRASHED' || project.runtimeStatus === 'FAILED' ? 'Preview stopped unexpectedly' : 'Start your development preview'}</h3>
                    <p>
                      {project.lastBuildError || 'The generated site will appear here after a successful build and preview startup.'}
                    </p>
                    <button type="button" className="primary" disabled={busy || project.buildStatus === 'INSTALLING' || project.buildStatus === 'BUILDING'} onClick={() => projectAction('build')}><Code2 size={15}/> Install &amp; run dev preview</button>
                  </div>}
                </div>
                <form className="prompt-composer" onSubmit={submitPrompt}>
                  <div className="composer-top">
                    <span className="composer-icon">
                      <WandSparkles size={17} />
                    </span>
                    <div>
                      <b>Tell Forma what to build</b>
                      <small>Describe a change or add a new section.</small>
                    </div>
                    <span className="model-pill">
                      <i /> AI BUILDER
                    </span>
                  </div>
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Try: Add a warm, editorial About page with a short founder story…"
                    maxLength={4000}
                  />
                  <div className="composer-bottom">
                    <span>{prompt.length}/4000 characters</span>
                    <button
                      className="primary"
                      disabled={busy || !prompt.trim()}
                    >
                      {busy ? (
                        <LoaderCircle className="spin" size={16} />
                      ) : (
                        <Sparkles size={16} />
                      )}{' '}
                      Generate
                    </button>
                  </div>
                </form>
              </section>
              <aside className="activity-panel">
                <div className="activity-title">
                  <div>
                    <Activity size={17} />
                    <b>Activity</b>
                  </div>
                  <button
                    className="icon-button"
                    onClick={() => refresh().catch((e) => setError(e.message))}
                  >
                    <ArrowDown size={16} />
                  </button>
                </div>
                {jobs.length === 0 ? (
                  <div className="activity-empty">
                    <span className="empty-icon">
                      <Clock3 size={20} />
                    </span>
                    <b>No activity yet</b>
                    <p>Your generation history will appear here.</p>
                  </div>
                ) : (
                  <div className="job-list">
                    {jobs.map((job) => (
                      <div className="job-card" key={job.id}>
                        <div className="job-card-top">
                          <Status status={job.status} />
                          <time>
                            {new Date(job.createdAt).toLocaleString()}
                          </time>
                        </div>
                        <p>
                          {job.status === 'COMPLETED'
                            ? 'Website updated'
                            : job.status === 'FAILED'
                              ? 'Generation failed'
                              : job.status === 'RUNNING'
                                ? 'Working on your request…'
                                : 'Waiting in queue'}
                        </p>
                        {job.stderr && (
                          <pre className="job-error">{job.stderr}</pre>
                        )}
                        {job.stdout && (
                          <details>
                            <summary>View output</summary>
                            <pre>{job.stdout}</pre>
                          </details>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {logs && <details className="build-logs"><summary>Build and runtime logs</summary><pre>{[logs.installStdout,logs.installStderr,logs.buildStdout,logs.buildStderr,logs.runtimeStdout,logs.runtimeStderr].filter(Boolean).join('\n')}</pre></details>}
                <div className="preview-note">
                  <Sparkles size={15} />
                  <span>
                    Generated code is saved in your project workspace.
                  </span>
                </div>
              </aside>
            </div>
          </div>
        ) : (
          <div className="dashboard">
            <div className="welcome-row">
              <div>
                <span className="eyebrow">MONDAY, YOUR NEXT IDEA AWAITS</span>
                <h1>
                  Good things start
                  <br className="mobile-break" /> with an idea
                  <span className="period">.</span>
                </h1>
                <p>What would you like to bring to life today?</p>
              </div>
              <button
                className="primary create-top"
                onClick={() => setModal(true)}
              >
                <Plus size={17} /> New project
              </button>
            </div>
            <div className="stats-row">
              <div className="stat-card">
                <span className="stat-icon violet">
                  <Globe2 size={18} />
                </span>
                <span>
                  <small>YOUR PROJECTS</small>
                  <b>{projects.length.toString().padStart(2, '0')}</b>
                </span>
                <span className="stat-foot">Across your workspace</span>
              </div>
              <div className="stat-card">
                <span className="stat-icon lime">
                  <Activity size={18} />
                </span>
                <span>
                  <small>READY TO VIEW</small>
                  <b>
                    {projects
                      .filter((p) => p.status === 'READY')
                      .length.toString()
                      .padStart(2, '0')}
                  </b>
                </span>
                <span className="stat-foot">Looking good already</span>
              </div>
              <div className="stat-card highlight-card">
                <span className="highlight-spark">
                  <Sparkles size={18} />
                </span>
                <span>
                  <small>A LITTLE INSPIRATION</small>
                  <b>Start with a feeling.</b>
                </span>
                <span className="stat-foot">
                  Describe the mood, not just the layout.
                </span>
              </div>
            </div>
            <div className="list-header">
              <div>
                <span className="eyebrow">YOUR WORKSPACE</span>
                <h2>
                  Projects <span>{projects.length}</span>
                </h2>
              </div>
              <div className="list-controls">
                <label className="search-box">
                  <Search size={16} />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search projects"
                  />
                </label>
                <button
                  className="secondary compact"
                  onClick={() => setModal(true)}
                >
                  <Plus size={16} /> New project
                </button>
              </div>
            </div>
            {projects.length === 0 ? (
              <div className="empty-state">
                <div className="empty-art">
                  <div className="empty-orbit">
                    <Sparkles size={21} />
                  </div>
                  <span className="orb orb-one" />
                  <span className="orb orb-two" />
                </div>
                <span className="eyebrow">A BLANK CANVAS</span>
                <h3>Your first project starts here.</h3>
                <p>
                  Give your idea a name. Forma will set up a workspace and you
                  can describe what to build next.
                </p>
                <button className="primary" onClick={() => setModal(true)}>
                  <Plus size={17} /> Create your first project
                </button>
              </div>
            ) : filtered.length === 0 ? (
              <div className="empty-filter">
                No projects match “{query}”. Try another search.
              </div>
            ) : (
              <div className="project-grid">
                {filtered.map((p, i) => (
                  <Link
                    href={`/projects/${p.id}`}
                    className="project-card"
                    key={p.id}
                  >
                    <div className={`project-cover cover-${i % 4}`}>
                      <div className="cover-window">
                        <span />
                        <span />
                        <span />
                        <div className="cover-shape" />
                        <div className="cover-lines">
                          <i />
                          <i />
                        </div>
                      </div>
                      <span className="cover-type">
                        {['STUDIO', 'PORTFOLIO', 'JOURNAL', 'BRAND'][i % 4]}
                      </span>
                    </div>
                    <div className="project-card-body">
                      <div>
                        <h3>{p.name}</h3>
                        <span>
                          Updated {new Date(p.updatedAt).toLocaleDateString()}
                        </span>
                      </div>
                      <Status status={p.status} />
                    </div>
                    <div className="card-footer">
                      <span>
                        <Globe2 size={14} /> Website project
                      </span>
                      <ArrowUpRight size={16} />
                    </div>
                  </Link>
                ))}
              </div>
            )}
            <div className="dashboard-foot">
              <span>Thoughtfully made for makers.</span>
              <span>FORMA STUDIO · 2025</span>
            </div>
          </div>
        )}
      </section>
      {modal && (
        <div className="modal-backdrop" onClick={() => setModal(false)}>
          <form
            className="modal"
            onSubmit={createProject}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="modal-close"
              onClick={() => setModal(false)}
            >
              <X size={18} />
            </button>
            <span className="modal-icon">
              <FilePlus2 size={20} />
            </span>
            <span className="eyebrow">NEW CANVAS</span>
            <h2>Name your project</h2>
            <p>
              Give your idea a home. You can describe what to build on the next
              screen.
            </p>
            <label>
              Project name
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={100}
                placeholder="e.g. Sunday Studio"
                required
              />
            </label>
            {error && <div className="alert">{error}</div>}
            <div className="modal-actions">
              <button
                type="button"
                className="secondary"
                onClick={() => setModal(false)}
              >
                Cancel
              </button>
              <button className="primary" disabled={busy || !name.trim()}>
                {busy ? (
                  <LoaderCircle className="spin" size={16} />
                ) : (
                  <Plus size={16} />
                )}{' '}
                Create project
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}

function Status({ status }: { status: string }) {
  const style = status.toLowerCase();
  return (
    <span className={`status status-${style}`}>
      <i />
      {status.toLowerCase()}
    </span>
  );
}
