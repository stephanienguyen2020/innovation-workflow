#!/usr/bin/env python3
"""
Migration script: Convert existing 4-stage projects to 5-stage format.

Mapping:
  Old Stage 1 (upload + analysis)  -> New Stage 1 (Research: upload) + New Stage 2 (Understand: analysis)
  Old Stage 2 (problem statements) -> New Stage 3 (Analysis)
  Old Stage 3 (product ideas)      -> New Stage 4 (Ideate)
  Old Stage 4 (chosen solution)    -> New Stage 5 (Evaluate)

Usage:
  cd backend
  python -m scripts.migrate_to_5_stages
"""

import asyncio
import os
import sys
from datetime import datetime

# Add parent directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from google.cloud.firestore_v1.async_client import AsyncClient as FirestoreAsyncClient
from app.constant.config import GCP_PROJECT_ID, FIRESTORE_DATABASE


async def migrate():
    db = FirestoreAsyncClient(
        project=GCP_PROJECT_ID,
        database=FIRESTORE_DATABASE or "(default)",
    )

    projects_ref = db.collection("projects")
    docs = await projects_ref.get()

    migrated = 0
    skipped = 0
    errors = 0

    for doc in docs:
        project_id = doc.id
        data = doc.to_dict()
        stages = data.get("stages", [])

        if len(stages) == 5:
            print(f"  SKIP {project_id} - already 5 stages")
            skipped += 1
            continue

        if len(stages) != 4:
            print(f"  ERROR {project_id} - unexpected {len(stages)} stages")
            errors += 1
            continue

        try:
            old_s1 = stages[0].get("data", {})
            old_s2 = stages[1].get("data", {})
            old_s3 = stages[2].get("data", {})
            old_s4 = stages[3].get("data", {})

            now = datetime.utcnow().isoformat()

            # New Stage 1 (Research)
            new_s1_data = {}
            if data.get("original_filename"):
                new_s1_data["uploaded_documents"] = [{
                    "filename": data.get("original_filename"),
                    "uploaded_at": now,
                    "document_id": data.get("document_id"),
                }]

            # New Stage 2 (Understand)
            new_s2_data = {}
            if old_s1.get("analysis"):
                new_s2_data["analysis"] = old_s1["analysis"]

            # New Stage 3 (Analysis)
            new_s3_data = {}
            if old_s2.get("problem_statements"):
                new_s3_data["problem_statements"] = old_s2["problem_statements"]
            if old_s2.get("custom_problems"):
                new_s3_data["custom_problems"] = old_s2["custom_problems"]

            # New Stage 4 (Ideate)
            new_s4_data = {}
            if old_s3.get("product_ideas"):
                new_s4_data["product_ideas"] = old_s3["product_ideas"]

            # New Stage 5 (Evaluate)
            new_s5_data = {}
            if old_s4.get("chosen_solution"):
                new_s5_data["chosen_solution"] = old_s4["chosen_solution"]

            s1_status = stages[0].get("status", "not_started")
            s2_status = stages[1].get("status", "not_started")
            s3_status = stages[2].get("status", "not_started")
            s4_status = stages[3].get("status", "not_started")

            new_stages = [
                {"stage_number": 1, "status": s1_status, "data": new_s1_data, "created_at": now, "updated_at": now},
                {"stage_number": 2, "status": s1_status, "data": new_s2_data, "created_at": now, "updated_at": now},
                {"stage_number": 3, "status": s2_status, "data": new_s3_data, "created_at": now, "updated_at": now},
                {"stage_number": 4, "status": s3_status, "data": new_s4_data, "created_at": now, "updated_at": now},
                {"stage_number": 5, "status": s4_status, "data": new_s5_data, "created_at": now, "updated_at": now},
            ]

            await projects_ref.document(project_id).update({
                "stages": new_stages,
                "current_iteration": 1,
                "stage_reports": {},
                "feedback_loop_in_progress": False,
                "updated_at": datetime.utcnow(),
            })

            print(f"  OK   {project_id}")
            migrated += 1

        except Exception as e:
            print(f"  ERROR {project_id} - {e}")
            errors += 1

    print(f"\nDone: {migrated} migrated, {skipped} skipped, {errors} errors (total {len(docs)})")
    db.close()


if __name__ == "__main__":
    print("Migrating projects from 4 stages to 5 stages...\n")
    asyncio.run(migrate())
