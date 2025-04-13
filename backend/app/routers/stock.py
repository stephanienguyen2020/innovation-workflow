from fastapi import APIRouter, HTTPException
from typing import Dict, Optional
from app.services.vnstock import VNStockService

router = APIRouter(prefix="/stock", tags=["stock"])
stock_service = VNStockService()

@router.get("/price/{stock_code}")
async def get_stock_price(stock_code: str) -> Dict:
    """
    Get the current price for a given stock code
    """
    price = stock_service.fetch_stock_price(stock_code)
    if price is None:
        raise HTTPException(status_code=404, detail=f"Price not found for stock {stock_code}")
    return {"stock_code": stock_code, "price": price}

@router.get("/details/{stock_code}")
async def get_stock_details(stock_code: str) -> Dict:
    """
    Get comprehensive stock details including price, company info, and financial metrics
    """
    details = stock_service.fetch_stock_details(stock_code)
    if "error" in details:
        raise HTTPException(status_code=404, detail=details["error"])
    return details

@router.get("/symbols")
async def get_all_symbols() -> Dict:
    """
    Get all available stock symbols and their company names
    """
    symbols = stock_service.fetch_all_symbols()
    if "error" in symbols:
        raise HTTPException(status_code=500, detail=symbols["error"])
    return {"symbols": symbols}

@router.get("/historical/{stock_code}")
async def get_historical_data(
    stock_code: str,
    start_date: str,
    end_date: str,
    interval: str = "1D"
) -> Dict:
    """
    Get historical price data for a given stock
    """
    historical = stock_service.fetch_historical_data(stock_code, start_date, end_date, interval)
    if "error" in historical:
        raise HTTPException(status_code=404, detail=historical["error"])
    return historical
