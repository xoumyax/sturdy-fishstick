from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

import yaml
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env")

CONFIG_PATH = Path(__file__).parent.parent / "config.yaml"
# Optional separate config for the PhD track (girlfriend's profile). When it
# exists, its phd_profile and phd_search sections override config.yaml's.
PHD_CONFIG_PATH = Path(__file__).parent.parent / "phd_config.yaml"


@dataclass
class ProfileConfig:
    name: str
    positions: list[str]
    expertise: list[str]
    resume_summary: str
    location_preference: list[str]   # list of countries / regions
    remote_ok: bool
    relocation_ok: bool


@dataclass
class SearchConfig:
    sources: list[str]
    time_filter: str
    max_results_per_query: int
    extra_keywords: list[str]
    company_blacklist: list[str]
    company_whitelist: list[str]
    serper_daily_cap: int = 10  # hard cap on Serper API calls per day (budget: 2500 / 6 months)


@dataclass
class PhdSearchConfig:
    """Search knobs for the PhD track — pairs with phd_profile the way
    `search` pairs with `profile`."""
    sources: list[str] = field(default_factory=lambda: ["google_jobs"])
    time_filter: str = "3months"  # PhD cycles are slower than job postings
    max_results_per_query: int = 20
    funding_required: bool = False  # only surface funded positions
    extra_keywords: list[str] = field(default_factory=list)
    institution_whitelist: list[str] = field(default_factory=list)
    institution_blacklist: list[str] = field(default_factory=list)


@dataclass
class SchedulerConfig:
    times: list[str]
    timezone: str


@dataclass
class LLMConfig:
    model: str
    priority_threshold: int
    batch_size: int
    scoring_model: str = ""  # small model for routine scoring passes; falls back to `model`
    max_scoring_minutes: int = 30  # time-box per scoring pass; leftovers wait for the next one


@dataclass
class EmailNotificationConfig:
    enabled: bool
    to: str
    from_addr: str
    smtp_host: str
    smtp_port: int
    score_threshold: int


@dataclass
class NotificationsConfig:
    email: EmailNotificationConfig


@dataclass
class AppConfig:
    port: int
    host: str


@dataclass
class Config:
    profile: ProfileConfig
    search: SearchConfig
    scheduler: SchedulerConfig
    llm: LLMConfig
    notifications: NotificationsConfig
    app: AppConfig
    phd_profile: ProfileConfig | None = None
    phd_search: PhdSearchConfig = field(default_factory=PhdSearchConfig)

    # env-sourced
    serper_api_key: str = field(default_factory=lambda: os.environ.get("SERPER_API_KEY", ""))
    ollama_base_url: str = field(default_factory=lambda: os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434"))
    api_token: str = field(default_factory=lambda: os.environ.get("API_TOKEN", ""))
    smtp_app_password: str = field(default_factory=lambda: os.environ.get("SMTP_APP_PASSWORD", ""))
    linkedin_email: str = field(default_factory=lambda: os.environ.get("LINKEDIN_EMAIL", ""))
    linkedin_password: str = field(default_factory=lambda: os.environ.get("LINKEDIN_PASSWORD", ""))


def _parse_profile(p: dict) -> ProfileConfig:
    # location_preference: accept both string (legacy) and list
    loc_pref = p.get("location_preference", "United States")
    if isinstance(loc_pref, str):
        loc_pref = [loc_pref]
    return ProfileConfig(
        name=p["name"],
        positions=p["positions"],
        expertise=p["expertise"],
        resume_summary=p["resume_summary"],
        location_preference=loc_pref,
        remote_ok=p.get("remote_ok", True),
        relocation_ok=p.get("relocation_ok", False),
    )


def _parse_phd_search(ps: dict | None) -> PhdSearchConfig:
    ps = ps or {}
    return PhdSearchConfig(
        sources=ps.get("sources") or ["google_jobs"],
        time_filter=ps.get("time_filter", "3months"),
        max_results_per_query=ps.get("max_results_per_query", 20),
        funding_required=ps.get("funding_required", False),
        extra_keywords=ps.get("extra_keywords") or [],
        institution_whitelist=ps.get("institution_whitelist") or [],
        institution_blacklist=ps.get("institution_blacklist") or [],
    )


def load_config() -> Config:
    raw = yaml.safe_load(CONFIG_PATH.read_text())
    p = raw["profile"]
    s = raw["search"]
    sc = raw["scheduler"]
    l = raw["llm"]
    a = raw["app"]
    n = raw.get("notifications", {})
    ne = n.get("email", {})
    phd_raw = raw.get("phd_profile")
    phd_search_raw = raw.get("phd_search")

    # Separate PhD config file wins over config.yaml's phd sections
    if PHD_CONFIG_PATH.exists():
        try:
            phd_file = yaml.safe_load(PHD_CONFIG_PATH.read_text()) or {}
            phd_raw = phd_file.get("phd_profile") or phd_raw
            phd_search_raw = phd_file.get("phd_search") or phd_search_raw
        except yaml.YAMLError as e:
            import logging
            logging.getLogger(__name__).warning("phd_config.yaml is invalid, using config.yaml sections: %s", e)

    return Config(
        profile=_parse_profile(p),
        phd_profile=_parse_profile(phd_raw) if phd_raw else None,
        phd_search=_parse_phd_search(phd_search_raw),
        search=SearchConfig(
            sources=s["sources"],
            time_filter=s.get("time_filter", "month"),
            max_results_per_query=s.get("max_results_per_query", 20),
            extra_keywords=s.get("extra_keywords") or [],
            company_blacklist=s.get("company_blacklist") or [],
            company_whitelist=s.get("company_whitelist") or [],
            serper_daily_cap=s.get("serper_daily_cap", 10),
        ),
        scheduler=SchedulerConfig(
            times=sc["times"],
            timezone=sc.get("timezone", "America/Chicago"),
        ),
        llm=LLMConfig(
            model=l.get("model", "phi3:mini"),
            priority_threshold=l.get("priority_threshold", 7),
            batch_size=l.get("batch_size", 10),
            scoring_model=l.get("scoring_model", ""),
            max_scoring_minutes=l.get("max_scoring_minutes", 30),
        ),
        notifications=NotificationsConfig(
            email=EmailNotificationConfig(
                enabled=ne.get("enabled", False),
                to=ne.get("to", ""),
                from_addr=ne.get("from_addr", ""),
                smtp_host=ne.get("smtp_host", "smtp.gmail.com"),
                smtp_port=ne.get("smtp_port", 587),
                score_threshold=ne.get("score_threshold", 8),
            ),
        ),
        app=AppConfig(
            port=a.get("port", 8001),
            host=a.get("host", "127.0.0.1"),
        ),
    )


_config: Config | None = None


def get_config() -> Config:
    global _config
    if _config is None:
        _config = load_config()
    return _config


def reload_config() -> Config:
    global _config
    _config = load_config()
    return _config


def profile_for_mode(cfg: Config, mode: str | None) -> ProfileConfig:
    """Return the PhD profile in phd mode (when configured), else the main profile."""
    if mode == "phd" and cfg.phd_profile is not None:
        return cfg.phd_profile
    return cfg.profile
