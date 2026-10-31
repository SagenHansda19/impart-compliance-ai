"""How the backend talks to your model. Pick one with MODEL_MODE.

  mock  returns a canned answer in the real output format (for building/testing without the model)
  http  POST {MODEL_REQUEST_FIELD: cr_text} to MODEL_URL, expects the JSON described in README
  cli   runs MODEL_CLI_COMMAND (e.g. "python impart.py assess --json"), CR text on stdin, JSON on stdout
        NOTE: loads your knowledge base on every call, which is slow. Prefer http for real use.

All adapters return the model's JSON as a dict, or raise ModelCallError(code, message).
"""
import json
import logging
import shlex
import subprocess
import time
from urllib.parse import urlparse

import httpx

from .config import settings

logger = logging.getLogger(__name__)


def get_model_health_url() -> str:
    """Derive health/root URL of the model service from settings.model_url."""
    url = (settings.model_url or "").strip()
    if not url:
        return ""
    if "/api/evaluate" in url:
        return url.replace("/api/evaluate", "/health")
    if url.endswith("/evaluate"):
        return url.replace("/evaluate", "/health")
    parsed = urlparse(url)
    return f"{parsed.scheme}://{parsed.netloc}/health"


def ping_model_service_sync() -> None:
    """Fire-and-forget synchronous ping to trigger the model service container wake-up."""
    if settings.model_mode != "http":
        return
    health_url = get_model_health_url()
    if not health_url:
        return
    try:
        logger.info("Waking up model service at %s", health_url)
        headers = {"Authorization": f"Bearer {settings.model_api_key}"} if settings.model_api_key else {}
        with httpx.Client(timeout=5.0) as client:
            client.get(health_url, headers=headers)
    except Exception as e:  # noqa: BLE001
        logger.debug("Model warmup ping completed with status/transient response: %s", e)


async def wake_model_service() -> None:
    """Non-blocking background ping used on startup lifespan."""
    if settings.model_mode != "http":
        return
    import asyncio
    loop = asyncio.get_running_loop()
    await loop.run_in_executor(None, ping_model_service_sync)


class ModelCallError(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code, self.message = code, message


def _find_json(stdout: str) -> dict:
    """The CLI may print log lines around the JSON; take the outermost {...}."""
    try:
        return json.loads(stdout)
    except ValueError:
        i, j = stdout.find("{"), stdout.rfind("}")
        if i < 0 or j <= i:
            raise ModelCallError("model_bad_response", "Model output contained no JSON.") from None
        try:
            return json.loads(stdout[i:j + 1])
        except ValueError:
            raise ModelCallError("model_bad_response", "Model output was not valid JSON.") from None


def _detail(r) -> str:
    """The model service explains failures in {"detail": "..."}; pass a short, single-line version on."""
    try:
        d = r.json().get("detail")
    except Exception:  # noqa: BLE001
        return ""
    return (" - " + " ".join(str(d).split())[:200]) if d else ""


class HttpModel:
    def call(self, cr_text: str) -> dict:
        headers = {"Authorization": f"Bearer {settings.model_api_key}"} if settings.model_api_key else {}
        last = "unknown"
        code = "model_unavailable"

        # Cold boot on Render free tier takes 40-60s.
        # If model_retries is 0 (e.g. in unit tests), max_retries is 0.
        # Otherwise, allow up to model_cold_boot_retries to bridge the container wake-up window.
        max_retries = max(settings.model_retries, settings.model_cold_boot_retries) if settings.model_retries > 0 else 0

        for attempt in range(max_retries + 1):
            is_cold_boot = False
            try:
                r = httpx.post(settings.model_url, json={settings.model_request_field: cr_text},
                               headers=headers, timeout=settings.model_timeout_s)
            except httpx.TimeoutException:
                last, code = "timed out", "model_timeout"
            except httpx.TransportError as e:
                last, code = f"connection failed: {type(e).__name__}", "model_unreachable"
                is_cold_boot = True
            else:
                if r.status_code in (502, 503, 504):
                    last, code = f"model service returned {r.status_code}{_detail(r)}", "model_unavailable"
                    is_cold_boot = True
                elif r.status_code >= 500:
                    last, code = f"model service returned {r.status_code}{_detail(r)}", "model_unavailable"
                elif r.status_code >= 400:
                    raise ModelCallError("model_rejected", f"Model service rejected the request ({r.status_code}){_detail(r)}.")
                else:
                    try:
                        return r.json()
                    except ValueError:
                        raise ModelCallError("model_bad_response", "Model service did not return JSON.") from None

            if attempt < max_retries:
                if is_cold_boot:
                    sleep_s = 4.0 if attempt > 2 else 2.5
                    logger.info("Model service is waking up (%s). Retrying in %.1fs (attempt %d/%d)...",
                                last, sleep_s, attempt + 1, max_retries)
                    time.sleep(sleep_s)
                    continue
                if attempt < settings.model_retries:
                    time.sleep(min(2 ** attempt, 5))
                    continue
            break

        raise ModelCallError(code, f"Model call failed after retries: {last}")


class CliModel:
    def call(self, cr_text: str) -> dict:
        try:
            p = subprocess.run(shlex.split(settings.model_cli_command), input=cr_text, capture_output=True, text=True,
                               timeout=settings.model_timeout_s, cwd=settings.model_cli_cwd)  # no shell => no injection
        except subprocess.TimeoutExpired:
            raise ModelCallError("model_timeout", "Model command timed out.") from None
        except OSError as e:
            raise ModelCallError("model_unreachable", f"Could not start model command: {e.strerror}") from None
        if p.returncode != 0:
            raise ModelCallError("model_unavailable", f"Model command failed (exit {p.returncode}).")
        return _find_json(p.stdout)


class MockModel:
    """Canned answer in the REAL output format (same fields as the real model). Keywords decide which
    regulations fail: 'timestamp' / 'package' -> EMIR and UKEMIR conflict. Replace with MODEL_MODE=http or cli."""

    REGIONS = {"EMEA": ["EMIR", "UKEMIR"], "APAC": ["ASIC", "MAS", "HKMA"]}

    def call(self, cr_text: str) -> dict:
        low = cr_text.lower()
        failing = {"EMIR", "UKEMIR"} if ("timestamp" in low or "package" in low) else set()
        req = "MOCK requirement derived from the change request"
        table = []
        for reg in ("EMIR", "UKEMIR", "ASIC", "MAS", "HKMA"):
            bad = reg in failing
            conflict = "MOCK: the specification allows only the older format" if bad else ""
            quote = f"MOCK quote from the {reg} specification."
            table.append({
                "regulation": reg, "compliant": "No" if bad else "Yes",
                "reason_if_not_compliant": f"R1: {conflict}" if bad else "",
                "citation": f"{reg.lower()}_field_specifications.xlsx, Sheet: Field Specifications, Row 1",
                "quote": quote, "quote_verified": True, "votes": {"No" if bad else "Yes": 1},
                "findings": [{"req_id": "R1", "covered": True, "field_name": "MOCK field", "conflict": conflict,
                              "spec_max_length": None, "spec_constraint": "MOCK constraint", "sources_disagree": False,
                              "source_values": "", "evidence_quote": quote, "reasoning": "MOCK reasoning",
                              "supported": not bad, "requirement": req}],
                "sources_disagree": False, "source_values": "", "vote_errors": [],
                "mapped_fields": {"R1": ["MOCK field"]}, "catalog_size": 100})
        heatmap = {}
        for region, regs in self.REGIONS.items():
            bad = [r for r in regs if r in failing]
            heatmap[region] = {"affected_regulations": regs, "non_compliant": bad,
                               "risk_status": "High Risk" if bad else "Safe to Implement",
                               "conflict_breakdown": {"specification_conflict": len(bad)} if bad else {}}
        return {"disclaimer": "AI-generated output. Requires human review.",
                "cr_metadata": {"is_ambiguous": False, "clarification_prompt": None, "summary": cr_text[:160],
                                "requirements": [{"id": "R1", "kind": "field", "concept": "MOCK concept", "requirement": req,
                                                  "required_max_length": None, "search_queries": []}]},
                "chain_of_thought_explanation": "\n".join(
                    f"{t['regulation']}: [R1={'FAIL' if t['compliant'] == 'No' else 'OK'}] MOCK explanation." for t in table),
                "compliance_table": table, "conflict_heatmap": heatmap,
                "spectrum_of_complexity": ([{"requirement_id": "R1", "concept": "MOCK concept", "kind": "field", "severity": "Critical",
                                             "reason": f"Conflict detected in regulation(s): {', '.join(sorted(failing))}",
                                             "required_max_length": None}] if failing else []),
                "source_discrepancies": []}


def get_model():
    return {"http": HttpModel, "cli": CliModel, "mock": MockModel}.get(settings.model_mode, MockModel)()
