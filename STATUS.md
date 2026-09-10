# Prism Capital — Catatan Status (10 Sep 2026)

## Sudah selesai ✅
**Landing page** — replika crumbs.family: hero 3 kolom (h1 kiri / iPhone mockup tengah / copy + CTA kanan), background ubin quilted hijau, koin kaca melayang (CSS), font Schibsted Grotesk.
- `src/app/page.tsx`, `src/components/{HeroBackdrop,Phone,Logo,Icons}.tsx`, CSS landing di-scope `.lp` / `.ip` di `globals.css`
- Section: hero · "Mint the basket. Redeem the basket." (phone kedua, alur mint pSEMI) · Three indexes · Priced honestly · CTA gelap · footer

**Smart contract** (`contracts/`, Foundry) — **62 test lolos** (4 fuzz + 5 invariant)
- `IndexVault.sol`: `nav()` dari oracle, `mint`/`redeem` pro-rata basket, **revert `StalePrice(asset)`** kalau ada leg basi (saham tutup → mint/redeem pause), band rebalance + NAV-loss guard + cooldown via `ISwapExecutor`, weight cap, management fee streaming 0.5%/th + mint fee 0.1%, pause
- `IndexToken.sol` (ERC20 + Permit), `IndexFactory.sol`; mock: `MockERC20`, `MockOracle` (`markStale`/`refresh`), `MockSwapExecutor`
- 3 index ter-deploy: **pSEMI** (NVDA 20 · AMD 11 · AVGO 14 · TSM 16 · ASML 10 · MU 9 · QCOM 10 · INTC 10) NAV $238.10 · **pMETL** (SLV 70 + 2 metal 15/15) $33.20 · **pDGEN** (4 memecoin × 25, cap 35%, staleness 15 mnt) $0.19
- Terbukti via `cast`: `nav()` → 238.10 → `markStale(NVDA)` → `nav()` **revert StalePrice** → `refresh` → normal lagi

**Frontend app** — wagmi + viem
- `/app`: 3 index dengan NAV live, komposisi (weight vs target, harga, badge fresh/stale, banner pause), form mint (approve tiap komponen) & redeem, saldo user
- `src/components/ConnectButton.tsx`, `src/lib/hooks.ts` (`useIndexes`, `useUserIndexBalances`), `src/lib/{chain,contracts,wagmi,format}.ts`
- `npm run build` ✓ · `tsc` ✓ · `eslint` ✓

## Belum selesai ⏳
1. ~~Tombol Connect di landing~~ **selesai** — tombol "Get started" di header sekarang `<ConnectButton />` sungguhan ("Log in" tetap link ke /app). Phone mockup juga sudah live: nilai USD tiap basket dihitung dari `nav()` on-chain, jumlah nama per index dari komposisi aslinya, dan total dijumlahkan ulang. Ukuran holding tetap ilustratif. Fallback ke angka statis kalau chain tidak terjangkau.
2. **Robinhood Chain** — ~~placeholder di kode~~ **jalur production siap, tinggal isi angka.** `chain.ts` sekarang sepenuhnya env-driven (`NEXT_PUBLIC_CHAIN_ID/RPC_URL/EXPLORER_URL`, lihat `.env.example`); `scripts/sync-abi.mjs` baca manifest sesuai `DEPLOYMENT=<nama>`. Deployment sungguhan lewat `contracts/script/DeployProduction.s.sol` + `script/config/ProductionConfig.sol` (satu file berisi alamat USDG/oracle/swap venue/multisig/keeper + alamat token asli tiap basket, dicek compiler). `npm run deploy:check` = preflight tanpa broadcast: revert `NotConfigured(..)` kalau ada alamat nol, `WeightsDoNotSum`, `NoOraclePrice`, `OraclePriceStale`. **Masih blocked**: alamatnya belum dipublikasikan Robinhood. Yang tersisa cuma mengisi konstanta itu.
3. ~~`mintWithUSDG`~~ **selesai** — `mintWithUSDG(usdgIn, minIndexOut, to)` dan `redeemForUSDG(indexAmount, minUsdgOut, to)` di `IndexVault`, lewat `ISwapExecutor` yang sama dengan rebalance. USDG dipecah menurut target weight (jadi masuk sekalian menarik index ke target), share dicetak dari selisih `totalValue()` yang benar-benar terukur → slippage ditanggung minter, bukan holder lama; `minOut` membatasi kerugian. Ada `previewMintWithUSDG`/`previewRedeemForUSDG` untuk UI. Terbukti on-chain: 100 USDG → 0.4194 pSEMI (NAV $238.10), 0 USDG tersisa di vault, NAV per token tidak bergerak; round-trip balik ke 99.70 USDG = 0.30% (2×10bp fee + 2×5bp slippage mock).
4. ~~Price pusher/keeper~~ **selesai** — `scripts/keeper.mjs` (`npm run keeper`) mendorong ulang semua feed (15 aset, semua index) ke oracle tiap 30 dtk lewat `setPrices`, jadi pDGEN tidak pause lagi saat demo lokal. Flag: `--interval <dtk>`, `--drift <persen>` (random walk harga, bikin NAV bergerak di UI), `--once`. Terbukti: `markStale(DOGE, 1h)` → `nav()` revert `StalePrice` → `npm run keeper -- --once` → `nav()` normal lagi. Untuk produksi masih perlu keeper sungguhan yang menarik harga dari feed asli, bukan mendorong ulang harga lama.
5. ~~Weight-solver~~ **selesai** — `previewRebalance(slippageBps)` menghitung rencana trade on-chain (greedy: surplus terbesar dilawankan ke defisit terbesar, di bawah 0.1% basket diabaikan), `rebalanceToTarget(slippageBps)` mengeksekusinya dalam satu panggilan keeper dengan guard lama (NAV-loss, weight cap, cooldown). `npm run keeper:rebalance` menjalankannya otomatis. Terbukti: NVDA dinaikkan 182→280 → bobot 27.73% → keeper solve 7 swap → kembali [2000, 1099, 1399, 1599, 999, 899, 999, 999] bps, `rebalanceNeeded()` false, NAV naik wajar mengikuti harga.
6. ~~Wallet flow~~ **selesai** — `npm run test:e2e`: Playwright + Chromium, `window.ethereum` di-inject (EIP-1193 + EIP-6963) sebagai proxy JSON-RPC ke anvil, jadi jalurnya benar-benar wagmi → ABI asli → transaksi on-chain. 5 test: connect + baca NAV live, beli pSEMI pakai USDG, jual balik, mint pMETL lewat approve per-leg, dan pDGEN pause saat feed basi lalu pulih setelah oracle publish lagi. Tiap run pakai anvil sekali pakai di port 8546 + build production sendiri (server tidak di-reuse) supaya deterministik; **hijau 3× berturut-turut**.
7. **Audit** — belum ada audit profesional, dan ini **tidak** menggantikannya. Yang sudah dilakukan: review manual kontrak + 5 invariant test Foundry (128.000 call per invariant). Lihat "Hasil review" di bawah.

## Situs: docs, whitepaper, blog ✅
Sebelumnya cuma ada `/docs` yang menampilkan satu esai mentah, `LINKS.blog` menunjuk `/blog` yang tidak ada (**link mati**), tidak ada whitepaper, dan `LINKS` sendiri tidak dipakai di mana pun.

- **`/whitepaper`** — spesifikasi lengkap ditulis dari kode: valuasi & NAV, aturan staleness beserta alasan menolak tiga alternatifnya, creation/redemption in-kind dan lewat USDG, solver bobot, empat guard rebalance, asumsi kepercayaan (oracle / swap venue / owner — termasuk apa yang owner **tidak** bisa lakukan), verifikasi, dan batasan yang jujur. ~13 menit baca, dengan daftar isi.
- **`/docs`** — 6 halaman: What Prism is · Buying and selling · NAV and the staleness rule · Rebalancing · Contracts · Risks. Ada sidebar section, TOC per halaman, dan navigasi prev/next.
- **`/blog`** — index + halaman post. Artikel lama dipindah ke `content/blog/` dan **bagian roadmap-nya yang sudah basi diperbaiki** (masih menulis `mintWithUSDG` dan keeper sebagai rencana). Ditambah satu post baru soal apa yang barusan dikirim.
- Semua konten di `content/` sebagai Markdown + frontmatter — menulis halaman baru = menambah file, tanpa route atau komponen baru.
- Renderer `src/lib/markdown.tsx` menghasilkan elemen React langsung, **tanpa `dangerouslySetInnerHTML`**, jadi salah tulis di konten tidak bisa jadi script.
- Header landing dan footer sekarang benar-benar menautkan Docs/Whitepaper/Blog lewat `LINKS`; `/terms` dan `/privacy` ikut memakai kerangka yang sama.
- 5 test Playwright: tiap halaman docs kebuka, Markdown benar-benar jadi heading/tabel/`<pre>` (bukan teks mentah), tiap entri TOC whitepaper menunjuk heading yang ada, blog render, dan **crawler yang memastikan tidak ada satu pun link internal yang 404**.

Bug yang ketemu sambil jalan: heading bernomor (`## 1. Motivation`) menghasilkan `id` diawali angka — sah di HTML tapi tidak bisa diseleksi CSS, jadi anchor-nya rusak. Sekarang di-prefix.

## Pass UI (detail kecil)
Diperiksa lewat screenshot di 390px dan 1400px, lalu diperbaiki:

**Rusak beneran**
- **Header prose meluber di mobile** — tombol "Open app" terpotong di luar layar pada semua halaman docs/whitepaper/blog. Tiga link section sekarang muncul dari `sm` ke atas; footer tetap membawanya di mobile.
- **Saldo palsu sebelum wallet tersambung** — `useUserIndexBalances` mengembalikan `0n` saat query dinonaktifkan, jadi UI menulis "0 pSEMI" dan "wallet 0 · insufficient" dengan yakin untuk sesuatu yang sebenarnya *tidak diketahui*. Sekarang `undefined` → UI menampilkan "—" dan "Connect a wallet to trade."
- **Tile statistik `/app` terpotong di mobile** — "1,000…", "$238,…", "in ba…" karena dipaksa 3 kolom. Sekarang menumpuk di bawah 420px dan nilainya utuh.
- **Baris komponen berdesakan** di mobile; bar bobot sekarang turun ke baris sendiri, alamat vault tidak lagi terpotong jadi dua baris.
- **`scroll-behavior: smooth` tanpa penjagaan** — sekarang di dalam `prefers-reduced-motion: no-preference`.
- **Tidak ada state fokus keyboard** — sekarang ada ring `:focus-visible` yang eksplisit (hijau di atas permukaan gelap), bukan default browser yang hilang di atas hijau.
- **Tidak ada halaman 404** — sekarang `/not-found` pakai kerangka yang sama dan menautkan empat tujuan yang benar-benar ada.
- **Metadata share kosong** — `metadataBase`, OpenGraph, dan Twitter card; origin lewat `NEXT_PUBLIC_SITE_URL`.

**Detail**
- Dua tombol bertumpuk di form USDG ("Approve USDG" + "Approve USDG first" yang disabled) → satu ajakan bertindak saja. **Kecuali saat index pause** — di situ tombol utama harus tetap berbunyi "Paused — stale leg", dan test e2e menangkap saya melanggar aturan itu di percobaan pertama.
- Saldo wallet sekarang menyebut satuannya ("1,000,000 USDG", bukan "1,000,000").
- `text-wrap: balance` untuk heading dan `pretty` untuk paragraf prosa, warna `::selection`, dan jarak napas untuk link "← Docs" di mobile.
- **Nol bertanda.** Leg yang pas di target ditulis `-0.0%` atau `+0.0%` — angka yang sama memakai dua tanda berbeda, dan tanda itulah yang pertama ditangkap mata. Sekarang "on target", dan targetnya tidak disebut ulang (kalau sudah on target, "target 25.0%" tidak menambah apa pun). Ada test regresinya.
- **Umur harga memakai jam yang salah.** Tooltip "updated …" dihitung dari `Date.now()` browser, sementara badge fresh/stale di sebelahnya dihitung dari timestamp block. Jam yang meleset bikin keduanya berbeda. Sekarang keduanya pakai jam chain, dan helper `ago()` yang berbasis jam lokal saya hapus supaya tidak dipakai lagi tanpa sengaja.
- **Input menerima titik ganda.** "1.2.3" gagal di-parse, jumlahnya jadi 0, tombolnya mati tanpa penjelasan. Sekarang field dibatasi satu titik desimal.
- "You receive ≈" dan nilainya berebut satu baris di mobile (`≈` sampai turun sendirian); sekarang bertumpuk. Pill "one transaction" disembunyikan di bawah 400px, bukan dibiarkan pecah dua baris.
- **A11y:** `aria-pressed` untuk toggle buy/sell, mint/redeem, dan slippage; tab sekarang benar-benar punya `role="tabpanel"` + `aria-controls` (ARIA setengah jadi lebih buruk daripada tidak ada); region `aria-live` mengumumkan "Confirming transaction" untuk pembaca layar.
- Header tabel "Fees" di docs punya kolom pertama tanpa judul; sekarang "Fee". Transisi hover disamakan di semua kontrol.

Juga: `scripts/e2e.sh` sekarang ikut membunuh server di port 3100 saat keluar. Server yatim dari run yang dihentikan sempat membuat dua test gagal dengan gejala yang mirip bug produk — bukan.

## Publikasi & housekeeping ✅
- **Alamat token `$PRISM` palsu dihapus** dari footer landing. Itu alamat karangan yang ditampilkan seperti alamat kontrak sungguhan, lengkap dengan tombol copy — di situs publik itu hal yang orang kirimi uang. Diganti kalimat jujur: "Not audited. Not deployed to a live network."
- **Link sosial mati** (`https://x.com/`, `https://t.me/`) — ikonnya sekarang hanya muncul kalau `LINKS.x` / `LINKS.telegram` diisi. `null` = tidak dirender.
- **`LICENSE` (MIT)** ditambahkan, cocok dengan header SPDX di `contracts/`.
- **CI** (`.github/workflows/ci.yml`): tiga job — kontrak (build + 62 test), web (tsc/eslint/build), dan browser (11 test Playwright). Supaya jalan di runner, resolusi binary Foundry dipindah ke `scripts/foundry.sh` (PATH → `$FOUNDRY_BIN` → `~/.foundry/bin`); sebelumnya semua script npm menunjuk `~/.foundry/bin` yang tidak ada di CI.
- **`og:image`** — `src/app/opengraph-image.tsx`, digambar dari geometri brand sendiri tanpa fetch webfont, jadi build tidak bergantung pada Google Fonts hidup.
- Alamat kontak dipusatkan ke `CONTACT_EMAIL` di `links.ts` dan dijadikan `mailto:` di Terms/Privacy. **Pastikan `support@prism.capital` benar-benar ada sebelum situs dipublikasikan.**

## Pass desain: permukaan
Landing sudah sejak awal memakai bahasa fisik (mockup iPhone, token `--bezel`/`--lens`). Sisanya menyusul dengan volume jauh lebih rendah, jadi kartu, tile, dan input terbaca sebagai tiga kedalaman dari satu material — bukan tiga kotak yang tidak berhubungan.
- Tiga primitif di `globals.css`: `.surface` (panel di atas halaman), `.surface-interactive` (mengangkat saat hover, dijaga `prefers-reduced-motion`), `.surface-inset` (input, blok kode, kutipan).
- Bayangan diberi rona hijau tinta, **tidak pernah abu-abu** — bayangan netral di atas off-white hangat terlihat seperti kotoran.
- Diterapkan ke: kartu docs, prev/next, tabel & blok kode prosa, kartu index `/app`, tile statistik, bar bobot (inset dengan sorotan atas), dan panel form.
- Form beli/jual kini `sticky` di kolom kanan, jadi tetap terlihat saat daftar komponen yang panjang tergulir lewat.

## Hasil review keamanan (bukan audit)
Temuan nyata, sudah diperbaiki:
1. **USDG boleh jadi leg basket** (`IndexVault` constructor). Kalau dikonfigurasi begitu, USDG yang disetor minter ikut terhitung sebagai kenaikan nilai basket → `mintWithUSDG` mencetak share gratis, dan `redeemForUSDG` menukar USDG dengan dirinya sendiri. Sekarang ditolak: `UsdgCannotBeComponent`, dengan test.
2. **Transaksi revert tidak memberi umpan balik di UI** — tombol tersangkut di "Confirming…" selamanya. `useWaitForTransactionReceipt` tetap "sukses" untuk receipt yang statusnya `reverted`. Sekarang status receipt dibaca dan pesannya ditampilkan.
3. Pesan "No quote" muncul saat data masih loading, bukan saat benar-benar gagal. Sekarang berdasar `status === "failure"`.

Invariant (`contracts/test/Invariants.t.sol`, harga dibekukan, mgmt fee off, executor 5 bps, 128.000 call/invariant):
- `navNeverFalls` — NAV per token tidak pernah turun. Ini bentuk kebocoran nilai kalau gagal.
- `navDoesNotInflate` — juga tidak boleh melar (share gratis).
- `supplyMatchesBasket`, `noUsdgStranded`, `capsHold`, plus `afterInvariant` yang memastikan runnya tidak lolos secara vakum.
- Catatan: NAV *naik* sedikit demi sedikit (~3e-8) dan itu benar — `previewMint` membulatkan basket yang harus disetor minter ke atas, sisanya jadi milik holder lama.

Yang **tidak** dicakup: ekonomi oracle, keamanan swap venue asli, key management/multisig, dan review pihak ketiga. Jangan naik mainnet tanpa audit.

## Catatan teknis
- **EIP-170**: setelah `mintWithUSDG` + solver masuk, `IndexFactory` (yang menyimpan initcode `IndexVault`) tembus batas 24 KB dan **tidak bisa di-deploy**. Creation code dipindah ke `VaultDeployer.sol`; factory kini 2.5 KB, deployer 23.7 KB, vault 15.7 KB. `via_ir` dinyalakan. Ada test regresi `BytecodeSizeTest` supaya ini tidak terulang diam-diam.
- `MockOracle` sekarang juga memberi harga USDG (1e18) karena executor mengutip lawan USDG; keeper ikut me-refresh feed itu.

## Cara jalankan lokal
```bash
npm run chain && npm run deploy:local && npm run abi:sync
npm run dev            # http://localhost:3000  ·  /app
npm run contracts:test
npm run keeper                    # heartbeat oracle tiap 30 dtk
npm run keeper -- --drift 0.5     # + harga bergerak ±0.5% tiap tick
npm run keeper:rebalance          # + solve & eksekusi rebalance saat bobot melenceng
npm run contracts:sizes           # cek batas EIP-170
npm run test:e2e                  # 10 test browser: wallet flow + halaman docs/whitepaper/blog
```

## Cara deploy ke chain sungguhan
```bash
# 1. isi contracts/script/config/ProductionConfig.sol (USDG, oracle, swap venue,
#    multisig owner, fee recipient, keeper, + alamat token asli tiap basket)
# 2. preflight, tanpa broadcast — revert kalau ada yang belum siap
RPC_URL=https://... npm run deploy:check
# 3. deploy + tulis contracts/deployments/production.json + sync ABI
RPC_URL=https://... PRIVATE_KEY=0x... npm run deploy:production
# 4. arahkan frontend (lihat .env.example)
#    NEXT_PUBLIC_CHAIN=target NEXT_PUBLIC_CHAIN_ID=... NEXT_PUBLIC_RPC_URL=... DEPLOYMENT=production
npm run build
```

## Konten
`content/whitepaper.md`, `content/docs/*` (6 halaman), `content/blog/*` (2 post), `docs/PRODUCT.md`, thread X 15 post, bio: *"One token. The whole theme."*
