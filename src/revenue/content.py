"""The content engine: the only genuinely autonomous customer acquisition.

Ads need money. Outreach needs a person. Content, once written, keeps working
at 3am for years - which is the closest thing to "runs 24/7" that honestly
exists in a business with no ad budget.

The topic bank is not generic SEO filler. Every entry is something answerable
from work already done in ieee_vtools_automation or from day-job experience,
because the only content that converts is content nobody else could write.
"""

from __future__ import annotations

import hashlib
import json
import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path

from .config import CONFIG_DIR, OUT_DIR
from .store import count_events, record_event


@dataclass
class Topic:
    slug: str
    title: str
    #: What the reader is trying to do when they search for this.
    intent: str
    #: Which rung of the ladder this piece points at.
    offer: str
    #: Evidence from real work that makes the piece non-generic.
    proof: str
    keywords: list[str] = field(default_factory=list)


def load_topics() -> list[Topic]:
    path = CONFIG_DIR / "topics.json"
    raw = json.loads(path.read_text(encoding="utf-8"))
    return [Topic(**{k: v for k, v in t.items() if not k.startswith("_")})
            for t in raw["topics"]]


def published_slugs() -> set[str]:
    index = OUT_DIR / "content" / "index.json"
    if not index.exists():
        return set()
    return set(json.loads(index.read_text(encoding="utf-8")).get("published", []))


def next_topic() -> Topic | None:
    done = published_slugs()
    for topic in load_topics():
        if topic.slug not in done:
            return topic
    return None


def render(topic: Topic) -> str:
    """A publishable draft skeleton with the specifics already filled in.

    It is a skeleton on purpose. A fully machine-written article is worth
    roughly nothing now that everyone has one; the leverage is in the outline
    plus the proof, filled in by the one person who actually did the work.
    """
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    kw = ", ".join(topic.keywords)
    return f"""---
title: "{topic.title}"
slug: {topic.slug}
date: {today}
keywords: [{kw}]
cta_offer: {topic.offer}
status: draft
---

# {topic.title}

<!-- Reader intent: {topic.intent} -->
<!-- Proof to use (this is the part no competitor can copy): {topic.proof} -->

## The problem, stated the way the reader would state it

<!-- Two paragraphs, no preamble. Name the specific annoyance. -->

## What most people do instead, and why it breaks

<!-- The obvious approach and its failure mode. Be specific and fair. -->

## What actually worked

<!-- The real method. Include the real detail: {topic.proof} -->

```
<!-- A concrete artifact: a command, a config, a field map, a diff. -->
```

## What it cost, and what it did not solve

<!-- Credibility comes from the limits. State them plainly. -->

## If you want the built version

<!-- One short, unpushy CTA pointing at: {topic.offer} -->
<!-- Link the offer. Do not stack three CTAs; one converts better than three. -->

---
*Harish Padmanaban - Chair, IEEE Houston Section (R5).*
"""


def plan_content(weeks: int = 8, per_week: int = 1) -> list[dict]:
    topics = load_topics()
    done = published_slugs()
    queue = [t for t in topics if t.slug not in done]
    schedule = []
    for i, topic in enumerate(queue[: weeks * per_week]):
        week = i // per_week + 1
        schedule.append({"week": week, "slug": topic.slug, "title": topic.title,
                         "offer": topic.offer})
    return schedule


def generate(topic: Topic | None = None, *, live: bool = False) -> dict:
    """Write the next draft to out/content/. `live` marks it published."""
    topic = topic or next_topic()
    if topic is None:
        return {"done": True, "message": "Topic bank exhausted - add more to config/topics.json"}

    out_dir = OUT_DIR / "content"
    out_dir.mkdir(parents=True, exist_ok=True)
    path = out_dir / f"{topic.slug}.md"
    path.write_text(render(topic), encoding="utf-8")

    result = {"slug": topic.slug, "title": topic.title, "path": str(path),
              "offer": topic.offer, "published": False}

    if live:
        index_path = out_dir / "index.json"
        index = json.loads(index_path.read_text(encoding="utf-8")) if index_path.exists() else {}
        index.setdefault("published", []).append(topic.slug)
        index["updated_at"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
        index_path.write_text(json.dumps(index, indent=2), encoding="utf-8")
        record_event("published", topic.slug, 1, topic.offer)
        result["published"] = True

    return result
