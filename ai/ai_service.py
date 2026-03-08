"""
FastAPI AI service: chat, recommendations, and demand forecast.
"""

from fastapi import FastAPI, Query

from chatbot import chatbot_response
from recommendation import recommend_products
from forecast import forecast_sales

app = FastAPI(title="Pulacan AI Service", version="1.0.0")


@app.get("/")
def root():
    return {"message": "AI Service Running"}


@app.get("/chat")
def chat(q: str = Query(..., description="Question about products")):
    answer = chatbot_response(q)
    return {"question": q, "answer": answer}


@app.get("/recommend")
def recommend(customer_id: int = Query(..., description="Customer ID for recommendations")):
    items = recommend_products(customer_id)
    return {"customer_id": customer_id, "recommendations": items}


@app.get("/forecast")
def forecast(
    product_id: int = Query(..., description="Product ID to forecast"),
    days: int = Query(7, ge=1, le=365, description="Number of days to forecast"),
):
    result = forecast_sales(product_id, days)
    return result
