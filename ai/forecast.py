"""
Forecast: use backend inventory forecast when available, else Prophet fallback.
No stored data; pulls from backend API when AI_SERVICE_KEY is set.
"""

from config import get_forecast_from_backend

# Optional Prophet fallback (no backend)
try:
    from prophet import Prophet
    import pandas as pd
    HAS_PROPHET = True
except ImportError:
    HAS_PROPHET = False

from datetime import datetime, timedelta
import random

RANDOM_SEED = 42


def _prophet_fallback(product_id: int, days: int) -> dict:
    """Fallback when backend forecast is not available: synthetic Prophet forecast."""
    if not HAS_PROPHET or days < 1:
        total = max(0, 10 + (product_id % 15) * days) if days else 0
        return {
            "product_id": product_id,
            "days": days,
            "predicted_demand_total": round(total, 2),
            "daily": [round(total / days, 2)] * days if days else [],
            "ds": [],
            "source": "fallback",
        }
    random.seed(RANDOM_SEED + product_id)
    base_date = datetime.now().date() - timedelta(days=90)
    base_demand = 10 + (product_id % 20)
    rows = []
    for i in range(90):
        d = base_date + timedelta(days=i)
        value = max(0, base_demand + 0.02 * i + random.gauss(0, 3))
        rows.append({"ds": d, "y": round(value, 2)})
    df = pd.DataFrame(rows)
    model = Prophet(yearly_seasonality=False, weekly_seasonality=True, daily_seasonality=False)
    model.fit(df)
    future = model.make_future_dataframe(periods=days)
    forecast = model.predict(future)
    tail = forecast.tail(days)
    daily = [round(float(row["yhat"]), 2) for _, row in tail.iterrows()]
    total = round(sum(daily), 2)
    date_strs = [pd.Timestamp(row["ds"]).strftime("%Y-%m-%d") for _, row in tail.iterrows()]
    return {
        "product_id": product_id,
        "days": days,
        "predicted_demand_total": total,
        "daily": daily,
        "ds": date_strs,
        "source": "prophet_fallback",
    }


def forecast_sales(product_id: int, days: int = 7) -> dict:
    """
    Forecast demand for a product. Uses backend inventory forecast when
    AI_SERVICE_KEY is set; otherwise uses Prophet fallback with synthetic data.
    """
    if days < 1:
        days = 1
    if days > 365:
        days = 365

    data = get_forecast_from_backend(days)
    if data:
        for row in data:
            if row.get("productId") == product_id:
                inv = (row.get("product") or {}).get("inventory") or {}
                current_stock = inv.get("quantity")
                if current_stock is None:
                    current_stock = 0
                return {
                    "product_id": product_id,
                    "days": days,
                    "predicted_demand_total": round(float(row.get("predictedDemand") or 0), 2),
                    "current_stock": float(current_stock),
                    "suggested_restock": int(row.get("suggestedRestock") or 0),
                    "risk_of_stockout": row.get("riskOfStockout"),
                    "product_name": (row.get("product") or {}).get("name"),
                    "source": "inventory_system",
                }
        return {
            "product_id": product_id,
            "days": days,
            "predicted_demand_total": 0,
            "message": "Product not in forecast. Run forecast in admin or use fallback.",
            "source": "inventory_system",
        }

    return _prophet_fallback(product_id, days)
