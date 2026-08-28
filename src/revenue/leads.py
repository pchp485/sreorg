"""Lead capture and nurture - inside the law, which is also inside the ToS.

The hard rule: nothing here sends unsolicited mail. Every sequence requires
`consent=True` with recorded evidence of where it came from.

This is not squeamishness. Under India's DPDP Act 2023, the GDPR (many IEEE
volunteers are in the EU), and CAN-SPAM (most are in the US), unsolicited
commercial mail at volume is a fine and a permanently burned sending domain.
A burned domain ends the business; there is no recovering deliverability on a
one-person operation.

Cold *individual* outreach - a real, personal, one-to-one message to someone
with an obvious reason to hear from you - is a different thing and is fine.
`draft_outreach` writes those one at a time, for a human to read and send.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

from .catalog import get_offer
from .models import Lead, LeadStage, now
from .store import list_leads, record_event, upsert_lead

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[a-zA-Z]{2,}$")


class ConsentError(RuntimeError):
    pass


def capture(
    email: str,
    source: str,
    *,
    name: str = "",
    org: str = "",
    consent: bool = False,
    evidence: str = "",
) -> Lead:
    """Record a lead. Consent must be asserted explicitly with evidence."""
    email = email.strip().lower()
    if not EMAIL_RE.match(email):
        raise ValueError(f"'{email}' is not a usable email address")
    if consent and not evidence:
        raise ConsentError(
            "Recording consent requires evidence - where and when they opted in. "
            "Without it the consent cannot be proved, which makes it worthless."
        )
    lead = upsert_lead(
        Lead(
            email=email,
            source=source,
            name=name,
            org=org,
            consent=consent,
            consent_evidence=evidence,
            stage=LeadStage.NEW,
        )
    )
    record_event("lead", source, 1, email)
    return lead


def mailable() -> list[Lead]:
    """The only list a bulk sequence is ever allowed to touch."""
    return [l for l in list_leads(consented=True) if l.stage not in (LeadStage.LOST,)]


@dataclass
class OutreachDraft:
    to: str
    subject: str
    body: str
    rationale: str

    def render(self) -> str:
        return (
            f"To:      {self.to}\nSubject: {self.subject}\n"
            f"Why:     {self.rationale}\n{'-' * 60}\n{self.body}"
        )


def draft_outreach(lead: Lead, offer_slug: str) -> OutreachDraft:
    """One personal message, for a human to read, edit and send by hand.

    Intentionally not wired to a send function. The moment this can send by
    itself it becomes a spam cannon, and the value of being a known Section
    Chair writing to peers is destroyed the first time it is used that way.
    """
    offer = get_offer(offer_slug)
    who = lead.name or "there"
    org = f" at {lead.org}" if lead.org else ""

    body = f"""Hi {who},

I chair IEEE Houston Section (R5). Running events there meant doing the
same thing every month by hand - creating the vTools event, writing the
eNotice, posting to the site, then again on LinkedIn - so I built a tool
that drafts all four and waits for me to approve before anything goes out.

It has been running our section's events for a while now. I am making it
available to other officers{org} who are doing the same work manually.

Would it be useful to see what it produces for one of your upcoming
events? I can send a sample draft - no cost, and nothing gets published
anywhere without your say-so.

Harish Padmanaban
Chair, IEEE Houston Section
"""
    return OutreachDraft(
        to=lead.email,
        subject=f"{offer.name.split(':')[0]} - built it for my own section",
        body=body,
        rationale=f"source={lead.source}, stage={lead.stage.value}, "
                  f"consent={'yes' if lead.consent else 'no (individual send only)'}",
    )


def advance(email: str, stage: LeadStage, note: str = "") -> Lead:
    for lead in list_leads():
        if lead.email == email.lower():
            lead.stage = stage
            lead.updated_at = now()
            if note:
                lead.notes = f"{lead.notes}\n{now()[:10]}: {note}".strip()
            upsert_lead(lead)
            record_event("stage", stage.value, 1, email)
            return lead
    raise KeyError(f"No lead with email {email}")
