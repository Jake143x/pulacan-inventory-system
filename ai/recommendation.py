"""
Recommendations: return 3 construction/relevant items from the live inventory.
No stored data; fetches from the backend API.
"""

from config import get_products


def recommend_products(customer_id: int) -> list[dict]:
    """
    Return 3 recommended products from the inventory system.
    Uses customer_id to vary which 3 (e.g. rotate). All data from backend.
    """
    try:
        products = get_products(limit=50, shop=True)
    except RuntimeError:
        return []

    if not products:
        return []

    n = len(products)
    start = (customer_id or 0) % max(n, 1)
    indices = [start % n, (start + 2) % n, (start + 4) % n]
    result = []
    for i in indices:
        p = products[i]
        inv = p.get("inventory") or {}
        qty = inv.get("quantity")
        if qty is None:
            qty = 0
        unit = (p.get("saleUnit") or p.get("unitType") or "piece")
        result.append({
            "product_id": p.get("id"),
            "name": p.get("name"),
            "price": float(p.get("unitPrice") or 0),
            "unit": unit,
            "reason": "From your current inventory — check stock in admin.",
        })
    return result
