"""Configuration: environment, money constants, and the target being aimed at.

Nothing here reads a secret at import time. Credentials are pulled on demand so
that `plan`, `metrics` and every other read-only command work on a laptop with
an empty `.env`.
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
CONFIG_DIR = REPO_ROOT / "config"
DATA_DIR = REPO_ROOT / "data"
OUT_DIR = REPO_ROOT / "out"

DB_PATH = Path(os.environ.get("REVENUE_DB", DATA_DIR / "revenue.db"))


def load_dotenv(path: Path | None = None) -> None:
    """Read `.env` into os.environ without overwriting anything already set.

    A three-line parser instead of python-dotenv: this package stays importable
    on a bare runner.
    """
    path = path or REPO_ROOT / ".env"
    if not path.exists():
        return
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        os.environ.setdefault(key, value)


def env(name: str, default: str | None = None, *, required: bool = False) -> str | None:
    load_dotenv()
    value = os.environ.get(name, default)
    if required and not value:
        raise MissingCredential(name)
    return value


class MissingCredential(RuntimeError):
    def __init__(self, name: str) -> None:
        super().__init__(
            f"{name} is not set. Add it to .env (see .env.example) or to the "
            f"repository's Actions secrets."
        )
        self.name = name


# --- Money constants -------------------------------------------------------
#
# Payment-gateway pricing changes. These are the defaults the planner reasons
# with; override them in config/targets.json once the real rates are on the
# account's pricing page.

#: Razorpay standard domestic card/UPI rate, before tax on the fee.
RAZORPAY_DOMESTIC_FEE = 0.02
#: Razorpay international card rate, before tax on the fee.
RAZORPAY_INTERNATIONAL_FEE = 0.03
#: GST charged *on the gateway fee itself* (not on the transaction).
GST_ON_FEE = 0.18


def effective_fee(international: bool = False) -> float:
    """Fraction of gross revenue lost to the gateway, tax on the fee included."""
    base = RAZORPAY_INTERNATIONAL_FEE if international else RAZORPAY_DOMESTIC_FEE
    return round(base * (1 + GST_ON_FEE), 6)


@dataclass(frozen=True)
class Target:
    """What "done" means, in rupees per month."""

    monthly_net_inr: int = 30_000
    currency: str = "INR"
    #: Months allowed to reach the target before the plan is called a failure.
    horizon_months: int = 6
    #: Revenue is only "constant" once it has held for this many months.
    stability_months: int = 3

    @classmethod
    def load(cls) -> "Target":
        path = CONFIG_DIR / "targets.json"
        if not path.exists():
            return cls()
        raw = json.loads(path.read_text(encoding="utf-8"))
        known = {f: raw[f] for f in cls.__dataclass_fields__ if f in raw}
        return cls(**known)
