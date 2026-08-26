FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1

WORKDIR /app

# libgl1/libglib for opencv-python-headless; libpq-dev for psycopg2 build
# (skip if you switch to psycopg2-binary only, which is what requirements.txt uses).
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt requirements-ml.txt ./
RUN pip install --no-cache-dir -r requirements.txt
# ML deps are large (torch); split into their own layer so app-only code
# changes don't invalidate this cache.
RUN pip install --no-cache-dir -r requirements-ml.txt

COPY . .

RUN python manage.py collectstatic --noinput || true

EXPOSE 8000
CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "3"]
