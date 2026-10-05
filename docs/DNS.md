# DNS — tinashhomecareservices.com

DNS is hosted on **Cloudflare** (account: Zaga Prime LLC). The domain is
registered at Hostinger; only its nameservers point to Cloudflare. Email stays
on **Hostinger email** (Free Business Email plan, separate from the old web
hosting), so every mail record below must stay exactly as is and **DNS only**
(grey cloud).

Snapshot of the Hostinger zone taken 2026-10-04, before the move:

| Name | Type | Value | Purpose |
| --- | --- | --- | --- |
| `@` | MX 5 | `mx1.hostinger.com` | Hostinger email |
| `@` | MX 10 | `mx2.hostinger.com` | Hostinger email |
| `@` | TXT | `v=spf1 include:_spf.mail.hostinger.com ~all` | SPF |
| `@` | TXT | `google-site-verification=z8kv6G0OUSDBQafJ-Gc1L0G900Y_AxwhcQQdnmh8Tus` | Google Search Console |
| `_dmarc` | TXT | `v=DMARC1; p=none;` | DMARC |
| `hostingermail-a._domainkey` | CNAME | `hostingermail-a.dkim.mail.hostinger.com` | Hostinger DKIM |
| `hostingermail-b._domainkey` | CNAME | `hostingermail-b.dkim.mail.hostinger.com` | Hostinger DKIM |
| `hostingermail-c._domainkey` | CNAME | `hostingermail-c.dkim.mail.hostinger.com` | Hostinger DKIM |
| `k2._domainkey` | CNAME | `dkim2.mcsv.net` | Mailchimp DKIM |
| `k3._domainkey` | CNAME | `dkim3.mcsv.net` | Mailchimp DKIM |
| `autodiscover` | CNAME | `autodiscover.mail.hostinger.com` | Mail client setup |
| `autoconfig` | CNAME | `autoconfig.mail.hostinger.com` | Mail client setup |
| `ftp` | A | `191.101.13.14` | Old hosting FTP (legacy) |

Website records (replaced at cutover):

| Name | Before (Hostinger) | After (Cloudflare) |
| --- | --- | --- |
| `@` | A/AAAA → Hostinger web hosting | Worker custom domain → `tinash-prod` |
| `www` | CNAME → Hostinger CDN | Worker custom domain → `tinash-prod` |
| `crm` | — | Worker custom domain → `tinash-prod` (team CRM; never linked publicly) |

Worker custom domains are declared in `wrangler.jsonc` (`routes`); Cloudflare
creates their DNS records and certificates. Do not add A/CNAME records for
them by hand.

Supabase Auth (Tinash-Prod) must allow `https://crm.tinashhomecareservices.com/auth/callback`
as a redirect URL, with Site URL `https://crm.tinashhomecareservices.com`.
