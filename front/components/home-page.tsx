'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowDown, ArrowRight, ArrowUpRight, Check, Code2, Eye, Globe2, LayoutTemplate, LoaderCircle, Menu, MessageSquareText, Sparkles, WandSparkles, X } from 'lucide-react';
import { authApi, projectsApi, tokenStore, type User } from '@/lib/api';

const promptKey = 'forma.pendingPrompt';
const showcase = [
  { title: 'Business websites', kind: 'BUSINESS', theme: 'sage' },
  { title: 'Landing pages', kind: 'PRODUCT', theme: 'peach' },
  { title: 'Online stores', kind: 'STOREFRONT', theme: 'blue' },
  { title: 'Personal portfolios', kind: 'PORTFOLIO', theme: 'lilac' },
  { title: 'Blogs', kind: 'EDITORIAL', theme: 'sand' },
  { title: 'SaaS websites', kind: 'SAAS', theme: 'night' },
];

export function HomePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [isRtl, setIsRtl] = useState(false);

  useEffect(() => {
    setIsRtl(/^(fa|ar|ur|ps)(-|$)/i.test(navigator.language));
  }, []);

  useEffect(() => {
    let active = true;
    if (!tokenStore.get()) { setAuthReady(true); return; }
    authApi.me().then((value) => { if (active) setUser(value); }).catch(() => { if (active) setUser(null); }).finally(() => { if (active) setAuthReady(true); });
    return () => { active = false; };
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = prompt.trim();
    if (!text) { setError('Describe the website you want to build first.'); return; }
    if (text.length > 4000) { setError('Keep your description under 4,000 characters.'); return; }
    setError('');
    if (!tokenStore.get()) {
      sessionStorage.setItem(promptKey, text);
      router.push('/auth/register?next=%2Fcreate');
      return;
    }
    setBusy(true);
    try {
      const name = text.split(/[.!?\n]/)[0].trim().slice(0, 100) || 'My Website';
      const project = await projectsApi.create(name);
      await projectsApi.generate(project.id, text);
      router.push(`/project/${project.id}`);
    } catch (cause) {
      setError((cause as Error).message || 'Your project could not be created. Please try again.');
      setBusy(false);
    }
  }

  return <main className="home-page" dir={isRtl ? 'rtl' : 'ltr'}>
    <header className="home-nav-wrap">
      <nav className="home-nav" aria-label="Main navigation">
        <Link href="/" className="home-brand"><span className="home-brand-mark"><Sparkles size={17}/></span>forma</Link>
        <button className="home-menu-toggle" aria-label={menuOpen ? 'Close menu' : 'Open menu'} aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X/> : <Menu/>}</button>
        <div className={`home-nav-links ${menuOpen ? 'open' : ''}`}>
          <a href="#features" onClick={() => setMenuOpen(false)}>Features</a>
          <a href="#how-it-works" onClick={() => setMenuOpen(false)}>How it works</a>
          <a href="#showcase" onClick={() => setMenuOpen(false)}>Examples</a>
          <div className="home-nav-auth">
            {!authReady ? <span className="nav-loading" aria-label="Checking account"><LoaderCircle className="spin" size={16}/></span> : user ? <><Link className="home-login" href="/dashboard">My projects</Link><Link className="home-account" href="/dashboard" aria-label={`Account for ${user.email}`}>{user.email.slice(0, 1).toUpperCase()}</Link></> : <><Link className="home-login" href="/auth/login">Log in</Link><Link className="home-button primary" href="/auth/register">Sign up <ArrowUpRight size={15}/></Link></>}
          </div>
        </div>
      </nav>
    </header>

    <section className="home-hero" aria-labelledby="hero-heading">
      <div className="hero-glow"/>
      <div className="hero-content">
        <span className="home-kicker"><span className="kicker-star"><Sparkles size={12}/></span> YOUR IDEA, BUILT WITH AI</span>
        <h1 id="hero-heading">Build Any Website<br/><span>with AI</span></h1>
        <p className="hero-description">Describe your idea, and let AI turn it into a real website.<br className="desktop-only"/> No coding required.</p>
        <form className="hero-prompt" onSubmit={submit}>
          <label className="sr-only" htmlFor="website-prompt">Describe the website you want to build</label>
          <textarea id="website-prompt" value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Describe the website you want to build..." rows={3} maxLength={4000} dir="auto" aria-describedby={error ? 'prompt-error' : 'prompt-hint'} onKeyDown={(event) => { if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') void submit(event as unknown as React.FormEvent<HTMLFormElement>); }}/>
          <div className="prompt-bottom"><span id={error ? 'prompt-error' : 'prompt-hint'} className={error ? 'prompt-error' : ''}>{error || <><Sparkles size={13}/> Be as detailed as you like</>}</span><button type="submit" className="home-button primary" disabled={busy}>{busy ? <LoaderCircle className="spin" size={16}/> : <>{user ? 'Generate website' : 'Generate website'} <ArrowRight size={16}/></>}</button></div>
        </form>
        <div className="hero-proof"><span><Check size={13}/> No coding required</span><i/><span><Check size={13}/> Preview and refine</span><i/><span><Check size={13}/> Download your code</span></div>
      </div>
      <div className="hero-visual" aria-label="Illustration of an AI generated website preview">
        <div className="visual-orbit orbit-one"/><div className="visual-orbit orbit-two"/>
        <div className="float-chip chip-ai"><Sparkles size={14}/> AI is creating <span className="chip-dots">•••</span></div>
        <div className="browser-card"><div className="browser-bar"><div className="browser-dots"><i/><i/><i/></div><span>your-new-website.com</span><ArrowUpRight size={12}/></div><div className="mock-site"><div className="mock-nav"><b>STUDIO<span>.</span></b><div><i/><i/><i/></div><button/></div><div className="mock-hero"><div className="mock-copy"><i className="mock-eyebrow"/><i className="mock-title"/><i className="mock-title second"/><i className="mock-desc"/><i className="mock-cta"/></div><div className="mock-photo"><div className="mock-sun"/><div className="mock-hill hill-back"/><div className="mock-hill hill-front"/></div></div><div className="mock-strip"><i/><i/><i/><i/></div></div></div>
        <div className="float-chip chip-preview"><Eye size={14}/> Live preview <span className="live-dot"/></div>
        <div className="float-chip chip-code"><Code2 size={14}/> Your source code</div>
      </div>
      <a className="scroll-cue" href="#how-it-works"><ArrowDown size={14}/> See how it works</a>
    </section>

    <section className="home-section steps-section" id="how-it-works">
      <div className="section-intro"><span className="home-kicker">A SIMPLE WORKFLOW</span><h2>From idea to website<br/>in three steps.</h2><p>Go from a blank page to a working project, then shape it through conversation.</p></div>
      <div className="steps-grid"><article className="step-card"><span className="step-number">01</span><div className="step-icon"><MessageSquareText size={21}/></div><h3>Describe</h3><p>Tell AI what kind of website you need. Share the details, style, and purpose in your own words.</p><div className="step-mini prompt-mini"><Sparkles size={13}/><span>Make a portfolio for a product designer...</span></div></article><article className="step-card"><span className="step-number">02</span><div className="step-icon"><WandSparkles size={21}/></div><h3>Generate</h3><p>AI turns your prompt into a real project. Follow its progress in your workspace.</p><div className="step-mini progress-mini"><span className="mini-progress"><i/></span><span>Creating your website</span><Check size={13}/></div></article><article className="step-card"><span className="step-number">03</span><div className="step-icon"><Eye size={21}/></div><h3>Customize</h3><p>Preview the result, ask for changes in plain language, and download the project source.</p><div className="step-mini edit-mini"><span>“Make the colors warmer”</span><ArrowUpRight size={14}/></div></article></div>
    </section>

    <section className="feature-band" id="features"><div className="home-section feature-layout"><div className="feature-copy"><span className="home-kicker">MADE FOR BUILDING</span><h2>Everything you need<br/>to make it yours.</h2><p>A focused workspace brings generation, conversation, and preview together so you can keep moving from idea to finished project.</p><Link href="#prompt" onClick={(event) => { event.preventDefault(); document.getElementById('website-prompt')?.focus(); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="text-cta">Start with a prompt <ArrowRight size={16}/></Link></div><div className="feature-list"><article><span><Sparkles size={18}/></span><div><h3>AI website generation</h3><p>Start a project from a natural-language description.</p></div></article><article><span><MessageSquareText size={18}/></span><div><h3>Natural-language editing</h3><p>Continue the conversation to refine your existing project.</p></div></article><article><span><Eye size={18}/></span><div><h3>Live website preview</h3><p>Build and view your project in desktop, tablet, and mobile sizes.</p></div></article><article><span><Code2 size={18}/></span><div><h3>Downloadable source code</h3><p>Export the project files as a ZIP when you’re ready.</p></div></article><article><span><Globe2 size={18}/></span><div><h3>Your project workspace</h3><p>Keep project files and generation history in your account.</p></div></article><article><span><LayoutTemplate size={18}/></span><div><h3>Fast iteration</h3><p>Generate, preview, and request another change in one place.</p></div></article></div></div></section>

    <section className="home-section showcase-section" id="showcase"><div className="showcase-heading"><div><span className="home-kicker">A STARTING POINT FOR ANY IDEA</span><h2>What will you make?</h2><p>Start from the kind of website you have in mind. Every example below is an illustrative preview.</p></div><span className="showcase-stamp"><Sparkles size={14}/> YOUR IDEA, YOUR WAY</span></div><div className="showcase-grid">{showcase.map((item, index) => <article className={`showcase-card ${item.theme}`} key={item.title}><div className="showcase-preview"><div className="showcase-window"><div className="showcase-browser"><i/><i/><i/><span>{item.kind.toLowerCase()}.site</span></div><div className={`showcase-art art-${index}`}><div className="art-topline"/><div className="art-headline"/><div className="art-headline short"/><div className="art-visual"><i/><b/><em/></div><div className="art-button"/></div></div><span className="showcase-index">0{index + 1}</span></div><div className="showcase-caption"><h3>{item.title}</h3><span>Example direction <ArrowUpRight size={13}/></span></div></article>)}</div></section>

    <section className="home-cta"><div className="cta-decoration"><span/><span/><span/></div><div className="cta-content"><span className="home-kicker">YOUR NEXT CHAPTER STARTS HERE</span><h2>Your next website starts<br/>with one prompt.</h2><p>Tell us what you have in mind. Let’s make something real.</p><button className="home-button cta-button" onClick={() => { document.getElementById('website-prompt')?.focus(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Start building <ArrowRight size={16}/></button></div><div className="cta-spark cta-spark-one"><Sparkles size={20}/></div><div className="cta-spark cta-spark-two"><Sparkles size={13}/></div></section>

    <footer className="home-footer"><div className="footer-main"><div className="footer-brand-col"><Link href="/" className="home-brand"><span className="home-brand-mark"><Sparkles size={17}/></span>forma</Link><p>A little imagination goes a long way.<br/>Turn your idea into a website with AI.</p></div><div className="footer-links"><div><b>Explore</b><a href="#features">Features</a><a href="#how-it-works">How it works</a><a href="#showcase">Examples</a></div><div><b>Account</b><Link href="/auth/login">Log in</Link><Link href="/auth/register">Sign up</Link><Link href="/dashboard">My projects</Link></div></div></div><div className="footer-bottom"><span>© {new Date().getFullYear()} Forma. All rights reserved.</span><span>Made for the next idea.</span></div></footer>
  </main>;
}
