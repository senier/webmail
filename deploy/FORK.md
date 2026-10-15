# Fork maintenance and self-hosting

This fork is upstream (`bulwarkmail/webmail`) plus one feature: folders you
unsubscribe from (JMAP `isSubscribed: false`) are hidden from the sidebar and
the Move-to menu, and can be toggled in Settings → Folders.

## What the patch touches

| File | Purpose |
|---|---|
| `lib/mailbox-subscription.ts` (new) | `withoutHiddenMailboxes()`, the single place that decides what is hidden |
| `components/layout/sidebar.tsx` | two call sites of the helper |
| `lib/move-targets.ts` | one call site of the helper |
| `stores/email-store.ts`, `lib/jmap/client*.ts`, `lib/demo/demo-client.ts` | `setMailboxSubscription` + `isSubscribed` in `updateMailbox` |
| `components/settings/folder-settings.tsx` | eye toggle |
| `locales/en/common.json` | 3 strings (English only, other locales fall back) |
| `lib/__tests__/mailbox-subscription.test.ts` (new), `translations.test.ts` | tests; en-only key exemption |
| `.github/workflows/fork-image.yml`, `deploy/` | image build and docs |

Only own, role-less folders are hidden; system folders and shared accounts'
folders are never hidden.

## Updating from upstream

```sh
git remote add upstream https://github.com/bulwarkmail/webmail.git   # once
git fetch upstream
git checkout main
git merge upstream/main        # conflicts are most likely in sidebar.tsx / email-store.ts
npm ci && npm run typecheck && npx vitest run lib/__tests__/mailbox-subscription.test.ts lib/__tests__/move-targets.test.ts
git push
```

The push triggers `fork-image.yml`, which publishes both images.
(`lib/__tests__/health-route.test.ts` fails on upstream main too.)

## Which edition?

Both are built from this branch, so both carry the patch. This is a client-side
change; it is not affected by the edition.

**Lite** (`ghcr.io/senier/webmail-lite`) is the same client as static files
behind nginx: no Node.js, no volumes, no state on the server. The browser talks
to your JMAP server directly, so the server must allow CORS (Stalwart:
`[http] permissive-cors = true`, or a proxy rule). Not in Lite: admin console,
plugins, settings sync across devices, OAuth/SSO login, app-password/2FA setup,
ICS URL subscriptions, WOPI editing, web push, device pairing.

**Full** (`ghcr.io/senier/webmail`) adds all of that and needs a Node server and
four data volumes.

Use Lite unless you need something from the "not in Lite" list. I built Lite
from this branch and it compiles; I haven't run either image against a server.

## Running it with Podman Quadlet

Make the packages public (GitHub → Packages → Package settings), or
`podman login ghcr.io` with a read-only PAT on the host.

### Lite (recommended)

Optionally set a repository variable `JMAP_SERVER_URL` (Settings → Variables)
before the build to bake in your server; otherwise mount a `config.json`.

`/etc/containers/systemd/webmail.container` (rootless: `~/.config/containers/systemd/`):

```ini
[Unit]
Description=Webmail (Lite)
After=network-online.target
Wants=network-online.target

[Container]
Image=ghcr.io/senier/webmail-lite:latest
AutoUpdate=registry
PublishPort=127.0.0.1:8080:8080
Environment=LITE_CSP_CONNECT_SRC=https://mail.example.com
# Only if JMAP_SERVER_URL was not baked in:
# Volume=/etc/webmail/config.json:/usr/share/nginx/html/config.json:ro,Z

[Service]
Restart=always

[Install]
WantedBy=multi-user.target
```

`config.json` minimum: `{"appName": "Webmail", "jmapServerUrl": "https://mail.example.com"}`.

### Full edition

`/etc/containers/systemd/webmail.container`:

```ini
[Unit]
Description=Webmail
After=network-online.target
Wants=network-online.target

[Container]
Image=ghcr.io/senier/webmail:latest
AutoUpdate=registry
PublishPort=127.0.0.1:3000:3000
EnvironmentFile=/etc/webmail/env
Volume=webmail-settings.volume:/app/data/settings
Volume=webmail-admin.volume:/app/data/admin
Volume=webmail-admin-state.volume:/app/data/admin-state
Volume=webmail-telemetry.volume:/app/data/telemetry
HealthCmd=wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/api/health
HealthInterval=30s

[Service]
Restart=always

[Install]
WantedBy=multi-user.target
```

Plus four one-line volume units, `webmail-settings.volume`, `webmail-admin.volume`,
`webmail-admin-state.volume`, `webmail-telemetry.volume`, each containing:

```ini
[Volume]
```

`/etc/webmail/env` (see `.env.example` for all options):

```
JMAP_SERVER_URL=https://mail.example.com
```

Then:

```sh
systemctl daemon-reload && systemctl start webmail
systemctl enable --now podman-auto-update.timer   # picks up new :latest builds
```

Put a TLS reverse proxy in front of the published port (8080 for Lite, 3000 for Full). The container runs as uid 1001;
the named volumes handle ownership for you.
