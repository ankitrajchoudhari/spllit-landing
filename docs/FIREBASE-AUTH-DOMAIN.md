# Getting the Firebase project id out of the OTP SMS

## The problem

A phone sign-in text currently arrives as:

```
123456 is your verification code for spllit-app-94194.firebaseapp.com
```

That trailing string is the Firebase project id, and showing it to a user is
bad for two reasons: it does not say "Spllit", so the message reads like a
phishing attempt from an unrelated service, and it leaks the project id.

## Why it cannot be fixed in the app

The SMS body is composed by Google, not by this codebase. The template is
`%LOGIN_CODE% is your verification code for %APP_NAME%`, and `%APP_NAME%` is
filled from the project's **auth domain** — the `authDomain` field of the web
config, which this app reads from `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`.

There is no client API for it. `signInWithPhoneNumber` takes a phone number and
a reCAPTCHA verifier and nothing else; the SMS template is not editable on the
Firebase console's SMS template screen either — the app name field there is
derived, not typed. So the only lever is `authDomain` itself.

## Why it is not a one-line change

Setting `authDomain` to `spllit.app` changes more than the SMS. Both Google
sign-in flows load the Firebase auth handler from that host:

```
https://<authDomain>/__/auth/handler
```

This site is served by Cloudflare Workers, which has nothing at `/__/auth/*`.
Flip the variable on its own and the SMS gets its name — and Google sign-in
starts failing for everybody, because the popup opens a 404.

## What is already in place

`next.config.mjs` has a rewrite that proxies `/__/auth/:path*` through to
`https://<projectId>.firebaseapp.com/__/auth/:path*`. It matches nothing today,
because while `authDomain` is still `…firebaseapp.com` no browser asks this
origin for that path. It is there so the handler exists *before* the switch.

It is built from `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, not from the auth domain,
so it keeps pointing at Firebase after `authDomain` becomes `spllit.app`.

## The switch, in order

Do not reorder these. Steps 1 and 2 must both be live before step 3, or
sign-in breaks in the window between them.

1. **Firebase Console → Authentication → Settings → Authorized domains.**
   Add `spllit.app`. Sign-in from an unlisted domain is rejected with
   `auth/unauthorized-domain`, which the app already reports in plain words.

2. **Deploy this branch and verify the proxy.** With the app live, check that
   the handler answers on our own domain before anything depends on it:

   ```
   curl -sI https://spllit.app/__/auth/handler | head -1
   ```

   Expect `200`. A `404` means the rewrite is not being applied by the Worker —
   external rewrites go through OpenNext's routing layer, so this needs to be
   confirmed on the deployed Worker and not only in `next dev`. **Stop here if
   it 404s**; step 3 would take Google sign-in down.

3. **Set `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=spllit.app`** and redeploy.

4. **Verify all three flows**, because this variable is on the critical path
   for every one of them:
   - Google sign-in via popup (desktop)
   - Google sign-in via redirect (mobile, or a browser that blocks popups)
   - Phone OTP — confirm the SMS now reads `… your verification code for
     spllit.app`

## Rollback

Set `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` back to
`spllit-app-94194.firebaseapp.com` and redeploy. The rewrite can stay; it goes
inert again on its own. Nothing is persisted, so no user state has to be
repaired — sessions are held client-side and survive the change either way.
