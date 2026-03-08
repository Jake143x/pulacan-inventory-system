"""
Config and HTTP client for the inventory backend API.
No stored data: all info is fetched from the backend on demand.
"""

import os
import urllib.request
import urllib.error
import urllib.parse
import json

# Backend API base URL (no trailing slash). Set BACKEND_API_URL or default to localhost.
BACKEND_API_URL = (os.environ.get("BACKEND_API_URL") or "http://localhost:3001").rstrip("/")
BACKEND_API_BASE = f"{BACKEND_API_URL}/api"
# Optional: key for internal forecast endpoint. Set AI_SERVICE_KEY in backend .env to match.
AI_SERVICE_KEY = os.environ.get("AI_SERVICE_KEY") or ""


def _request(path: str, method: str = "GET", headers: dict | None = None, body: bytes | None = None) -> dict | list:
    url = f"{BACKEND_API_BASE}{path}"
    req_headers = {"Accept": "application/json", "Content-Type": "application/json"}
    if headers:
        req_headers.update(headers)
    req = urllib.request.Request(url, data=body, method=method, headers=req_headers)
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        try:
            err_body = e.read().decode()
            data = json.loads(err_body) if err_body else {}
        except Exception:
            data = {}
        raise RuntimeError(data.get("error", f"Backend error {e.code}")) from e
    except urllib.error.URLError as e:
        raise RuntimeError(f"Cannot reach backend at {BACKEND_API_BASE}. Is it running?") from e


def get_products(limit: int = 200, search: str = "", category: str = "", shop: bool = False) -> list[dict]:
    """Fetch products from backend (includes inventory and productUnits). No auth required."""
    params = [f"limit={limit}"]
    if search:
        params.append(f"search={urllib.parse.quote(search)}")
    if category:
        params.append(f"category={urllib.parse.quote(category)}")
    if shop:
        params.append("shop=true")
    path = f"/products?{'&'.join(params)}"
    data = _request(path)
    return data.get("data") or []


def get_forecast_from_backend(days: int) -> list[dict]:
    """Fetch forecast from backend internal endpoint. Requires AI_SERVICE_KEY to be set."""
    if not AI_SERVICE_KEY:
        return []
    path = f"/ai/forecast/internal?days={days}"
    data = _request(path, headers={"X-AI-Service-Key": AI_SERVICE_KEY})
    return data.get("data") or []
