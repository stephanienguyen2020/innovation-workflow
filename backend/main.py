from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from app.constant.config import SECRET_KEY
from app.routers import conversation, rag, auth
from starlette.middleware.sessions import SessionMiddleware
from app.database.database import session_manager
from contextlib import asynccontextmanager
from app.middleware.auth import verify_jwt_token

@asynccontextmanager
async def lifespan(app: FastAPI):  
    # Initialize MongoDB collections
    await session_manager.create_collections([
        "messages",        # For storing chat messages
        "conversations",   # For tracking conversation metadata
        "sessions",        # For user session information
        "rag_documents"    # For RAG document storage with vector embeddings
    ])
    
    # Initialize RAG service
    from app.services.rag_service import rag_service
    await rag_service.initialize()
    
    yield
    # Close MongoDB connection when app shuts down
    if session_manager.client is not None:
        await session_manager.close()
        
        
app = FastAPI(lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'], #  allows requests from any origin 
    allow_credentials=True,
    allow_methods=['*'], # allows all HTTP methods
    allow_headers=['*'], # allows all headers
)
app.add_middleware(SessionMiddleware, secret_key=SECRET_KEY)
#app.add_middleware(APIGatewayMiddleware)

# Add a basic health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint to verify the API is running."""
    return {"status": "ok", "database": "mongodb"}

# router_list = [
#     conversation.router,
#     rag.router,
#     auth.router,
# ]

# for router in router_list:
#     app.include_router(router=router)


app.include_router(conversation.router, dependencies=[Depends(verify_jwt_token)])
app.include_router(rag.router, dependencies=[Depends(verify_jwt_token)])
#app.include_router(stock.router)
app.include_router(auth.router)

    
