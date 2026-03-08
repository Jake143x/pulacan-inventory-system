"""
Chatbot: answers questions about products using live data from the inventory backend.
No stored data; fetches products from the API on each request (backend uses Prisma/PostgreSQL).
"""

from config import get_products


def _normalize(s: str) -> str:
    return " ".join((s or "").lower().strip().split())


def _extract_product_query(question: str) -> str:
    """Extract product name from phrases like 'specs of X', 'price of X', 'do you have X'."""
    q = _normalize(question)
    for prefix in (
        "specs of ", "spec of ", "specifications of ", "details of ", "info on ", "information on ",
        "give me the specs of ", "give me the details of ", "price of ", "cost of ",
        "stock for ", "do you have ", "availability of ", "tell me about ", "what about ",
    ):
        if q.startswith(prefix):
            return question[len(prefix):].strip()
    # "how about X" -> X
    if q.startswith("how about ") or q.startswith("what about "):
        return question[10:].strip()
    return question.strip()


def _find_products(question: str, products: list[dict], limit: int = 5) -> list[dict]:
    """Return products that match the query. When products come from API search=query, backend already did ILIKE."""
    query = _extract_product_query(question)
    if not query:
        return products[:limit]
    q_lower = query.lower()
    filtered = []
    for p in products:
        name = (p.get("name") or "").lower()
        if q_lower in name or name in q_lower:
            filtered.append(p)
        elif any(word in name for word in q_lower.split() if len(word) > 1):
            filtered.append(p)
    if filtered:
        return filtered[:limit]
    return products[:limit]


def _stock_and_unit(p: dict) -> tuple[float, str]:
    inv = p.get("inventory") or {}
    qty = inv.get("quantity")
    if qty is None:
        qty = 0
    unit = (p.get("saleUnit") or p.get("unitType") or "piece").lower()
    if unit == "kg":
        unit = "kg"
    elif unit == "meter":
        unit = "m"
    else:
        unit = "pcs"
    return float(qty), unit


def _price(p: dict) -> float:
    return float(p.get("unitPrice") or 0)


def _format_product_details(p: dict) -> str:
    """Format: name, description, specs, price, stock, category."""
    lines = [p.get("name") or "Product"]
    if p.get("description") and str(p.get("description")).strip():
        lines.append(str(p.get("description")).strip())
    if p.get("specifications") and str(p.get("specifications")).strip():
        lines.append(f"Specs: {p.get('specifications')}".strip())
    price = _price(p)
    stock, unit = _stock_and_unit(p)
    stock_msg = f"{stock} {unit} in stock" if stock > 0 else "Out of stock"
    lines.append(f"Price: ₱{price:.2f}")
    lines.append(f"Stock: {stock_msg}")
    if p.get("category") and str(p.get("category")).strip():
        lines.append(f"Category: {p.get('category')}".strip())
    return "\n".join(lines)


def chatbot_response(question: str) -> str:
    """
    Answer product questions using live data from the backend (Prisma/PostgreSQL).
    Returns name, description, price, stock, category. Suggests similar items when not found.
    """
    if not question or not question.strip():
        return "Please ask about a product (e.g. 'Do you have cement?', 'Specs of interior wall paint', 'Price of hammer')."

    query = _extract_product_query(question)
    try:
        # Backend uses ILIKE on name via search= param; always uses live DB
        products = get_products(limit=50, search=query) if query else get_products(limit=50)
    except RuntimeError as e:
        return f"Cannot reach the inventory system right now: {e}. Make sure the backend is running."

    if not products:
        # No products at all
        return "The product catalog is empty. Add products in the admin inventory."

    matches = _find_products(question, products, limit=5)
    if matches:
        return "\n\n".join(_format_product_details(p) for p in matches)

    # No match for this query: suggest similar (other products from catalog)
    similar_products = get_products(limit=10)
    similar = list(dict.fromkeys(p.get("name") or "Product" for p in similar_products))[:5]
    hint = f" You might be interested in: {', '.join(similar)}." if similar else ""
    return f"I couldn't find that product in our catalog.{hint} Ask for a specific item by name or check the Products page."
