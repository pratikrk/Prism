"""add strategy_briefs table

Revision ID: 0004
Revises: 0003
Create Date: 2026-04-30
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "strategy_briefs",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "workspace_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("workspaces.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "plan_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("plans.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "sprint_job_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("jobs.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("clusters", sa.dialects.postgresql.JSONB(), nullable=False, server_default="[]"),
        sa.Column(
            "executive_summary",
            sa.dialects.postgresql.JSONB(),
            nullable=False,
            server_default="[]",
        ),
        sa.Column("share_token", sa.Text(), nullable=False, unique=True),
        sa.Column("status", sa.String(), nullable=False, server_default="draft"),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_strategy_briefs_workspace_id", "strategy_briefs", ["workspace_id"])
    op.create_index("ix_strategy_briefs_share_token", "strategy_briefs", ["share_token"])


def downgrade() -> None:
    op.drop_index("ix_strategy_briefs_share_token", "strategy_briefs")
    op.drop_index("ix_strategy_briefs_workspace_id", "strategy_briefs")
    op.drop_table("strategy_briefs")
