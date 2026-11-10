'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LoaderCircle, Sparkles } from 'lucide-react';
import { projectsApi, tokenStore } from '@/lib/api';

const promptKey = 'forma.pendingPrompt';

export function CreateFromPrompt() {
  const router = useRouter();
  const [message, setMessage] = useState('Preparing your project…');
  const [error, setError] = useState('');
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    if (!tokenStore.get()) {
      router.replace('/auth/login?next=%2Fcreate');
      return;
    }
    const prompt = sessionStorage.getItem(promptKey)?.trim() || '';
    if (!prompt) {
      router.replace('/');
      return;
    }
    started.current = true;
    async function create() {
      try {
        setMessage('Creating your project…');
        const name = prompt.slice(0, 80).split(/[.!?\n]/)[0].trim() || 'My Website';
        const project = await projectsApi.create(name.slice(0, 100));
        setMessage('Sending your idea to AI…');
        await projectsApi.generate(project.id, prompt);
        sessionStorage.removeItem(promptKey);
        router.replace(`/project/${project.id}`);
      } catch (cause) {
        setError((cause as Error).message || 'Could not create your project.');
      }
    }
    void create();
  }, [router]);

  return <main className="creation-state">
    {error ? <div role="alert"><span className="home-icon"><Sparkles size={20}/></span><h1>We couldn’t start your project</h1><p>{error}</p><button className="home-button primary" onClick={() => router.push('/')}>Back to home</button></div> : <><LoaderCircle className="spin" size={24}/><h1>{message}</h1><p>Your workspace will open as soon as it’s ready.</p></>}
  </main>;
}
