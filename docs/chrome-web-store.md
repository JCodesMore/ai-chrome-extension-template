# Publishing to the Chrome Web Store — a first-time guide

**Audience: the human.** The AI agent can build the extension, generate every image, and draft
all the listing text, but the Chrome Web Store requires a registered developer account, a
one-time payment, and a person to click through the dashboard and accept the terms. Those steps
are yours; everything else the agent can hand you ready to paste.

This walks you through publishing your first version. It's less work than it looks — most of it
is one-time setup.

## One-time: register a developer account

1. Go to the **Chrome Web Store Developer Dashboard**:
   `https://chrome.google.com/webstore/devconsole`.
2. Sign in with the Google account you want to own the extension. (Use an account you'll keep —
   ownership is tied to it.)
3. Accept the developer agreement and pay the **one-time $5 registration fee**. This unlocks
   publishing for the life of the account, not per-extension.

## Before you submit — what you'll need

The agent can prepare all of these; this is your checklist to confirm they exist.

| Item                      | Required?               | Spec                                                                      |
| ------------------------- | ----------------------- | ------------------------------------------------------------------------- |
| Extension package         | Yes                     | `release/<slug>-vX.Y.Z.zip` from `npm run release` (or `npm run package`) |
| Store icon                | Yes                     | 128×128 PNG                                                               |
| Screenshot(s)             | Yes (≥1)                | 1280×800 or 640×400 PNG; more is better                                   |
| Promo tile                | Optional (recommended)  | 440×280 PNG — used in store placements                                    |
| Short description         | Yes                     | up to 132 characters                                                      |
| Detailed description      | Yes                     | what it does, plainly                                                     |
| Category & language       | Yes                     | pick the closest category                                                 |
| Single-purpose statement  | Yes                     | one sentence: the extension's single purpose                              |
| Permission justifications | Yes                     | one line per permission your manifest requests                            |
| Privacy policy URL        | If you handle user data | a public URL (a page in your repo works)                                  |
| Data-use disclosures      | Yes                     | the dashboard's privacy form — declare what you collect (often "nothing") |

If your extension handles everything locally and collects nothing, you still complete the
privacy form — you just declare that you don't collect or transmit user data, which speeds
review.

## Upload & submit

1. In the dashboard, click **New item**.
2. **Upload** your `release/<slug>-vX.Y.Z.zip`. The store reads `manifest.json` from the zip
   root, so the version, name, and icons populate automatically.
3. Fill in the **Store listing** tab: descriptions, category, language, screenshots, and the
   promo tile.
4. Fill in the **Privacy practices** tab: the single-purpose statement, a justification for
   each requested permission, the data-use disclosures, and the privacy policy URL if you
   collect data. This is the tab most often left incomplete — the store won't let you submit
   until every requested permission has a justification.
5. Click **Submit for review**.

## Review times & what slows them down

Reviews are usually **under 24 hours to a few days**. Expect the longer end if your extension
requests **broad host permissions** (e.g. access to all sites) — those get more scrutiny.
Request the least access you need, and prefer `optional_host_permissions` (the template's
default) so users grant access on demand rather than up front.

## Common rejection reasons

- **Excessive permissions** — requesting more than the described purpose needs. Trim the
  manifest to what you actually use.
- **Missing/weak privacy disclosures** — an incomplete Privacy practices tab, or a missing
  permission justification.
- **Misleading listing** — screenshots or copy that don't match what the extension does.
- **Remote code** — loading and executing code fetched at runtime (remote scripts, `eval` of
  fetched strings) is disallowed. Bundle everything into the package.
- **Single-purpose violation** — the extension does several unrelated things. Keep it to one
  stated purpose.

## Updating a published extension

1. Bump the version and rebuild: `npm run release -- patch` (or `minor`/`major`) produces a new
   `release/<slug>-vX.Y.Z.zip`. The store requires the version to strictly increase.
2. In the dashboard, open the existing item → **Package** → upload the new zip.
3. Update any listing text or screenshots that changed, then **Submit for review** again.

Updates go through review just like the first submission, though they're often faster.

## A note on the split of labor

The agent produces the zip, the icons, the screenshots, the promo tile, the descriptions, the
single-purpose statement, the permission justifications, and a draft privacy policy — all of it
sitting in the repo ready to use. What it **can't** do is register the account, pay the fee, or
click the dashboard buttons on your behalf. When you're ready to publish, ask the agent to
assemble the assets and listing text, then walk this checklist.
