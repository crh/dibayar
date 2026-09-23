# Self-hosted font assets

These `.woff2` files replace the `next/font/google` build-time fetch that was
causing intermittent CI failures (`TypeError: Cannot read properties of null
(reading '1')` in `@next/font/dist/google/loader.js` when the GitHub Actions
runner couldn't reach Google's font CDN during `next build`).

## Provenance

Both fonts are Google Fonts, licensed under the SIL Open Font License 1.1
(see the `LICENSE-OFL.txt` next to each font's files). The static `.woff2`
subset files were copied unmodified from the official npm distribution:

- `@fontsource/plus-jakarta-sans@5.3.0` (`files/plus-jakarta-sans-latin-{400,500,600,700,800}-normal.woff2`)
  used by `src/app/layout.tsx`.
- `@fontsource/source-serif-4@5.3.0` (`files/source-serif-4-latin-{500,600}-normal.woff2`)
  used by `src/app/i/[token]/page.tsx` — see `src/app/i/[token]/fonts/`.

Fontsource re-packages Google Fonts' own release artifacts without
modification; only the `latin` subset at the weights already in use was
kept, matching the previous `next/font/google` configuration
(`subsets: ["latin"]`).

No new runtime or build dependency was added — the packages above were used
only as a one-time, verifiable source for the binary files, which are now
loaded locally via `next/font/local`.
