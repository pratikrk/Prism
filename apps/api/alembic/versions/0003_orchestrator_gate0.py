"""orchestrator gate0 plan columns

Revision ID: 0003
Revises: 0001
Create Date: 2026-04-30
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "0003"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("plans", sa.Column("version", sa.Integer(), nullable=False, server_default="1"))
    op.add_column("plans", sa.Column("feedback", sa.Text(), nullable=True))
    op.add_column(
        "plans",
        sa.Column("plan_status", sa.String(), nullable=False, server_default="draft"),
    )
    op.add_column(
        "plans",
        sa.Column(
            "parent_plan_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("plans.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("plans", "parent_plan_id")
    op.drop_column("plans", "plan_status")
    op.drop_column("plans", "feedback")
    op.drop_column("plans", "version")
