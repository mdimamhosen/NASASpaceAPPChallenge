# EONET durable cache

The Nest API stores full NASA EONET v3 payloads here (and in Postgres when `DATABASE_URL` is set).

- Written whenever an upstream fetch succeeds.
- Kept until the content hash changes.
- Served when NASA is unreachable (mobile data drops, 503, timeouts).

Do not hand-edit JSON in this folder; the API owns it.
