"""add traffic_target to plans

Revision ID: 0005
Revises: 0004
Create Date: 2026-05-03
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("plans", sa.Column("traffic_target", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("plans", "traffic_target")
