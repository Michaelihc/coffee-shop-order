# Trenquil Live Testing

Use this flow when you want to test the app in the Trenquil Teams organization instead of the currently connected WCC tenant.

## Why this environment exists

- `local` is for browser-based local debugging.
- `dev` is the default cloud environment.
- `trenquil` is a separate live-test environment so the Teams app ID, Azure resources, and deployment state stay isolated from WCC.
- `trenquil.manual` is the fallback for live testing through a public HTTPS tunnel when no Azure subscription is available.

## Commands

Switch Microsoft 365 account:

```powershell
teamsapp auth logout m365
teamsapp auth login m365
```

Switch Azure account if needed:

```powershell
teamsapp auth logout azure
teamsapp auth login azure
```

Provision and deploy the Trenquil environment:

```powershell
npm run teams:provision:trenquil
npm run teams:deploy:trenquil
npm run teams:package:trenquil
```

Optional org publish:

```powershell
npm run teams:publish:trenquil
```

## No Azure Subscription Fallback

The current Trenquil Azure login has no subscriptions, so the commands above will fail with `NoSubscriptionFound` until a subscription is attached to the account.

Use the manual sideload path instead:

1. Start the app locally from the repo root:

```powershell
npm start
```

2. Expose the local app on port `3333` through a public HTTPS tunnel. For example, with ngrok:

```powershell
ngrok http 3333
```

3. Copy the public HTTPS host into `env/.env.trenquil.manual`:

```text
TAB_ENDPOINT=https://your-public-host
TAB_DOMAIN=your-public-host-without-https
```

4. Validate and package the Teams app:

```powershell
npm run teams:validate:trenquil:manual
npm run teams:package:trenquil:manual
```

5. Upload `appPackage/build/appPackage.trenquil-manual.zip` into Teams in the Trenquil org.

## Expected output

- `env/.env.trenquil` receives the Trenquil app IDs and endpoint values when Azure-backed provisioning succeeds.
- `appPackage/build/appPackage.trenquil.zip` is the Azure-backed package.
- `appPackage/build/appPackage.trenquil-manual.zip` is the tunnel-backed package for live testing without Azure.

## Notes

- This machine is now signed in to the Trenquil Microsoft 365 tenant.
- If Trenquil blocks custom app upload, you'll need a Teams admin to allow custom uploads or approve the published app package.
