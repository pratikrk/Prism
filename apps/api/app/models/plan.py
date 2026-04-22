from __future__ import annotations

import uuid

from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from ._base import Base, TimestampMixin


class Plan(Base, TimestampMixin):
    __tablename__ = "plans"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    job_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("jobs.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    workspace_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False
    )
    intent: Mapped[str] = mapped_column(String, nullable=False)
    domain: Mapped[str] = mapped_column(String, nullable=False)
    competitors: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    timeline_weeks: Mapped[int] = mapped_column(Integer, nullable=False)
    sprint_order: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
