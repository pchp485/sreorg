# Constraints to settle before the first rupee

Not paperwork for its own sake. Each of these can end the business — or the
job — after it has started, which is much worse than dealing with it now.

## 1. Your employer (read this one first)

You work in a large bank's ecosystem. Financial institutions almost universally
require **written pre-approval for outside business activity**, and many
restrict it outright. This applies whether or not the work is related to your
day job, and whether or not it earns much.

Being paid by strangers into your personal account for a product you sell
publicly is unambiguously outside business activity.

**Do this before launch:** find your firm's Outside Business Activity / Private
Investment policy on the intranet, and file the disclosure. Approval is
routinely granted for unrelated side income. Not asking is the failure mode —
discovering the policy during an internal review is a career problem, not a
compliance ticket.

Two specific things to keep clean regardless:
- No firm IP, code, data, or internal tooling in anything you sell. The
  `ieee_vtools_automation` work is yours and IEEE-facing; keep it that way.
- Nothing built or published on firm equipment or time. Not on the LVDI/Citrix
  session.

## 2. IEEE

You are selling something built for your role as **Chair of IEEE Houston
Section**, to other IEEE volunteers.

- IEEE has a **Conflict of Interest** policy for volunteers. A Section Chair
  personally profiting from selling to other sections is a textbook disclosable
  conflict.
- Do not use Section assets to sell: not the Section mailing list, not the
  Section's vTools eNotice, not the Section's LinkedIn page, not `r5.ieee.org`.
  Those belong to IEEE and exist for IEEE's purposes.
- Do not imply IEEE endorsement. "Built by a Section Chair for his own section"
  is honest and is a strong claim. "IEEE-approved" is neither.
- Disclose to your Section ExCom, in a meeting, on the record. It is a
  two-minute item and it permanently removes the problem.

The safest framing is the true one: the tool is open, you built it for Houston,
and you offer a paid packaged version and paid support to anyone who wants it.

## 3. Email law

The engine refuses to run a sequence to anyone without recorded consent, by
design (`revenue lead mailable`). The reason:

- **DPDP Act 2023** (India) — consent must be free, specific, informed and
  demonstrable.
- **GDPR** — many IEEE volunteers are in the EU. Consent, plus a lawful basis,
  plus deletion on request.
- **CAN-SPAM** (US) — a real postal address and a working unsubscribe in every
  commercial message.

Bulk mail to a scraped IEEE officer list would be illegal in at least two
jurisdictions and would burn your sending domain permanently. A one-person
business does not recover from that.

Individual, genuinely personal outreach is a different thing and is fine. That
is why `revenue lead draft` writes one message at a time and has no send
function.

## 4. Platform terms

- **LinkedIn**: automating posting or connection requests via a browser
  breaches the User Agreement and gets accounts restricted. The
  `ieee_vtools_automation` repo already flags this. Post by hand, or use the
  official API.
- **vTools / IEEE systems**: automate *your own* section's work with your own
  credentials. Never hold another officer's credentials — for
  `managed-section-ops`, they approve and publish from their own account, and
  the engine's email says exactly that.

## 5. Claims

Do not promise income, outcomes, or "automation that runs your section for
you". Describe what it does. The refund line in the delivery email — 14 days,
no questions — is there because it is cheap, it is honest, and it removes the
main reason someone hesitates at ₹1,499.
