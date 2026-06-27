from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime
from typing import Optional


@dataclass
class RawJob:
    title: str
    company: Optional[str]
    location: Optional[str]
    url: str
    description: Optional[str]
    source: str
    date_posted: Optional[datetime]
    raw_data: dict


class BaseScraper(ABC):
    @abstractmethod
    async def fetch(self, queries: list[str], max_results: int) -> list[RawJob]:
        ...
