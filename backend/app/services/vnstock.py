from vnstock import Vnstock, Listing
from typing import Dict, Optional, Union

class VNStockService:
    def __init__(self):
        self.stock = Vnstock()
        self.listing = Listing()

    def fetch_stock_price(self, stock_code: str) -> Optional[float]:
        """
        Fetch the current price for a given stock code
        """
        try:
            price_data = self.stock.quote.history(
                symbol=stock_code,
                start="2024-01-01",
                end="2024-12-31",
                interval="1D"
            )
            if not price_data.empty:
                return float(price_data['close'].iloc[-1])
            return None
        except Exception as e:
            print(f"Error fetching stock price: {str(e)}")
            return None

    def fetch_stock_details(self, stock_code: str) -> Dict[str, Union[str, float]]:
        """
        Fetch comprehensive stock details including price, company info, and financial metrics
        """
        try:
            # Fetch price data
            price_data = self.stock.quote.history(
                symbol=stock_code,
                start="2024-01-01",
                end="2024-12-31",
                interval="1D"
            )
            
            # Fetch company profile
            company_data = self.stock.company.profile(symbol=stock_code)
            
            # Fetch financial data
            financial_data = self.stock.finance.balanceSheet(symbol=stock_code)
            
            if price_data.empty or not company_data or not financial_data:
                return {"error": "Incomplete data for the stock symbol"}
            
            latest_price = price_data.iloc[-1]
            
            return {
                "stock_code": stock_code,
                "open": float(latest_price['open']),
                "close": float(latest_price['close']),
                "high": float(latest_price['high']),
                "low": float(latest_price['low']),
                "volume": int(latest_price['volume']),
                "market_cap": company_data.get('market_cap', 'N/A'),
                "eps": financial_data.get('eps', 'N/A'),
                "pe_ratio": financial_data.get('pe_ratio', 'N/A'),
                "pbr": financial_data.get('price_to_book_ratio', 'N/A')
            }
            
        except Exception as e:
            print(f"Error fetching stock details: {str(e)}")
            return {"error": str(e)}

    def fetch_all_symbols(self) -> Dict[str, str]:
        """
        Fetch all available stock symbols and their company names
        """
        try:
            symbols_df = self.listing.all_symbols()
            return dict(zip(symbols_df['symbol'], symbols_df['organ_name']))
        except Exception as e:
            print(f"Error fetching all symbols: {str(e)}")
            return {"error": str(e)}

    def fetch_historical_data(self, stock_code: str, start_date: str, end_date: str, interval: str = "1D") -> Dict:
        """
        Fetch historical price data for a given stock
        """
        try:
            price_data = self.stock.quote.history(
                symbol=stock_code,
                start=start_date,
                end=end_date,
                interval=interval
            )
            
            if price_data.empty:
                return {"error": "No data available for the specified period"}
            
            return {
                "stock_code": stock_code,
                "data": price_data.to_dict('records')
            }
            
        except Exception as e:
            print(f"Error fetching historical data: {str(e)}")
            return {"error": str(e)}
