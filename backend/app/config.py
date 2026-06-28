from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

import yaml
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env")

CONFIG_PATH = Path(__file__).parent.parent / "config.yaml"


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


@dataclass
class SchedulerConfig:
    times: list[str]
    timezone: str


@dataclass
class LLMConfig:
    model: str
    priority_threshold: int
    batch_size: int


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

    # env-sourced
    serper_api_key: str = field(default_factory=lambda: os.environ.get("SERPER_API_KEY", ""))
    ollama_base_url: str = field(default_factory=lambda: os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434"))
    api_token: str = field(default_factory=lambda: os.environ.get("API_TOKEN", ""))
    smtp_app_password: str = field(default_factory=lambda: os.environ.get("SMTP_APP_PASSWORD", ""))
    linkedin_email: str = field(default_factory=lambda: os.environ.get("LINKEDIN_EMAIL", ""))
    linkedin_password: str = field(default_factory=lambda: os.environ.get("LINKEDIN_PASSWORD", ""))


def load_config() -> Config:
    raw = yaml.safe_load(CONFIG_PATH.read_text())
    p = raw["profile"]
    s = raw["search"]
    sc = raw["scheduler"]
    l = raw["llm"]
    a = raw["app"]
    n = raw.get("notifications", {})
    ne = n.get("email", {})

    # location_preference: accept both string (legacy) and list
    loc_pref = p.get("location_preference", "United States")
    if isinstance(loc_pref, str):
        loc_pref = [loc_pref]

    return Config(
        profile=ProfileConfig(
            name=p["name"],
            positions=p["positions"],
            expertise=p["expertise"],
            resume_summary=p["resume_summary"],
            location_preference=loc_pref,
            remote_ok=p.get("remote_ok", True),
            relocation_ok=p.get("relocation_ok", False),
        ),
        search=SearchConfig(
            sources=s["sources"],
            time_filter=s.get("time_filter", "month"),
            max_results_per_query=s.get("max_results_per_query", 20),
            extra_keywords=s.get("extra_keywords") or [],
            company_blacklist=s.get("company_blacklist") or [],
            company_whitelist=s.get("company_whitelist") or [],
        ),
        scheduler=SchedulerConfig(
            times=sc["times"],
            timezone=sc.get("timezone", "America/Chicago"),
        ),
        llm=LLMConfig(
            model=l.get("model", "phi3:mini"),
            priority_threshold=l.get("priority_threshold", 7),
            batch_size=l.get("batch_size", 10),
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
