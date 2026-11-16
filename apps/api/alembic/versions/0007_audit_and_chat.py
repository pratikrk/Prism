"""audit_results table with notify trigger.

Revision ID: 0007
Revises: 0006
Create Date: 2026-05-05
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "audit_results",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("workspace_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("result", postgresql.JSONB(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["workspace_id"], ["workspaces.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("workspace_id", name="uq_audit_results_workspace"),
    )
    op.create_index("ix_audit_results_workspace", "audit_results", ["workspace_id"])

    # Notify trigger so SSE can push audit completion to the browser
    op.execute("""
        CREATE OR REPLACE FUNCTION notify_audit_event() RETURNS trigger AS $$
        BEGIN
          PERFORM pg_notify('job_events', jsonb_build_object(
            'type', 'audit',
            'workspace_id', NEW.workspace_id,
            'at', now()
          )::text);
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql
    """)
    op.execute("""
        CREATE TRIGGER audit_results_notify_event
          AFTER INSERT OR UPDATE ON audit_results
          FOR EACH ROW EXECUTE FUNCTION notify_audit_event()
    """)


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS audit_results_notify_event ON audit_results")
    op.execute("DROP FUNCTION IF EXISTS notify_audit_event()")
    op.drop_index("ix_audit_results_workspace", table_name="audit_results")
    op.drop_table("audit_results")
