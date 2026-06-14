# CLAUDE.md

## TODO

- [ ] **Zmienne środowiskowe Vercel (WooCommerce billing)** — dodać:
  - `WOOCOMMERCE_WEBHOOK_SECRET` (musi być identyczny jak sekret webhooka w WooCommerce)
  - `BILLING_LINK_SECRET` (losowy sekret, np. `openssl rand -hex 32`)
  - `NEXT_PUBLIC_HACCPRO_PRICING_URL=https://haccpro.pl/cennik`

  Po dodaniu: przetestować webhook end-to-end (testowy webhook z panelu WooCommerce -> `/api/webhooks/woocommerce`).
