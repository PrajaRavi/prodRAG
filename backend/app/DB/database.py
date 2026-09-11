# database.py

from psycopg_pool import AsyncConnectionPool
from psycopg.rows import dict_row
from dotenv import load_dotenv
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
import os
load_dotenv()
DB_URI=os.getenv("DB_URI")

class Database:
    def __init__(self):
        self.pool = None
        self.checkpointer = None

    async def connect(self):
        connection_kwargs = {
            "autocommit": True,
            "prepare_threshold": 0,
            "row_factory": dict_row,
        }

        self.pool = AsyncConnectionPool(
            conninfo=DB_URI,
            min_size=2,
            max_size=10,
            kwargs=connection_kwargs,
            open=False,
        )

        await self.pool.open()

        self.checkpointer = AsyncPostgresSaver(
            self.pool
        )

        await self.checkpointer.setup()

        print("✅ PostgreSQL connection pool started")

        return self.checkpointer

    async def close(self):
        if self.pool:
            await self.pool.close()

            print("🔴 PostgreSQL connection pool closed")


db = Database()