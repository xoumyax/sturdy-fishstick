from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Optional

from .base import RawJob
from .serper import _detect_country

logger = logging.getLogger(__name__)


class LinkedInScraper:
    """
    Unofficial LinkedIn job scraper using linkedin-api.
    Uses LinkedIn's internal mobile API — requires a (dummy) LinkedIn account.
    Install: pip install linkedin-api
    Set LINKEDIN_EMAIL and LINKEDIN_PASSWORD in backend/.env
    """

    def __init__(self, email: str, password: str):
        self._email = email
        self._password = password
        self._api = None

    def _connect(self):
        if self._api is not None:
            return True
        try:
            from linkedin_api import Linkedin
            self._api = Linkedin(self._email, self._password)
            return True
        except ImportError:
            logger.error("linkedin-api not installed. Run: pip install linkedin-api")
            return False
        except Exception as e:
            logger.error("LinkedIn login failed: %s", e)
            return False

    def _parse_posted_at(self, job: dict) -> Optional[datetime]:
        # LinkedIn returns listedAt as a Unix timestamp in ms
        listed_at = job.get("listedAt")
        if listed_at:
            try:
                return datetime.utcfromtimestamp(listed_at / 1000)
            except Exception:
                pass
        return None

    def fetch(self, queries: list[str], locations: list[str], max_results: int = 10) -> list[RawJob]:
        if not self._connect():
            return []

        results: list[RawJob] = []
        seen_urls: set[str] = set()

        for query in queries[:6]:  # cap queries to save LinkedIn rate limits
            for location in locations:
                try:
                    jobs = self._api.search_jobs(
                        keywords=query,
                        location_name=location,
                        limit=max_results,
                    )
                except Exception as e:
                    logger.warning("LinkedIn search failed for %r in %r: %s", query, location, e)
                    continue

                for job in jobs:
                    job_id = job.get("trackingUrn", "").split(":")[-1] or job.get("entityUrn", "").split(":")[-1]
                    if not job_id:
                        continue

                    url = f"https://www.linkedin.com/jobs/view/{job_id}/"
                    if url in seen_urls:
                        continue
                    seen_urls.add(url)

                    title = job.get("title", "")
                    company = (job.get("companyDetails", {})
                               .get("com.linkedin.voyager.deco.jobs.web.shared.WebCompactJobPostingCompany", {})
                               .get("companyResolutionResult", {})
                               .get("name"))
                    location_str = job.get("formattedLocation")

                    results.append(RawJob(
                        title=title,
                        company=company,
                        location=location_str,
                        url=url,
                        description=None,  # Full description requires a second API call
                        source="linkedin_direct",
                        date_posted=self._parse_posted_at(job),
                        raw_data=job,
                        country=_detect_country(location_str) or location,
                    ))

        logger.info("LinkedIn direct: fetched %d jobs", len(results))
        return results
