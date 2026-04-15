# Teams Notifications Runbook

This app uses Microsoft Teams activity feed notifications for both staff and students.

Current behavior:
- Staff notifications are sent for new orders from the staff flow.
- Student notifications are sent server-side when an order is created or when staff moves it to `preparing` or `ready`.
- The in-app notification center still shows local notifications, but student Teams delivery is no longer dependent on the student keeping `My Orders` open.
- Server-driven student notifications use the student's last known app locale (`en`, `zh`, or `ko`).

## Where The Logic Lives

- Backend send helper: `src/services/teams-notification-service.ts`
- Notification API: `src/routes/notifications.ts`
- Student order-created notification: `src/routes/orders.ts`
- Student status-change notifications: `src/routes/admin/queue.ts`
- Client notification center: `src/client/hooks/useNotifications.tsx`
- Locale persistence: `src/services/user-locale-service.ts`
- Server-side localized copy: `src/services/notification-content-service.ts`
- Teams manifest: `appPackage/manifest.json`

## Required Configuration

These values must exist for the target environment:

```env
TEAMS_APP_ID=<teams app id>
TEAMS_APP_TENANT_ID=<entra tenant id>
AAD_APP_CLIENT_ID=<entra app registration client id>
AAD_APP_CLIENT_SECRET=<entra app registration client secret value>
```

Important:
- `AAD_APP_CLIENT_SECRET` must be the secret `Value`, not the secret ID.
- Do not commit secrets into `env/.env.trenquil`.
- Put local-only secrets in `env/.env.trenquil.user`.

## How Runtime Env Loading Works

The backend now loads runtime env files at startup from:

1. `env/.env.dev`
2. `env/.env.<env>`
3. `env/.env.<env>.user`
4. `.localConfigs`

That loader lives in `src/config/load-runtime-env.ts`.

This matters because local Teams Toolkit runs write some values to `.localConfigs`, while notification credentials often live in `env/.env.<env>` or `.user`.

## Localization

In-app notification text comes from the client locale JSON files.

Server-driven student Teams notifications are localized by:
1. Sending `X-Teams-User-Locale` from the client on API requests
2. Persisting that locale server-side in the `settings` table
3. Using that stored locale when the backend sends student notifications later

Supported locales:
- `en`
- `zh`
- `ko`

Teams activity titles are intentionally title-only now:
- `Order Confirmed`
- `Order Being Prepared`
- `Order Ready`

The manifest template uses `{title}` instead of `{actor} {title}` so the activity feed does not show a redundant `Coffee Shop ...` prefix.

## Local Development

Local Teams Toolkit launch uses `teamsapp.local.yml`.

It now writes these notification settings into `.localConfigs`:
- `TEAMS_APP_ID`
- `TEAMS_APP_TENANT_ID`
- `AAD_APP_CLIENT_ID`
- `AAD_APP_CLIENT_SECRET`

If local notification sends fail, restart the backend after changing env files so the loader picks them up.

## Azure Deployment

For the Trenquil environment, use:

```powershell
npm run teams:deploy:trenquil
```

Default rule:
- Use `deploy` for normal code changes.
- Use `provision` only when app settings or the Teams manifest changed.
- Use `publish` only when you explicitly need the tenant store/catalog entry updated.

What each step does:
- `deploy`: deploys the app code to Azure App Service
- `provision`: updates Azure resources and updates the Teams app definition
- `publish`: pushes the package into the tenant catalog so users can install the updated app from Teams

Azure App Service settings are wired through `infra/azure.bicep` and `infra/azure.parameters.json`.

## Verify The Backend Is Ready

Use these live endpoints:

- `GET /api/notifications/debug`
- `GET /api/notifications/test-auth`
- `GET /api/notifications/test-installations/:userId`
- `POST /api/notifications/send`

Examples:

- `https://<your-app>/api/notifications/debug`
- `https://<your-app>/api/notifications/test-installations/<aad-user-id>`

Expected `debug` output:
- `TEAMS_APP_ID: SET`
- `TEAMS_APP_TENANT_ID: SET`
- `AAD_APP_CLIENT_ID: SET`
- `AAD_APP_CLIENT_SECRET: SET`
- `EFFECTIVE_TAB_ENDPOINT: https://<your-app-host>`

## Common Failure Modes

### `TEAMS_APP_ID not set`

Cause:
- Backend process did not have Teams env loaded.

Fix:
- Confirm `src/config/load-runtime-env.ts` is present and imported by `src/app.ts`.
- Confirm env values exist in `env/.env.<env>` or `.localConfigs`.
- Restart locally, or redeploy Azure.

### Notifications open the menu instead of `My Orders`

Cause:
- The activity notification was sent without a usable deep link, so Teams opened the app's default tab.
- This usually happens when the backend cannot resolve the tab host and falls back to the installed-app topic link.

Fix:
- Open `GET /api/notifications/debug`.
- Confirm `EFFECTIVE_TAB_ENDPOINT` is populated with your Azure app URL.
- If `TAB_ENDPOINT` is missing in Azure, the backend now falls back to `WEBSITE_HOSTNAME`.
- Re-send a test notification after redeploying the backend.

### Azure site returns `500` on every route after deploy

Cause:
- App Service tried to read local SSL certificate paths from `.localConfigs`.

Fix:
- `.localConfigs` must not be deployed to Azure.
- `.webappignore` excludes `.localConfigs`.
- `src/app.ts` now treats SSL cert files as optional and only reads them if the files exist.

### `Specified activity with type 'taskCreated' could not be found in the app manifest.`

Cause:
- The backend sent `activityType: "taskCreated"` but the Teams manifest did not declare it.

Fix:
- Add `activities.activityTypes` to `appPackage/manifest.json`.
- Re-run `provision`.
- Re-publish the app package.

### `Incorrect template parameter arity`

Cause:
- Manifest template parameters and backend payload parameters do not match.

Fix:
- Keep `src/services/teams-notification-service.ts` aligned with `appPackage/manifest.json`.
- Current manifest uses `{title}` only.
- Current backend sends only the `title` template parameter.

### `App not installed for user`

Cause:
- The Teams app is not installed for that user in personal scope.
- Or the user still has an older Coffee Shop app ID installed.

Fix:
- Call `GET /api/notifications/test-installations/:userId`.
- Compare installed `externalId` values to `TEAMS_APP_ID`.
- If the user still has an older Coffee Shop app installed, uninstall it and install the current one.

This exact mismatch happened in Trenquil:
- Current app ID: `2d016fc4-be0c-4410-a84d-202ae99db778`
- Older installed Coffee Shop ID seen on a student account: `5644f48a-af95-47d7-85fa-f9539994a0a4`

### Teams store still shows the old app version

Cause:
- The updated package was provisioned but not yet published, approved, or propagated in the tenant store.

Fix:
1. Run `npm run teams:publish:trenquil` only when a store/catalog update is actually needed.
2. In Teams Admin Center, approve/allow the app if needed.
3. Wait for propagation.
4. Restart Teams.
5. If needed, uninstall the old Coffee Shop app and reinstall after the store shows the new version.

Note:
- `provision` updates the app definition.
- `publish` is what updates the org store entry.

## How To Find The Client Secret

In Azure Portal:

1. Go to `Microsoft Entra ID`
2. Open `App registrations`
3. Find the app whose client ID matches `AAD_APP_CLIENT_ID`
4. Open `Certificates & secrets`
5. Create or use a client secret
6. Copy the secret `Value`

Store it in:
- `env/.env.trenquil.user` for local tooling
- Azure App Service `Environment variables` as `AAD_APP_CLIENT_SECRET`

## Teams Admin Center Checks

If users see the wrong app version in the Teams store:

1. Open Teams Admin Center
2. Go to `Manage apps`
3. Search `Coffee Shop`
4. Confirm the current app ID matches `TEAMS_APP_ID`
5. Confirm the app version is the latest manifest version
6. Confirm the app is allowed for the org
7. Remove confusion from older Coffee Shop entries if multiple exist

## Practical Test Flow

1. Open `GET /api/notifications/debug` and confirm all four settings are `SET`.
2. Open `GET /api/notifications/test-auth` and confirm Graph auth works.
3. Open `GET /api/notifications/test-installations/<userId>` and confirm the current `TEAMS_APP_ID` is installed for that user.
4. Send a direct test with `POST /api/notifications/send`.
5. Place a student order and move it through `confirmed -> preparing -> ready`.
6. Confirm the student receives Teams notifications even when not sitting on `My Orders`.

## References

- [Teams activity feed notifications](https://learn.microsoft.com/en-us/microsoftteams/platform/tabs/send-activity-feed-notification)
- [Graph sendActivityNotification](https://learn.microsoft.com/en-us/graph/api/userteamwork-sendactivitynotification)
