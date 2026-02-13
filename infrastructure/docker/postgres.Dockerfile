FROM postgres:17-alpine

ENV LANG=C.UTF-8
ENV LC_ALL=C.UTF-8

CMD ["postgres", \
  "-c", "shared_buffers=3GB", \
  "-c", "effective_cache_size=9GB", \
  "-c", "maintenance_work_mem=1GB", \
  "-c", "checkpoint_completion_target=0.9", \
  "-c", "wal_buffers=64MB", \
  "-c", "default_statistics_target=100", \
  "-c", "random_page_cost=1.1", \
  "-c", "effective_io_concurrency=200", \
  "-c", "work_mem=32MB", \
  "-c", "min_wal_size=2GB", \
  "-c", "max_wal_size=8GB", \
  "-c", "max_connections=300", \
  "-c", "max_worker_processes=6", \
  "-c", "max_parallel_workers_per_gather=3", \
  "-c", "max_parallel_workers=6", \
  "-c", "max_parallel_maintenance_workers=2"]
