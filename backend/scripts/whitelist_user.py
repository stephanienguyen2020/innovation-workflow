"""
Script to whitelist a user email in the Firestore database.
Usage: python scripts/whitelist_user.py <email>

Example: python scripts/whitelist_user.py tn2510@columbia.edu
"""
import asyncio
import sys
import os

# Add project root to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

from google.cloud.firestore_v1 import AsyncClient, ArrayUnion

async def whitelist_email(email: str):
    if "@" not in email:
        print(f"Invalid email: {email}")
        return

    username, domain = email.split("@", 1)

    project_id = os.getenv("GOOGLE_CLOUD_PROJECT")
    database = os.getenv("FIRESTORE_DATABASE", "(default)")

    db = AsyncClient(project=project_id, database=database)

    doc_ref = db.collection("allowed_emails").document("email_whitelist")

    # Add both username and domain (ArrayUnion won't duplicate)
    await doc_ref.set(
        {
            "allowed_usernames": ArrayUnion([username]),
            "allowed_domains": ArrayUnion([domain]),
        },
        merge=True,
    )

    # Verify
    doc = await doc_ref.get()
    data = doc.to_dict()
    print(f"Whitelisted: {email}")
    print(f"  Username '{username}' in allowed_usernames: {username in data.get('allowed_usernames', [])}")
    print(f"  Domain '{domain}' in allowed_domains: {domain in data.get('allowed_domains', [])}")
    print(f"\nCurrent allowed_usernames ({len(data.get('allowed_usernames', []))} total)")
    print(f"Current allowed_domains: {data.get('allowed_domains', [])}")

    db.close()

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python scripts/whitelist_user.py <email>")
        print("Example: python scripts/whitelist_user.py tn2510@columbia.edu")
        sys.exit(1)

    asyncio.run(whitelist_email(sys.argv[1]))
