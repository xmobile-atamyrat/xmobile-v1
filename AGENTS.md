# Agent / LLM project context

Use this file as baseline context for work on **xmobile**. It describes deployment reality and constraints so suggestions stay aligned with how the product actually runs.

## What xmobile is

- Local business in **Turkmenistan**: browse categories and products, place orders, and **chat with admins**.
- Stack and repo layout are defined elsewhere (see `README.md`); this document is **operational and product context**, not a full architecture spec.

## Where it runs

- Deployed on **Telekom (Turkmenistan) cloud**: a **single Ubuntu VM**.
- **Everything co-located on that VM** when possible: database, uploaded images, and other app state—no assumption that object storage or managed DBs outside the VM are available or reliable.

## Scale expectations

- Roughly **3,000 monthly active users** today.
- Growth toward **~100k MAU** is treated as a **very ambitious upper bound** (unlikely). **Single-VM capacity is usually enough** for planning; avoid premature distributed-systems complexity unless there is a concrete signal.

## Network and connectivity (critical)

- **Internet quality for typical users in Turkmenistan is poor**, and **much of the outside internet is blocked or unusable** for average users.
- **Prefer keeping traffic and dependencies internal** to the VM and the paths users can actually reach. Treat the deployment as **mostly air-gapped** from the global public internet.
- **Occasional exceptions** (e.g. some third-party endpoints such as Slack) **may work today but are not guaranteed tomorrow**. Do not rely on them for core flows without an explicit product decision and a fallback.
- **Minimize outbound network calls** (telemetry, fonts, CDNs, external APIs) **without materially hurting UX**. Prefer bundling assets, self-hosting, and batching work server-side when it fits the codebase.

## Scaling beyond one VM (only if needed)

- If one VM is no longer enough, options include **additional VMs** and custom glue (e.g. **load balancing, deployment automation**). That is **significant operational effort**—treat it as a deliberate milestone, not the default answer to small performance questions.

## Current VM specs

- **4 CPU cores**
- **4 GB RAM**
- **58 GB disk**

Use these numbers when reasoning about memory-heavy features, build pipelines on the server, log retention, image storage growth, and database size—not as hard limits coded into the app, but as **real production constraints**.

## Implications for code and reviews

- Favor **self-contained, VM-local** solutions over new external SaaS dependencies.
- Avoid **chatty clients** and unnecessary round-trips; prefer **fewer, richer** requests where the architecture allows.
- Be cautious with **assumptions about Google fonts, public CDNs, analytics hosts, or OAuth** unless the project already uses them in a way that is known to work in TM.
- When proposing infra changes, assume **limited managed services** and **DIY operations** unless stated otherwise.
