# Portable Clients Validation

This repo now includes guest-first portable clients for:

- `apps/mobile`: Expo React Native app
- `apps/wechat`: Taro React WeChat Mini Program app
- `packages/portable`: shared cart and API contract package used by both

## Automated validation

Run the existing backend/web checks first:

```powershell
npm run verify
```

Run the portable validation bundle:

```powershell
npm run validate:portable
```

That command does four things:

1. Builds `packages/portable`
2. Re-syncs the local `file:` dependency into `apps/mobile` and `apps/wechat`
3. Typechecks the shared package
4. Typechecks both portable apps

## Mobile validation

Typecheck only:

```powershell
npm --prefix apps/mobile run validate
```

Manual flow:

1. Set `apps/mobile/app.json` `expo.extra.apiBaseUrl` to the backend URL.
2. Start the backend:
   `npm start`
3. Start Expo:
   `npm --prefix apps/mobile run start`
4. In the Expo client, verify:
   `Menu -> add items -> Cart -> choose pickup window -> guest cash checkout`
5. Verify WeChat payment modes:
   `wechat-pay + qr` shows a QR panel
   `wechat-pay + direct` opens the returned H5 URL when the backend returns one
6. Confirm the order appears in the mobile `Orders` tab and pending WeChat payments settle after notify/status polling.

## WeChat Mini Program validation

Typecheck only:

```powershell
npm --prefix apps/wechat run validate
```

Manual flow:

1. Set `TARO_APP_API_BASE_URL` for the app runtime if the backend is not local/default.
2. Start the backend:
   `npm start`
3. Build the Mini Program on a supported Taro build host:
   `npm --prefix apps/wechat run build:weapp`
4. Open the generated app in WeChat DevTools with `apps/wechat/project.config.json`.
5. Verify:
   `Menu -> add items -> Cart -> guest cash checkout`
   `wechat-pay + qr` renders a QR image
   `wechat-pay + direct` calls `requestPayment` when the backend returns JSAPI parameters
   `Orders` reflects pending/paid transitions after backend notify/status updates

## Current platform caveat

On this Windows ARM64 machine, `taro build --type weapp` is blocked by an upstream missing native package:

- `@tarojs/binding-win32-arm64-msvc`

Typechecking works locally, but the full Mini Program build currently needs either:

- a Windows x64 environment, or
- WSL / another supported build host, or
- an upstream Taro release that ships the ARM64 Windows binding

## Payment validation

For real WeChat Pay validation, set the backend merchant env vars already used by the server:

- `WECHAT_PAY_APP_ID`
- `WECHAT_PAY_MCH_ID`
- `WECHAT_PAY_API_V3_KEY`
- `WECHAT_PAY_PRIVATE_KEY`
- `WECHAT_PAY_CERT_SERIAL_NO`
- `WECHAT_PAY_NOTIFY_URL`
- `WECHAT_PAY_H5_RETURN_URL`

Without those values, the backend returns stubbed QR/H5 behavior so the portable clients remain testable.

## Guest phone verification

Guest users can browse without signing in, but must verify a phone number before placing an order.

Web verification uses Cloudflare Turnstile plus real SMS delivery. Configure:

- `CLOUDFLARE_TURNSTILE_SITE_KEY`
- `CLOUDFLARE_TURNSTILE_SECRET_KEY`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- either `TWILIO_FROM_NUMBER` or `TWILIO_MESSAGING_SERVICE_SID`
- `GUEST_AUTH_SECRET`

WeChat Mini Program verification uses native phone authorization. Configure:

- `WECHAT_MINI_PROGRAM_APP_ID`
- `WECHAT_MINI_PROGRAM_APP_SECRET`

The backend stores verified guests in `guest_users` and session tokens in `guest_sessions`; clients send `X-Guest-Session` on guest order requests.
