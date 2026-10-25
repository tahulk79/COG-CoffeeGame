# Product ↔ implementation handoff template

Copy the template below when moving a task between the planning ChatGPT conversation and Codex. Replace placeholders; do not treat defaults or copied text as owner approval. A read-only GitHub connector cannot submit this template to the repository itself.

```text
Task ID: C6S-<unique descriptive ID>
Title:
State: PROPOSED
Application version observed:
Main/source SHA observed:
Observed at (UTC):
Relevant documents / PRs:

Player problem and intended outcome:
Why this matters to Game First / Hybrid Discovery / Persistent Discovery:

Already implemented and to preserve:
Requested changes:
Explicit exclusions:
Scientific assumptions / evidence limits:
Data and compatibility constraints:

Acceptance criteria (observable, not just a list of components):
Verification expected:
Open decisions / dependencies:

Owner approval reference: NOT APPROVED
Implementation authorization: NOT APPROVED
Commit/push/PR authorization: NOT APPROVED
Merge authorization: NOT APPROVED
Deployment authorization: NOT APPROVED
Budget / new services authorization: NOT APPROVED

Implementation report (filled by Codex after authorized work):
- Actual baseline SHA and differences from the proposal:
- Changes made / remaining work:
- Branch / PR / merged commit:
- Tests actually run and results:
- Tests not run / evidence limitations:
- Deployment run, source SHA and destination, if authorized/performed:
- Runtime verification, if performed:
- Shared documents updated:
- Next decision needed:
```

Use a short decision reference and bounded scope; never paste credentials or private user data. Preserve PROPOSED until the owner actually approves. Analysis/publication authorization is not permission to implement a gameplay feature, introduce payments or deploy infrastructure. Completed code, deployment and human validation are separate facts.
