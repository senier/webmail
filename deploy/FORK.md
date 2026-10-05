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
git checkout feature/hide-unsubscribed-mailboxes
git merge upstream/main        # conflicts are most likely in sidebar.tsx / email-store.ts
npm ci && npm run typecheck && npx vitest run lib/__tests__/mailbox-subscription.test.ts lib/__tests__/move-targets.test.ts
git push
```

The push triggers `fork-image.yml`, which publishes `ghcr.io/senier/webmail:latest`.
(`lib/__tests__/health-route.test.ts` fails on upstream main too.)

## Running it with Podman Quadlet

Make the package public (GitHub → Packages → webmail → Package settings), or
`podman login ghcr.io` with a read-only PAT on the host.

`/etc/containers/systemd/webmail.container` (rootless: `~/.config/containers/systemd/`):

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

Put a TLS reverse proxy in front of port 3000. The container runs as uid 1001;
the named volumes handle ownership for you.
