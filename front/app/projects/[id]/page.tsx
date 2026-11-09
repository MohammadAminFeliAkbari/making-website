import { BuilderApp } from '@/components/builder-app';
export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <BuilderApp projectId={id} />;
}
