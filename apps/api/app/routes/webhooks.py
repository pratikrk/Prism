from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.db import get_session
from app.models import Organization, OrganizationMembership, User

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


@router.post("/clerk")
async def clerk_webhook(
    request: Request,
    session: AsyncSession = Depends(get_session),
) -> dict:
    # TODO(security): verify Svix signature with CLERK_WEBHOOK_SECRET before merging Stripe.
    # Foundation accepts unverified payloads to keep local dev simple; add verification
    # in Billing sub-project (7) before public deploy.
    if settings.clerk_webhook_secret is None:
        pass  # local dev
    body = await request.json()
    event_type = body.get("type")
    data = body.get("data", {})

    if event_type == "user.created":
        u = User(
            id=data["id"],
            email=data.get("email_addresses", [{}])[0].get("email_address", ""),
            name=f"{data.get('first_name', '')} {data.get('last_name', '')}".strip(),
        )
        await session.merge(u)
    elif event_type == "organization.created":
        o = Organization(id=data["id"], name=data["name"])
        await session.merge(o)
    elif event_type == "organizationMembership.created":
        m = OrganizationMembership(
            user_id=data["public_user_data"]["user_id"],
            org_id=data["organization"]["id"],
            role=data.get("role", "member"),
        )
        await session.merge(m)
    else:
        return {"ok": True, "ignored": event_type}

    await session.commit()
    return {"ok": True, "type": event_type}
