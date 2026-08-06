type InvoiceDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function InvoiceDetailPage({ params }: InvoiceDetailPageProps) {
  const { id } = await params;

  return (
    <main className="p-6">
      <h1 className="text-xl font-bold text-ink">Detail invoice</h1>
      <p className="text-sm text-muted">{id}</p>
    </main>
  );
}
