# Coffee Shop Order Teams App

This repo now contains a working Microsoft Teams tab app scaffold generated with the current Microsoft 365 Agents Toolkit CLI. It gives us a local Express server, Teams app manifest, local debug config, and a starter tab UI for a coffee ordering experience.

## What was set up

- `teamsapp new -c tab-non-sso -l typescript -n coffeeshoporder`
- `npm install` for the generated project dependencies
- Microsoft 365 Agents Toolkit VS Code extension already present on this machine

## Prerequisites confirmed

- Node.js `v22.16.0`
- npm `11.4.1`
- Microsoft 365 account signed in through Teams Toolkit CLI
- Azure account signed in through Teams Toolkit CLI

## Known blockers from toolkit doctor

- Custom app upload is not enabled for the current Microsoft 365 account, so sideloading to Teams is blocked until a tenant admin enables it.
- Azure Functions Core Tools are not installed, but this basic tab app does not require them.
- A local development certificate is not present yet; the toolkit usually handles local debug setup, but if HTTPS prompts fail we should generate and trust one next.

## Run the app

1. Open this folder in VS Code.
2. Use the Microsoft 365 Agents Toolkit panel.
3. Start `Debug in Teams (Edge)` or `Debug in Teams (Chrome)` with `F5`.
4. When Teams opens, choose **Add** to install the app.

## Test In Trenquil

This repo now includes a dedicated live-test environment at `env/.env.trenquil`.

1. Sign out of the current WCC Microsoft 365 session in Teams Toolkit CLI:
   `teamsapp auth logout m365`
2. Sign in with your Trenquil Microsoft 365 account:
   `teamsapp auth login m365`
3. If Trenquil uses a different Azure tenant or subscription, switch that too:
   `teamsapp auth logout azure`
   `teamsapp auth login azure`
4. Add any local-only secret values to `env/.env.trenquil.user`.
   Required for notifications:
   `AAD_APP_CLIENT_SECRET=<secret value>`
5. Provision the Trenquil environment:
   `npm run teams:provision:trenquil`
6. Deploy the app to Azure for that environment:
   `npm run teams:deploy:trenquil`
7. Publish the app package to the tenant catalog only when users need a new Teams store/catalog version:
   `npm run teams:publish:trenquil`
8. Build the upload package:
   `npm run teams:package:trenquil`
9. Upload `appPackage/build/appPackage.trenquil.zip` into Teams in the Trenquil org if you need a direct package install.

The Trenquil Azure subscription and App Service deployment path are working in this workspace.

## Notifications

Teams activity feed notifications are now wired for:
- Staff: new orders
- Students: order confirmed, preparing, ready

Use the notification runbook here for setup and troubleshooting:
- `docs/teams-notifications-setup.md`

## Operator Report

For a non-technical summary of the app's purpose, workflows, and admin-facing value:
- `docs/coffee-shop-admin-report.md`

## Test In Trenquil Without Azure

Use `env/.env.trenquil.manual` when you want to test in the live Trenquil Teams org through a public HTTPS tunnel instead of Azure hosting.

1. Open a terminal in this repo:
   `cd C:\Users\fsp9f\source\repos\coffee-shop-order`
2. Start the app locally:
   `npm start`
3. Expose port `3333` over public HTTPS with a tunnel such as ngrok:
   `ngrok http 3333`
4. Copy the HTTPS forwarding URL and update these two values in `env/.env.trenquil.manual`:
   `TAB_ENDPOINT=https://your-public-host`
   `TAB_DOMAIN=your-public-host-without-https`
5. Build and validate the Trenquil manual package:
   `npm run teams:validate:trenquil:manual`
   `npm run teams:package:trenquil:manual`
6. Upload `appPackage/build/appPackage.trenquil-manual.zip` into Teams in the Trenquil org.

This path avoids Azure completely and is the fastest route to live-org testing with the account state you have right now.

## Key files

- `appPackage/manifest.json`: Teams app manifest and metadata.
- `env/.env.trenquil`: live Teams testing environment for Trenquil.
- `env/.env.trenquil.manual`: live Teams testing through a public HTTPS tunnel without Azure.
- `teamsapp.yml`: main Agents Toolkit workflow.
- `teamsapp.local.yml`: local debug workflow.
- `src/app.ts`: Express server for the tab app.
- `src/views/hello.html`: starter tab content.
- `src/static/styles/custom.css`: starter UI styling.
- `src/static/scripts/teamsapp.ts`: Teams host context detection.

## Official references

- Microsoft Learn: https://learn.microsoft.com/en-us/microsoftteams/platform/toolkit/create-new-project
- Basic tab tutorial: https://learn.microsoft.com/en-au/microsoftteams/platform/get-started/build-basic-tab-app
- VS Code extension: https://marketplace.visualstudio.com/items?itemName=TeamsDevApp.ms-teams-vscode-extension
