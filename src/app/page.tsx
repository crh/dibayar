const PIPELINE_STAGES = ["Masuk", "Nego", "Deal", "Konten", "Invoice", "Dibayar"];

const CARA_KERJA = [
  {
    judul: "Catat deal dalam hitungan detik",
    detail:
      "Simpan brand, fee, dan tenggat langsung dari chat WhatsApp atau DM, tanpa formulir panjang.",
  },
  {
    judul: "Pantau semua deal di satu alur",
    detail:
      "Lihat setiap deal bergerak dari Masuk sampai Dibayar, tanpa scroll chat lama.",
  },
  {
    judul: "Kirim pengingat sebelum telat bayar",
    detail:
      "Tandai invoice jatuh tempo dan kirim tindak lanjut yang sopan lewat WhatsApp.",
  },
];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col bg-bg">
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-10 px-5 py-12">
        <header className="flex flex-col gap-3">
          <p className="text-[17px] font-bold tracking-tight text-ink">Dibayar</p>
          <span className="inline-flex h-7 w-fit items-center rounded-full border border-line bg-surface px-3 text-[13px] font-semibold text-primary">
            Segera hadir
          </span>
        </header>

        <section className="flex flex-col gap-3">
          <h1 className="text-[26px] font-bold leading-tight text-ink">
            Kelola deal brand, invoice, dan pembayaran di satu tempat
          </h1>
          <p className="text-[15px] leading-6 text-muted">
            Dibayar sedang disiapkan untuk kreator Indonesia yang capek nego dan
            nagih pembayaran lewat chat WhatsApp yang berantakan.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2
            id="alur-kerja"
            className="text-[13px] font-semibold uppercase tracking-wide text-muted"
          >
            Alur kerja deal brand kamu
          </h2>
          <ol aria-labelledby="alur-kerja" className="flex flex-wrap gap-2">
            {PIPELINE_STAGES.map((stage) => (
              <li
                key={stage}
                className="rounded-full border border-line bg-surface px-3 py-1.5 text-[13px] font-semibold text-ink"
              >
                {stage}
              </li>
            ))}
          </ol>
          <a
            href="#cara-kerja"
            className="inline-flex h-11 w-fit items-center justify-center rounded-full bg-primary px-5 text-[15px] font-semibold text-surface transition-colors hover:bg-primary-d"
          >
            Lihat cara kerja
          </a>
        </section>

        <section id="cara-kerja" className="flex flex-col gap-4 border-t border-line pt-8">
          <h2 className="text-[20px] font-bold text-ink">Cara kerjanya</h2>
          <ol className="flex flex-col gap-4">
            {CARA_KERJA.map((langkah, index) => (
              <li key={langkah.judul} className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-paid text-[13px] font-semibold text-surface">
                  {index + 1}
                </span>
                <div className="flex flex-col gap-1">
                  <p className="text-[15px] font-semibold text-ink">{langkah.judul}</p>
                  <p className="text-[13px] leading-5 text-muted">{langkah.detail}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </main>

      <footer className="mx-auto w-full max-w-md px-5 pb-8">
        <p className="text-[13px] text-muted">
          Dibayar — belum tersedia untuk umum. Dibuat untuk kreator Indonesia.
        </p>
      </footer>
    </div>
  );
}
