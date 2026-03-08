# Pulacan AI Service (FastAPI)

AI endpoints that **pull live data from your inventory backend** — no stored data. Chat and recommendations use the backend product list; forecast uses the backend demand forecast when configured.

## Behaviour

- **Chat** – Fetches products from `GET /api/products` and answers questions about name, price, and stock.
- **Recommend** – Returns 3 products from the backend catalog (shop-style list).
- **Forecast** – If `AI_SERVICE_KEY` is set, uses the backend’s demand forecast; otherwise uses a Prophet fallback with synthetic data.

Ensure the **backend is running** (e.g. `npm run dev` in the project root or `cd backend && npm run dev`) so the AI service can reach `http://localhost:3001/api`.

## Setup

```bash
cd ai
python -m venv venv
venv\Scripts\activate   # Windows
# source venv/bin/activate   # macOS/Linux
pip install -r requirements.txt
```

**Optional (for forecast from backend):** In `backend/.env` set `AI_SERVICE_KEY=your-secret`. In the same terminal (or in `ai/.env`) set `AI_SERVICE_KEY=your-secret` and optionally `BACKEND_API_URL=http://localhost:3001` so the Python service uses the same key and URL.

**Note:** On Windows, Prophet may require Visual C++ Build Tools or conda. If `prophet` fails to install, the forecast endpoint still works (backend forecast or simple fallback).

## Run

```bash
uvicorn ai_service:app --reload --host 0.0.0.0 --port 8000
```

Then open:

- http://localhost:8000/ → `{"message": "AI Service Running"}`
- http://localhost:8000/chat?q=Do%20you%20have%20cement%3F
- http://localhost:8000/recommend?customer_id=1
- http://localhost:8000/forecast?product_id=1&days=7

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | / | Health / welcome |
| GET | /chat?q=... | Chatbot: product lookup from backend (name, price, stock) |
| GET | /recommend?customer_id=1 | 3 products from backend catalog |
| GET | /forecast?product_id=1&days=7 | Demand forecast (backend or Prophet fallback) |
