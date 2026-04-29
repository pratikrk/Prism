"""Initial schema: extensions, users, orgs, workspaces, jobs, plans, NOTIFY trigger.

Revision ID: 0001
Revises:
Create Date: 2026-04-22
"""
from __future__ import annotations

import uuid
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Extensions
    op.execute('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')
    op.execute('CREATE EXTENSION IF NOT EXISTS "pgcrypto"')
    op.execute('CREATE EXTENSION IF NOT EXISTS "vector"')

    # users
    op.create_table(
        "users",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("email", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=False, server_default=""),
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
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
    )

    # organizations
    op.create_table(
        "organizations",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
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
        sa.PrimaryKeyConstraint("id"),
    )

    # organization_memberships
    op.create_table(
        "organization_memberships",
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("org_id", sa.String(), nullable=False),
        sa.Column("role", sa.String(), nullable=False, server_default="member"),
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
        sa.ForeignKeyConstraint(["org_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id", "org_id"),
    )

    # workspaces
    op.create_table(
        "workspaces",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("org_id", sa.String(), nullable=True),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("domain", sa.String(), nullable=False),
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
        sa.ForeignKeyConstraint(["org_id"], ["organizations.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_workspaces_user", "workspaces", ["user_id"])
    op.create_index(
        "ix_workspaces_org",
        "workspaces",
        ["org_id"],
        postgresql_where=sa.text("org_id IS NOT NULL"),
    )

    # jobs
    op.create_table(
        "jobs",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("workspace_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("parent_job_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("type", sa.String(), nullable=False),
        sa.Column("status", sa.String(), nullable=False, server_default="pending"),
        sa.Column("input", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column("result", postgresql.JSONB(), nullable=True),
        sa.Column("error", postgresql.JSONB(), nullable=True),
        sa.Column("celery_task_id", sa.String(), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
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
        sa.ForeignKeyConstraint(["parent_job_id"], ["jobs.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_jobs_workspace_created", "jobs", ["workspace_id", "created_at"])
    op.create_index("ix_jobs_parent", "jobs", ["parent_job_id"])
    op.create_index(
        "ix_jobs_active",
        "jobs",
        ["status", "type"],
        postgresql_where=sa.text("status IN ('pending', 'running')"),
    )
    op.create_index(
        "ix_jobs_result_gin",
        "jobs",
        ["result"],
        postgresql_using="gin",
    )

    # plans
    op.create_table(
        "plans",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("job_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("workspace_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("intent", sa.String(), nullable=False),
        sa.Column("domain", sa.String(), nullable=False),
        sa.Column("competitors", postgresql.JSONB(), nullable=False, server_default="[]"),
        sa.Column("timeline_weeks", sa.Integer(), nullable=False),
        sa.Column("sprint_order", postgresql.JSONB(), nullable=False, server_default="[]"),
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
        sa.ForeignKeyConstraint(["job_id"], ["jobs.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["workspace_id"], ["workspaces.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("job_id"),
    )

    # NOTIFY trigger for SSE — split into two op.execute calls (asyncpg forbids
    # multiple statements in a single prepared statement)
    op.execute("""
        CREATE OR REPLACE FUNCTION notify_job_event() RETURNS trigger AS $$
        DECLARE
          payload jsonb;
        BEGIN
          IF (TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status)
             OR TG_OP = 'INSERT' THEN
            payload := jsonb_build_object(
              'job_id', NEW.id,
              'parent_job_id', NEW.parent_job_id,
              'workspace_id', NEW.workspace_id,
              'type', NEW.type,
              'status', NEW.status,
              'at', now(),
              'error', NEW.error
            );
            PERFORM pg_notify('job_events', payload::text);
          END IF;
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql
    """)
    op.execute("""
        CREATE TRIGGER jobs_notify_event
          AFTER INSERT OR UPDATE OF status ON jobs
          FOR EACH ROW EXECUTE FUNCTION notify_job_event()
    """)


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS jobs_notify_event ON jobs")
    op.execute("DROP FUNCTION IF EXISTS notify_job_event()")
    op.drop_table("plans")
    op.drop_index("ix_jobs_result_gin", table_name="jobs")
    op.drop_index("ix_jobs_active", table_name="jobs")
    op.drop_index("ix_jobs_parent", table_name="jobs")
    op.drop_index("ix_jobs_workspace_created", table_name="jobs")
    op.drop_table("jobs")
    op.drop_index("ix_workspaces_org", table_name="workspaces")
    op.drop_index("ix_workspaces_user", table_name="workspaces")
    op.drop_table("workspaces")
    op.drop_table("organization_memberships")
    op.drop_table("organizations")
    op.drop_table("users")
