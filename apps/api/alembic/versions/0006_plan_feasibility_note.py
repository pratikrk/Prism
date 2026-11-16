"""add feasibility_note to plans

Revision ID: 0006
Revises: 0005
Create Date: 2026-05-03
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("plans", sa.Column("feasibility_note", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("plans", "feasibility_note")
