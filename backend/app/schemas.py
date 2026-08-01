from datetime import date, datetime, time
from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


WEEKDAYS = {"MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"}


def clean_text(value: str, field_name: str) -> str:
    cleaned = value.strip()
    if not cleaned:
        raise ValueError(f"{field_name} bo'sh bo'lishi mumkin emas")
    return cleaned


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserCreate(BaseModel):
    email: EmailStr
    username: Optional[str] = Field(default=None, max_length=100)
    password: str = Field(min_length=8)
    full_name: str = Field(min_length=2, max_length=255)

    @field_validator("full_name")
    @classmethod
    def validate_full_name(cls, value: str) -> str:
        return clean_text(value, "Ism familiya")


class UserLogin(BaseModel):
    login: str = Field(min_length=1, description="Email or username")
    password: str = Field(min_length=8)


class UserProfile(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: EmailStr
    username: Optional[str] = None
    full_name: str
    is_active: bool
    is_superuser: bool
    telegram_chat_id: Optional[str] = None
    language: str = "uz"
    monthly_fee: int = 0
    created_at: datetime


class UserProfileAdmin(UserProfile):
    group_count: int = 0


class UserUpdateAdmin(BaseModel):
    is_active: Optional[bool] = None
    is_superuser: Optional[bool] = None


class UserUpdate(BaseModel):
    full_name: Optional[str] = Field(default=None, min_length=2, max_length=255)
    telegram_chat_id: Optional[str] = None
    language: Optional[str] = None
    monthly_fee: Optional[int] = Field(default=None, ge=0, le=100_000_000)


class LoginLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: Optional[int] = None
    email: Optional[str] = None
    ip: Optional[str] = None
    user_agent: Optional[str] = None
    success: bool
    created_at: datetime


class GroupBase(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    days_of_week: List[str] = Field(min_length=1, max_length=7)
    lesson_time: Optional[time] = None
    monthly_fee: Optional[int] = Field(default=None, ge=0, le=100_000_000)

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        return clean_text(value, "Guruh nomi")

    @field_validator("days_of_week")
    @classmethod
    def validate_days_of_week(cls, value: List[str]) -> List[str]:
        cleaned_days: List[str] = []
        for day in value:
            cleaned = day.strip().upper()
            if cleaned not in WEEKDAYS:
                raise ValueError(f"Noto'g'ri hafta kuni: {day}")
            if cleaned not in cleaned_days:
                cleaned_days.append(cleaned)
        if not cleaned_days:
            raise ValueError("Kamida bitta dars kuni tanlanishi kerak")
        return cleaned_days


class GroupCreate(GroupBase):
    pass


class GroupUpdate(GroupBase):
    pass


class GroupOut(GroupBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime


class StudentStatus(str, Enum):
    active = "active"
    inactive = "inactive"


class StudentBase(BaseModel):
    full_name: str = Field(min_length=2, max_length=255)
    phone: Optional[str] = Field(default=None, max_length=50)
    parent_name: Optional[str] = Field(default=None, max_length=255)
    parent_phone: Optional[str] = Field(default=None, max_length=50)
    birth_date: Optional[date] = None
    status: Optional[StudentStatus] = StudentStatus.active

    @field_validator("full_name")
    @classmethod
    def validate_full_name(cls, value: str) -> str:
        return clean_text(value, "O'quvchi ismi")

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        cleaned = value.strip()
        return cleaned or None


class StudentCreate(StudentBase):
    pass


class StudentUpdate(StudentBase):
    pass


class StudentOut(StudentBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime


class AttendanceStatus(str, Enum):
    present = "present"
    absent = "absent"
    excused = "excused"


class AttendanceBase(BaseModel):
    student_id: int
    status: Optional[AttendanceStatus] = None
    note: Optional[str] = Field(default=None, max_length=500)


class AttendanceCreate(AttendanceBase):
    date: date


class AttendanceOut(AttendanceBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    group_id: int
    date: date


class AttendanceBatchItem(BaseModel):
    student_id: int
    status: Optional[AttendanceStatus] = None
    note: Optional[str] = Field(default=None, max_length=500)


class AttendanceBatchRequest(BaseModel):
    group_id: int
    date: date
    records: List[AttendanceBatchItem] = Field(min_length=1)


class PasswordChange(BaseModel):
    current_password: str = Field(min_length=1)
    new_password: str = Field(min_length=8)


class LessonTopicCreate(BaseModel):
    date: date
    topic: str = Field(min_length=1, max_length=500)


class LessonTopicOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    group_id: int
    date: date
    topic: str
    created_at: datetime


class ExceptionDayCreate(BaseModel):
    date: date
    reason: Optional[str] = Field(default=None, max_length=255)


class ExceptionDayOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    group_id: int
    date: date
    reason: Optional[str] = None


class PaymentSummary(BaseModel):
    total_income: int = 0
    student_count: int = 0
    payments: List["PaymentOut"]


class PaymentCreate(BaseModel):
    student_id: int
    amount: int
    date: date
    note: Optional[str] = Field(default=None, max_length=500)


class PaymentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    student_id: int
    amount: int
    date: date
    note: Optional[str] = None
    created_at: datetime


class ReceiptOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    group_id: int
    student_id: int
    amount: Optional[int] = None
    status: str
    note: Optional[str] = None
    created_at: datetime
    confirmed_at: Optional[datetime] = None


class ReceiptConfirm(BaseModel):
    amount: int
    date: date


class StudentStats(BaseModel):
    student_id: int
    full_name: str
    total_lessons: int
    present: int
    absent: int
    excused: int
    percentage: float
    monthly: List[dict]


class GradeCreate(BaseModel):
    student_id: int
    date: date
    value: int = Field(ge=2, le=5)


class GradeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    student_id: int
    date: date
    value: int


class DebtorOut(BaseModel):
    student_id: int
    full_name: str
    parent_name: Optional[str] = None
    parent_phone: Optional[str] = None
    fee: int
    paid: int
    due: int


class MonthTotal(BaseModel):
    month: str
    total: int


class MonthRate(BaseModel):
    month: str
    rate: float


class GroupStatsOut(BaseModel):
    id: int
    name: str
    student_count: int
    attendance_rate: float


class StudentStatsOut(BaseModel):
    id: int
    group_id: int
    full_name: str
    present: int
    absent: int
    excused: int
    attendance_rate: float


class StatsOut(BaseModel):
    total_students: int
    month_payments: int
    month_attendance_rate: float
    payments_by_month: List[MonthTotal]
    attendance_by_month: List[MonthRate]
    groups: List[GroupStatsOut]
    students: List[StudentStatsOut]
