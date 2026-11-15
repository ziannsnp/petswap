# Impact assessment: society, economy, environment, and professional responsibility

Short assessment for the course outcome "understand impacts of a software project on society, economics, and environment", and for professional responsibility. It records what PetSwap does about each, and the open questions, based on the code and docs as of 14 November 2026.

## Society

| Concern | What the product does | Residual issue |
| --- | --- | --- |
| Privacy of personal data | Registration requires accepting the terms of service and privacy notice (`consent` feature, consent captured in the database). Profiles are readable only by their owner; public host details are limited to name, photo, and location through a restricted function; draft listings are private. | Phone number and location are personal data held by the platform; retention and deletion on request are not yet automated. |
| Data protection law | The privacy notice screen and recorded consent follow the spirit of Thailand's Personal Data Protection Act (PDPA). | No legal review was done; the notice should be checked by someone qualified before real users. |
| Safety of people and animals | No payments or messaging, so there is no financial or chat abuse surface. A host can read a pet only if it has a booking at one of their listings (the end-of-access rule is the known gap noted under Misuse). | Identity verification is out of scope; hosts and owners are not vetted. A real launch would need verification and a reporting path. |
| Fair access and accessibility | Mobile-first layout, tested on desktop and mobile; keyboard focus and dialog behaviour are in the manual journeys. | No automated accessibility audit yet (planned as an axe check in the smoke suite). |
| Misuse | Row Level Security, a safe sign-in error handling that includes rate-limit responses, a username error that does not reveal whether an account exists. | A bug hunt on 14 November found an access gap (hosts keep pet access after a booking is declined); it is being fixed and covered by a SQL test. |

## Economy

- **Cost to build and run:** students' time only; hosting uses managed platforms, GitHub Actions is free for a public repository; effort and a COCOMO II estimate are in [project-management-plan.md](project-management-plan.md#4-effort-and-cost-estimation).
- **Value created:** a marketplace that lets people find in-home pet care without payments built in, so it is a matching service, not a commerce platform. Real adoption would need a payment and trust model (out of scope here).
- **Lock-in and portability:** Postgres schema, plain SQL migrations, and a standard React app; Supabase and Cloudflare are replaceable, and the Docker Compose stack runs the whole system locally ([ADR 0008](decisions/0008-docker-compose-stack.md)).

## Environment

- Static hosting on a global edge network and a managed database mean no dedicated servers to run idle.
- Photos are limited to 10 per listing and 10 MB each, which bounds storage and transfer.
- CI runs only the workflows a change needs (path-filtered), and scheduled runs are weekly, to avoid wasted compute.
- The product itself can reduce travel emissions only indirectly (people leave pets with a neighbour rather than a distant kennel); no measurement is claimed.

## Professional responsibility

- **Honesty about limits:** known gaps are documented in the design document, OpenAPI spec, risk register, and QA reports rather than hidden.
- **Security by design:** least-privilege database access, private buckets, and no secret in the browser bundle ([ci-cd.md](ci-cd.md#cloudflare-project-configuration)); automated scanning is added in the CI pipeline.
- **Responsible AI use:** AI assistance is allowed under the rules in [conventions.md](conventions.md); a human author remains responsible for every merged change, and reviewers verify evidence. Course material on responsible AI use applies.
- **Open source and licences:** the repository is public; dependencies are tracked by Dependabot and dependency review, which also flags licence changes.
