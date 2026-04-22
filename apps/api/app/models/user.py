from __future__ import annotations

from sqlalchemy import ForeignKey, PrimaryKeyConstraint, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ._base import Base, TimestampMixin


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String, primary_key=True)  # Clerk user_id
    email: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String, default="", nullable=False)


class Organization(Base, TimestampMixin):
    __tablename__ = "organizations"
    id: Mapped[str] = mapped_column(String, primary_key=True)  # Clerk org_id
    name: Mapped[str] = mapped_column(String, nullable=False)


class OrganizationMembership(Base, TimestampMixin):
    __tablename__ = "organization_memberships"
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    org_id: Mapped[str] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"))
    role: Mapped[str] = mapped_column(String, default="member", nullable=False)
    __table_args__ = (PrimaryKeyConstraint("user_id", "org_id"),)
