from calendar import monthrange
from datetime import date, datetime, timedelta
from typing import List, Optional
from sqlalchemy.orm import Session
from . import models, schemas, auth


def get_user_by_email(db: Session, email: str) -> Optional[models.User]:
    return db.query(models.User).filter(models.User.email == email).first()


def get_user_by_username(db: Session, username: str) -> Optional[models.User]:
    return db.query(models.User).filter(models.User.username == username).first()


def create_email_code(db: Session, email: str, purpose: str) -> str:
    import random

    db.query(models.EmailCode).filter(
        models.EmailCode.email == email, models.EmailCode.purpose == purpose
    ).delete()
    db.commit()
    code = str(random.randint(100000, 999999))
    db.add(
        models.EmailCode(
            email=email,
            code=code,
            purpose=purpose,
            expires_at=datetime.utcnow() + timedelta(minutes=15),
        )
    )
    db.commit()
    return code


def verify_email_code(
    db: Session, email: str, purpose: str, code: str
) -> Optional[models.EmailCode]:
    record = (
        db.query(models.EmailCode)
        .filter(
            models.EmailCode.email == email,
            models.EmailCode.purpose == purpose,
            models.EmailCode.code == code,
            models.EmailCode.used == False,
            models.EmailCode.expires_at > datetime.utcnow(),
        )
        .first()
    )
    if record:
        record.used = True
        db.commit()
    return record


def create_user(
    db: Session,
    user_in: schemas.UserCreate,
    is_superuser: bool = False,
    is_active: bool = True,
) -> models.User:
    user = models.User(
        email=user_in.email,
        username=user_in.username.strip() if user_in.username else None,
        password_hash=auth.hash_password(user_in.password),
        full_name=user_in.full_name.strip(),
        is_active=is_active,
        is_superuser=is_superuser,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def get_groups_for_user(
    db: Session, user_id: int, include_archived: bool = False
) -> List[models.Group]:
    q = db.query(models.Group).filter(models.Group.user_id == user_id)
    if not include_archived:
        q = q.filter(models.Group.is_archived == False)
    return q.order_by(models.Group.created_at.desc()).all()


def get_group_by_id(db: Session, group_id: int, user_id: int) -> Optional[models.Group]:
    return (
        db.query(models.Group)
        .filter(models.Group.id == group_id, models.Group.user_id == user_id)
        .first()
    )


def create_group(
    db: Session, user_id: int, group_in: schemas.GroupCreate
) -> models.Group:
    group = models.Group(
        user_id=user_id,
        name=group_in.name.strip(),
        days_of_week=group_in.days_of_week,
        lesson_time=group_in.lesson_time,
        monthly_fee=group_in.monthly_fee or 0,
    )
    db.add(group)
    db.commit()
    db.refresh(group)
    return group


def update_group(
    db: Session, group: models.Group, group_in: schemas.GroupUpdate
) -> models.Group:
    group.name = group_in.name.strip()
    group.days_of_week = group_in.days_of_week
    group.lesson_time = group_in.lesson_time
    if group_in.monthly_fee is not None:
        group.monthly_fee = group_in.monthly_fee
    db.commit()
    db.refresh(group)
    return group


def delete_group(db: Session, group: models.Group) -> None:
    db.delete(group)
    db.commit()


def get_students_by_group(db: Session, group_id: int) -> List[models.Student]:
    return (
        db.query(models.Student)
        .filter(models.Student.group_id == group_id)
        .order_by(models.Student.created_at.asc())
        .all()
    )


def get_student_by_id(
    db: Session, student_id: int, group_id: int
) -> Optional[models.Student]:
    return (
        db.query(models.Student)
        .filter(models.Student.id == student_id, models.Student.group_id == group_id)
        .first()
    )


def create_student(
    db: Session, group_id: int, student_in: schemas.StudentCreate
) -> models.Student:
    student = models.Student(
        group_id=group_id,
        full_name=student_in.full_name.strip(),
        phone=student_in.phone,
        status=(student_in.status or schemas.StudentStatus.active).value,
    )
    db.add(student)
    db.commit()
    db.refresh(student)
    return student


def update_student(
    db: Session, student: models.Student, student_in: schemas.StudentUpdate
) -> models.Student:
    student.full_name = student_in.full_name.strip()
    student.phone = student_in.phone
    student.parent_name = student_in.parent_name
    student.parent_phone = student_in.parent_phone
    student.birth_date = student_in.birth_date
    student.status = (student_in.status or schemas.StudentStatus.active).value
    db.commit()
    db.refresh(student)
    return student


def bulk_create_students(
    db: Session, group_id: int, students_data: List[dict]
) -> List[models.Student]:
    created: List[models.Student] = []
    for data in students_data:
        student = models.Student(
            group_id=group_id,
            full_name=data["full_name"].strip(),
            phone=data.get("phone"),
            parent_name=data.get("parent_name"),
            parent_phone=data.get("parent_phone"),
            birth_date=data.get("birth_date") or None,
            status=models.StudentStatus.active.value,
        )
        db.add(student)
        created.append(student)
    db.commit()
    for s in created:
        db.refresh(s)
    return created


def batch_update_student_status(
    db: Session, group_id: int, student_ids: List[int], status: str
) -> List[models.Student]:
    students = (
        db.query(models.Student)
        .filter(
            models.Student.group_id == group_id,
            models.Student.id.in_(student_ids),
        )
        .all()
    )
    for s in students:
        s.status = status
    db.commit()
    for s in students:
        db.refresh(s)
    return students


def delete_student(db: Session, student: models.Student) -> None:
    db.delete(student)
    db.commit()


def get_attendance_for_group_month(
    db: Session, group_id: int, year: int, month: int
) -> List[models.Attendance]:
    query = db.query(models.Attendance).filter(models.Attendance.group_id == group_id)
    if year and month:
        last_day = monthrange(year, month)[1]
        query = query.filter(
            models.Attendance.date >= date(year, month, 1),
            models.Attendance.date <= date(year, month, last_day),
        )
    return query.order_by(models.Attendance.date.asc()).all()


def get_lesson_topics(
    db: Session, group_id: int, year: int, month: int
) -> List[models.LessonTopic]:
    last_day = monthrange(year, month)[1]
    return (
        db.query(models.LessonTopic)
        .filter(
            models.LessonTopic.group_id == group_id,
            models.LessonTopic.date >= date(year, month, 1),
            models.LessonTopic.date <= date(year, month, last_day),
        )
        .order_by(models.LessonTopic.date.asc())
        .all()
    )


def upsert_lesson_topic(
    db: Session, group_id: int, topic_in: schemas.LessonTopicCreate
) -> models.LessonTopic:
    existing = (
        db.query(models.LessonTopic)
        .filter(
            models.LessonTopic.group_id == group_id,
            models.LessonTopic.date == topic_in.date,
        )
        .first()
    )
    if existing:
        existing.topic = topic_in.topic
    else:
        existing = models.LessonTopic(
            group_id=group_id, date=topic_in.date, topic=topic_in.topic
        )
        db.add(existing)
    db.commit()
    db.refresh(existing)
    return existing


def batch_save_attendance(
    db: Session,
    group_id: int,
    date_value: date,
    records: List[schemas.AttendanceBatchItem],
) -> List[models.Attendance]:
    saved: List[models.Attendance] = []
    for record in records:
        attendance = (
            db.query(models.Attendance)
            .filter(
                models.Attendance.group_id == group_id,
                models.Attendance.student_id == record.student_id,
                models.Attendance.date == date_value,
            )
            .first()
        )
        if record.status is None:
            if attendance:
                db.delete(attendance)
            continue
        if attendance:
            attendance.status = record.status.value
            attendance.note = record.note
        else:
            attendance = models.Attendance(
                group_id=group_id,
                student_id=record.student_id,
                date=date_value,
                status=record.status.value,
                note=record.note,
            )
            db.add(attendance)
        saved.append(attendance)
    db.commit()
    return saved


def get_exception_days_for_month(
    db: Session, group_id: int, year: int, month: int
) -> List[models.ExceptionDay]:
    from calendar import monthrange

    return (
        db.query(models.ExceptionDay)
        .filter(
            models.ExceptionDay.group_id == group_id,
            models.ExceptionDay.date >= date(year, month, 1),
            models.ExceptionDay.date <= date(year, month, monthrange(year, month)[1]),
        )
        .all()
    )


def get_grades_for_month(
    db: Session, group_id: int, year: int, month: int
) -> List[models.Grade]:
    last_day = monthrange(year, month)[1]
    return (
        db.query(models.Grade)
        .filter(
            models.Grade.group_id == group_id,
            models.Grade.date >= date(year, month, 1),
            models.Grade.date <= date(year, month, last_day),
        )
        .order_by(models.Grade.date.asc())
        .all()
    )


def upsert_grade(
    db: Session, group_id: int, grade_in: schemas.GradeCreate
) -> models.Grade:
    existing = (
        db.query(models.Grade)
        .filter(
            models.Grade.group_id == group_id,
            models.Grade.student_id == grade_in.student_id,
            models.Grade.date == grade_in.date,
        )
        .first()
    )
    if existing:
        existing.value = grade_in.value
    else:
        existing = models.Grade(
            group_id=group_id,
            student_id=grade_in.student_id,
            date=grade_in.date,
            value=grade_in.value,
        )
        db.add(existing)
    db.commit()
    db.refresh(existing)
    return existing


def delete_grade(db: Session, group_id: int, student_id: int, date_value: date) -> bool:
    grade = (
        db.query(models.Grade)
        .filter(
            models.Grade.group_id == group_id,
            models.Grade.student_id == student_id,
            models.Grade.date == date_value,
        )
        .first()
    )
    if not grade:
        return False
    db.delete(grade)
    db.commit()
    return True
