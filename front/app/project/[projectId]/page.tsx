import { BuilderApp } from '@/components/builder-app';

export default async function ProjectWorkspacePage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return <BuilderApp projectId={projectId} />;
}
