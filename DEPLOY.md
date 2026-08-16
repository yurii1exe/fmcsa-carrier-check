# Deploying

Two things are needed that are not in this repository: an FMCSA webKey, and a
Vercel account. Everything else is already configured — there is no build
setup, no `vercel.json`, and no other environment variable.

Budget about ten minutes, most of it waiting on the FMCSA form.

---

## 1. Get an FMCSA webKey

The key is free, issued instantly, and needs only a Login.gov account. There is
no FMCSA registration and no approval wait.

1. Open <https://mobile.fmcsa.dot.gov/QCDevsite/docs/getStarted>.
2. Click **Sign In**. This redirects to Login.gov — create an account there if
   you do not have one. (Background: <https://mobile.fmcsa.dot.gov/QCDevsite/logingovInfo>.)
3. Back on the FMCSA site, choose **My WebKeys** → **Get a new WebKey**.
4. Fill in the form: application name, whether the use is commercial /
   non-commercial / academic, a rough user count, a short description, and a
   **client secret**. That last field is not a password you need to keep — it
   is a unique word used to seed the key generator, and it only has to differ
   between WebKeys on the same account.
5. Click create. The WebKey appears on the next screen. Copy it.

Check it before going any further, substituting your key:

```bash
curl "https://mobile.fmcsa.dot.gov/qc/services/carriers/4581509?webKey=YOURKEY"
```

- A working key returns JSON with a `carrier` object inside `content`.
- A bad key returns **HTTP 404** with `{"content":"Webkey not found"}`.
- No key at all returns **HTTP 404** with `{"content":"Must provide Webkey"}`.

Those two 404s are not typos — FMCSA reports credential problems with the same
status code it uses for a missing carrier. This app distinguishes them by
reading the body, so a bad key produces "FMCSA rejected the API key" rather
than "no carrier with that number".

## 2. Run it locally first

```bash
npm install
cp .env.example .env.local     # then paste the key into FMCSA_WEB_KEY
npm run dev
```

Open <http://localhost:3000/?q=4581509>. You should get a carrier report rather
than an error panel.

This step is worth doing rather than skipping to the deploy: it is the first
time the success path runs against the live API, and it is much easier to debug
on your own machine than in a serverless log.

While you are there, read the report rather than just checking that it renders.
FMCSA's [API elements page](https://mobile.fmcsa.dot.gov/QCDevsite/docs/apiElements)
is out of step with what `/carriers/{dot}` actually returns, and it spells two
fields differently from this code (`allowToOperate` / `phyZip` there,
`allowedToOperate` / `phyZipcode` here). The evidence says the docs page is
stale, not the code — but a blank **operating status** or a missing **ZIP** on
an otherwise-populated report is the symptom if it is the other way round, and
it is much better to find that now than in front of a broker. See the Status
section of the [README](README.md#status-and-limits).

## 3. Deploy to Vercel

### With the CLI

```bash
npm i -g vercel
vercel login
vercel link          # answer the prompts to create or attach a project
```

Add the key. The command prompts for the value, so the key never enters your
shell history:

```bash
vercel env add FMCSA_WEB_KEY production
```

Vercel stores production variables as *sensitive* by default, which means the
value cannot be read back afterwards — from the dashboard or from
`vercel env ls`. That is the behaviour you want here; just keep your own copy.

If you also want preview deployments (pull requests, non-production branches)
to work, repeat for that environment:

```bash
vercel env add FMCSA_WEB_KEY preview
```

Then deploy:

```bash
vercel --prod
```

> The **first** deployment of a brand-new project is a production deployment
> whether or not you pass `--prod`. `--prod` matters for every deployment after
> that one.

### With the dashboard instead

1. <https://vercel.com/new> → import this Git repository.
2. Vercel detects Next.js on its own. Leave the build command, output
   directory and install command at their defaults; none of them need changing.
3. Before clicking Deploy, expand **Environment Variables** and add
   `FMCSA_WEB_KEY` with your key as the value, scoped to **Production** (and
   **Preview** if you want branch deployments to work).
4. Click **Deploy**.

To add or change the variable on an existing project: **Project → Settings →
Environment Variables**. Changing a variable does **not** affect deployments
that already exist — you must redeploy for a new value to take effect
(**Deployments** tab → the most recent one → **Redeploy**, or `vercel --prod`
again).

## 4. Verify the live deployment

Against the deployment URL Vercel prints:

1. `/` — the landing page renders with the search box.
2. `/?q=4581509` — **a carrier report, not an error panel.** This is the one
   that matters. If it says "This deployment has no FMCSA API key", the
   variable is not set on the environment you deployed to. If it says "FMCSA
   rejected the API key", the variable is set but wrong — most often a trailing
   newline picked up in the copy-paste, though the app trims that.
3. `/?q=MC-1515020` — exercises the separate docket-number endpoint, which is a
   different URL at FMCSA and can fail independently of the USDOT lookup.
4. `/?q=hello` — should say "That is not a carrier number" without ever calling
   FMCSA.

Confirm the key is not public. It should not be: it is read only in
`src/lib/fmcsa/config.ts`, which imports `server-only`, and it has no
`NEXT_PUBLIC_` prefix. To check for yourself:

```bash
curl -s "https://YOUR-DEPLOYMENT.vercel.app/?q=4581509" | grep -c "YOURKEY"
```

That must print `0`.

---

## Why there is no `vercel.json`

Vercel detects Next.js and applies the right build, output and routing settings
without configuration. This app adds nothing that would need overriding: no
custom headers or redirects, no cron jobs, no region pinning, no non-default
build command. A `vercel.json` here would only be a file that can drift out of
sync with the framework defaults.

## Notes

- **The build does not need the key.** CI builds this project with no
  `FMCSA_WEB_KEY` set, and a deployment missing the variable will still build
  and boot — it renders a setup panel instead of crashing. That is deliberate,
  but it also means a missing variable will not fail your deploy. Step 4 is how
  you catch it.
- **Rate limiting is per instance.** The limiter holds its counters in process
  memory, so on Vercel each serverless instance counts separately and the
  effective limit is looser than the configured 20/minute. It is a speed bump
  against casual abuse of your quota, not a security control.
- **Responses are cached for an hour** (`CACHE_TTL_SECONDS`), so a repeated
  lookup of the same carrier does not spend quota. FMCSA's own data moves far
  more slowly than that.
- **If you rotate the key**, use `vercel env rm FMCSA_WEB_KEY production`
  followed by `vercel env add`, or `vercel env update FMCSA_WEB_KEY production`,
  and then redeploy.
