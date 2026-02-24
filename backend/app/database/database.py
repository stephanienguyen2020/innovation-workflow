from typing import Any, Callable, Coroutine
from google.cloud.firestore_v1.async_client import AsyncClient
from app.constant.config import GCP_PROJECT_ID, FIRESTORE_DATABASE


class FirestoreSessionManager:
    def __init__(self, project_id: str | None, database: str | None):
        client_kwargs = {}
        if project_id:
            client_kwargs["project"] = project_id
        if database:
            client_kwargs["database"] = database
        self.client = AsyncClient(**client_kwargs)

    async def close(self):
        if self.client is None:
            raise Exception("FirestoreSessionManager is not initialized")
        await self.client.close()
        self.client = None

    async def run_with_session(
        self,
        operation: Callable[[AsyncClient, str, Any], Coroutine],
        session_id: str,
        *args: Any
    ) -> Any:
        return await operation(self.client, session_id, *args)


session_manager = FirestoreSessionManager(GCP_PROJECT_ID, FIRESTORE_DATABASE)


async def get_db():
    try:
        yield session_manager.client
    finally:
        pass


async def run_with_session(
    operation: Callable[[AsyncClient, str, Any], Coroutine],
    session_id: str,
    *args: Any
) -> Any:
    return await session_manager.run_with_session(operation, session_id, *args)


def get_collection(collection_name: str):
    return session_manager.client.collection(collection_name)
    
