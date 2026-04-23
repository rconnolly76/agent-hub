---
name: paywall-gate
description: Enforce paywall / subscription gates on the server and in the database — not just the UI. TRIGGER when the change touches entitlement columns (`plan`, `tier`, `has_access`, `is_pro`, `subscription_status`, `credits`, `trial_ends_at`), Stripe / Paddle / LemonSqueezy / RevenueCat checkout or webhooks, checkout success pages, premium-feature API routes / RPCs / server actions, RLS policies on user-owned tables, or any `user.plan === "pro"` style check. Also trigger when the user asks for "gating", "paywall", "subscription", "upgrade flow", "entitlement", "billing". SKIP for purely cosmetic UI that is already behind a verified server gate.
---

# paywall-gate

AI-generated SaaS apps ship the same revenue leak over and over: the happy path works, but the adversarial path leaves the paywall bypassable. Treat every billing surface as adversarial. The paywall must be a **gate**, not a suggestion.

There are exactly three failure modes. Fix all three, every time.

## 1. User-writable entitlement columns

Never store `plan`, `tier`, `has_access`, `is_pro`, `subscription_status`, `credits`, `trial_ends_at`, `seats`, `role` in a row the user can `UPDATE`. A `user_id = auth.uid()` RLS policy is **not** enough — it grants write access to the whole row, including the entitlement column.

Pick one; never zero:

- **Separate server-owned table.** `billing.entitlements (user_id pk, plan, status, current_period_end, stripe_customer_id, stripe_subscription_id)`. RLS: `SELECT` allowed for `authenticated` where `user_id = auth.uid()`; **no** `INSERT`/`UPDATE`/`DELETE` policies for `authenticated` or `anon` — only the service role writes. This is the default. Do this unless there is a concrete reason not to.
- **Column-level `WITH CHECK`.** If the field must live on a user-owned row, add a policy that blocks changes to that column:
  ```sql
  create policy profiles_update_self on profiles
    for update to authenticated
    using (id = auth.uid())
    with check (
      id = auth.uid()
      and plan is not distinct from (select plan from profiles where id = auth.uid())
      and subscription_status is not distinct from (select subscription_status from profiles where id = auth.uid())
    );
  ```
  A trigger that raises on any change to the entitlement column from a non-service role is equivalent.
- **Generated / view-backed column** derived from the server-owned billing table. The user-facing row never stores the truth.

Before finishing, answer out loud: *"Can an authenticated user `UPDATE` this column with their own JWT via PostgREST / Supabase / Prisma / raw SQL from a compromised client?"* If the answer is "yes" or "I don't know," the task is not done. Verify with a negative test — see §4.

## 2. Client-only plan checks

`{user.plan === "pro" && <PremiumFeature/>}` and `useEffect(() => { if (!pro) router.push("/upgrade") }, [])` are decoration. They do not stop a `curl` / `fetch` / Postman call to the underlying API.

Rules:

- **Every premium route, handler, server action, RPC, and background job** reads the plan from the server-owned entitlement source (§1) at request time and rejects with `403` if the user is not entitled.
- Do **not** read the plan from a JWT custom claim, a cookie, a request header, or the request body. Those are client-controlled. Read from the database on every request, or from a short-TTL server-side cache keyed by user id that is invalidated by the webhook (§3).
- **Quota counters** (requests/day, seats, tokens, AI credits) are decremented on the server **in the same transaction** as the gated work. A separate "check then do" is racy and bypassable.
- **Feature flags are not entitlements.** A feature flag controls rollout; an entitlement controls access. Do not conflate them.

## 3. Success-URL access grants

`/checkout/success?session_id=…` flipping the user to `plan=pro` is bypassable by visiting the URL directly or replaying it. Entitlement changes come **only** from a signed webhook.

- **Stripe:** verify with `stripe.webhooks.constructEvent(rawBody, signature, STRIPE_WEBHOOK_SECRET)`. The request body must be the raw bytes — do **not** let a JSON body parser run before verification. Reject on signature failure.
- Handle the full lifecycle, not just the upgrade: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`. Downgrade / revoke on cancel and on payment failure past the grace window.
- **Idempotency:** persist `stripe_event_id` as a unique key and ignore duplicates. Webhooks are retried; non-idempotent handlers double-apply credits.
- **The success page is cosmetic.** It polls the server for entitlement state or shows "Activating…" until the webhook has landed. It does not write to the entitlement source. It does not trust `session_id` from the query string as proof of payment.
- Mirror this for every provider: Paddle, LemonSqueezy, RevenueCat, Apple / Google IAP. Provider → signed webhook → server writes entitlement. The client never writes.

## 4. Definition of done — checklist

Run through every box. Any "no" is a bug; do not claim the task is complete.

- [ ] Entitlement source is a table / column the authenticated user **cannot** write (verified by reading the RLS policies, not by assuming).
- [ ] There is a server-side guard on **every** premium route, server action, RPC, and background job — not just on the page that renders the button.
- [ ] The guard reads plan state from the server-owned source at request time, not from a client-controlled claim.
- [ ] Quota counters are decremented server-side in the same transaction as the gated work.
- [ ] The checkout success page performs **no** entitlement writes.
- [ ] Webhook handler verifies the signature against the raw body and persists the event id for idempotency.
- [ ] Subscription cancel / payment failure paths downgrade the user (not just upgrades handled).
- [ ] A negative test exists and passes: a free-tier user calling the premium endpoint directly (bypassing the UI) gets `403`. Example in TS:
  ```ts
  it("rejects free users hitting the premium endpoint directly", async () => {
    const res = await fetch("/api/premium-thing", {
      method: "POST",
      headers: { authorization: `Bearer ${freeUserJwt}` },
      body: JSON.stringify({ /* … */ }),
    });
    expect(res.status).toBe(403);
  });
  ```
- [ ] A negative test exists and passes: an authenticated free user attempting to `UPDATE` their own `plan` column via the database client is rejected.

## When extending an existing app

Each new premium feature is its own gate. Do **not** assume earlier features' gating covers a new route. Repeat §2 and §4 for every added surface.
