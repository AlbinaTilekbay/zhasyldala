# Make the Celery app available whenever Django starts, so that
# `shared_task` decorators anywhere in the project pick it up.
from .celery import app as celery_app

__all__ = ("celery_app",)
