'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Activity,
  ArrowUpRight,
  ChevronDown,
  CircleHelp,
  FilePlus2,
  Globe2,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  Plus,
  Search,
  Sparkles,
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
import { ProjectWorkspace } from '@/components/workspace/project-workspace';

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
      router.push(`/project/${item.id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function submitPrompt(text: string) {
    if (!project || busy || !text.trim()) throw new Error('Enter a request first.');
    setBusy(true);
    setError('');
    try {
      const result = await projectsApi.generate(project.id, text.trim());
      const now = new Date().toISOString();
      setJobs((list) => [
        {
          id: result.generationId,
          projectId: project.id,
          prompt: text.trim(),
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
      return result.generationId;
    } catch (e) {
      setError((e as Error).message);
      throw e;
    } finally {
      setBusy(false);
    }
  }
  async function projectAction(action: 'build' | 'start' | 'stop' | 'restart') {
    if (!project) return;
    setBusy(true);
    setError('');
    if (action === 'build') setProject({ ...project, buildStatus: 'INSTALLING', lastBuildError: null });
    if (action === 'start' || action === 'restart') setProject({ ...project, runtimeStatus: 'STARTING' });
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
      const current = await projectsApi.get(project.id).catch(() => null);
      if (current) setProject(current);
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
    <main className={`app-shell ${projectId ? 'workspace-app-shell' : ''}`}>
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
              href={`/project/${p.id}`}
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
          <ProjectWorkspace
            project={project}
            jobs={jobs}
            logs={logs}
            busy={busy}
            onGenerate={submitPrompt}
            onAction={projectAction}
            onRefresh={() => refresh().catch((e) => setError(e.message))}
          />
        ) : projectId ? (
          <main className="workspace-loading">{error ? <div><p>Could not load this project.</p><button className="secondary" onClick={() => { setError(''); refresh().catch((e) => setError(e.message)); }}>Try again</button></div> : <><LoaderCircle className="spin" size={20}/> Loading project…</>}</main>
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
                    href={`/project/${p.id}`}
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
  return <span className={`status status-${style}`}><i />{status.toLowerCase()}</span>;
}
