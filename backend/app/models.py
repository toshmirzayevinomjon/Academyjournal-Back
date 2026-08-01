from enum import Enum
from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    Time,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    username = Column(String(100), unique=True, index=True, nullable=True)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    is_superuser = Column(Boolean, default=False, nullable=False)
    telegram_chat_id = Column(String(255), nullable=True)
    language = Column(String(10), default="uz", nullable=False)
    monthly_fee = Column(Integer, default=0, nullable=False)
    card_number = Column(String(50), nullable=True)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    groups = relationship("Group", back_populates="owner", cascade="all, delete")


class EmailCode(Base):
    __tablename__ = "email_codes"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), index=True, nullable=False)
    code = Column(String(10), nullable=False)
    purpose = Column(String(20), nullable=False)  # 'register' | 'reset'
    expires_at = Column(DateTime(timezone=True), nullable=False)
    used = Column(Boolean, default=False, nullable=False)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class Group(Base):
    __tablename__ = "groups"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name = Column(String(255), nullable=False)
    days_of_week = Column(JSON, nullable=False, default=list)
    lesson_time = Column(Time, nullable=True)
    monthly_fee = Column(Integer, default=0, nullable=False)
    is_archived = Column(Boolean, default=False, nullable=False)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    owner = relationship("User", back_populates="groups")
    students = relationship("Student", back_populates="group", cascade="all, delete")
    attendances = relationship(
        "Attendance", back_populates="group", cascade="all, delete"
    )
    lesson_topics = relationship(
        "LessonTopic", back_populates="group", cascade="all, delete"
    )


class StudentStatus(str, Enum):
    active = "active"
    inactive = "inactive"


class Student(Base):
    __tablename__ = "students"

    id = Column(Integer, primary_key=True, index=True)
    group_id = Column(
        Integer, ForeignKey("groups.id", ondelete="CASCADE"), nullable=False, index=True
    )
    full_name = Column(String(255), nullable=False)
    phone = Column(String(50), nullable=True)
    parent_name = Column(String(255), nullable=True)
    parent_phone = Column(String(50), nullable=True)
    birth_date = Column(Date, nullable=True)
    status = Column(String(50), nullable=False, default=StudentStatus.active.value)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    group = relationship("Group", back_populates="students")
    attendances = relationship(
        "Attendance", back_populates="student", cascade="all, delete"
    )
    payments = relationship("Payment", back_populates="student", cascade="all, delete")


class AttendanceStatus(str, Enum):
    present = "present"
    absent = "absent"
    excused = "excused"


class LessonTopic(Base):
    __tablename__ = "lesson_topics"

    id = Column(Integer, primary_key=True, index=True)
    group_id = Column(
        Integer, ForeignKey("groups.id", ondelete="CASCADE"), nullable=False, index=True
    )
    date = Column(Date, nullable=False, index=True)
    topic = Column(Text, nullable=False)
    homework = Column(Text, nullable=True)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    group = relationship("Group", back_populates="lesson_topics")


class Attendance(Base):
    __tablename__ = "attendance"
    __table_args__ = (
        UniqueConstraint(
            "group_id", "student_id", "date", name="uq_attendance_group_student_date"
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    group_id = Column(
        Integer, ForeignKey("groups.id", ondelete="CASCADE"), nullable=False, index=True
    )
    student_id = Column(
        Integer,
        ForeignKey("students.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    date = Column(Date, nullable=False, index=True)
    status = Column(String(50), nullable=False)
    note = Column(Text, nullable=True)

    group = relationship("Group", back_populates="attendances")
    student = relationship("Student", back_populates="attendances")


class ExceptionDay(Base):
    __tablename__ = "exception_days"

    id = Column(Integer, primary_key=True, index=True)
    group_id = Column(
        Integer, ForeignKey("groups.id", ondelete="CASCADE"), nullable=False, index=True
    )
    date = Column(Date, nullable=False, index=True)
    reason = Column(String(255), nullable=True)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class Payment(Base):
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True, index=True)
    group_id = Column(
        Integer, ForeignKey("groups.id", ondelete="CASCADE"), nullable=False, index=True
    )
    student_id = Column(
        Integer,
        ForeignKey("students.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    amount = Column(Integer, nullable=False)
    date = Column(Date, nullable=False, index=True)
    note = Column(Text, nullable=True)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    group = relationship("Group")
    student = relationship("Student", back_populates="payments")


class PaymentReceipt(Base):
    __tablename__ = "payment_receipts"

    id = Column(Integer, primary_key=True, index=True)
    group_id = Column(
        Integer, ForeignKey("groups.id", ondelete="CASCADE"), nullable=False, index=True
    )
    student_id = Column(
        Integer,
        ForeignKey("students.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    chat_id = Column(String(255), nullable=True)
    amount = Column(Integer, nullable=True)
    photo_path = Column(String(512), nullable=True)
    status = Column(String(20), nullable=False, default="pending")
    note = Column(Text, nullable=True)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    confirmed_at = Column(DateTime(timezone=True), nullable=True)
    confirmed_by = Column(Integer, nullable=True)

    group = relationship("Group")
    student = relationship("Student")


class ParentLink(Base):
    __tablename__ = "parent_links"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(
        Integer,
        ForeignKey("students.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    chat_id = Column(String(255), nullable=False, index=True)
    phone = Column(String(50), nullable=False)
    language = Column(String(10), default="uz", nullable=False)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    student = relationship("Student")


class LoginLog(Base):
    __tablename__ = "login_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True)
    email = Column(String(255), nullable=True)
    ip = Column(String(64), nullable=True)
    user_agent = Column(String(512), nullable=True)
    success = Column(Boolean, default=True, nullable=False)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class Grade(Base):
    __tablename__ = "grades"
    __table_args__ = (
        UniqueConstraint("student_id", "date", name="uq_grade_student_date"),
    )

    id = Column(Integer, primary_key=True, index=True)
    group_id = Column(
        Integer, ForeignKey("groups.id", ondelete="CASCADE"), nullable=False, index=True
    )
    student_id = Column(
        Integer,
        ForeignKey("students.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    date = Column(Date, nullable=False, index=True)
    value = Column(Integer, nullable=False)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    group = relationship("Group")
    student = relationship("Student")
