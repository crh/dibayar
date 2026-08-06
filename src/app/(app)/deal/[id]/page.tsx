type DealDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function DealDetailPage({ params }: DealDetailPageProps) {
  const { id } = await params;

  return (
    <main className="p-6">
      <h1 className="text-xl font-bold text-ink">Detail deal</h1>
      <p className="text-sm text-muted">{id}</p>
    </main>
  );
}
