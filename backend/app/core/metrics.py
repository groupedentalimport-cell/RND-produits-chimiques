"""
Prometheus Metrics Endpoint for ChemStab Industrial.
Exposes application metrics for monitoring and alerting.
"""

import time
from typing import Dict
from collections import defaultdict
from fastapi import Request, Response


class MetricsCollector:
    """Collect and expose Prometheus metrics."""

    def __init__(self):
        self._request_count: Dict[str, int] = defaultdict(int)
        self._request_duration: Dict[str, list] = defaultdict(list)
        self._error_count: Dict[str, int] = defaultdict(int)
        self._start_time = time.time()

    def record_request(self, method: str, path: str, status: int, duration: float):
        """Record a request metric."""
        key = f"{method}:{path}"
        self._request_count[key] += 1
        self._request_duration[key].append(duration)
        if status >= 400:
            self._error_count[f"{status}"] += 1

    def get_metrics(self) -> str:
        """Generate Prometheus metrics text."""
        lines = []
        uptime = time.time() - self._start_time

        # Uptime
        lines.append("# HELP chemstab_uptime_seconds Application uptime in seconds")
        lines.append("# TYPE chemstab_uptime_seconds gauge")
        lines.append(f"chemstab_uptime_seconds {uptime:.1f}")

        # Request counts
        lines.append("# HELP chemstab_requests_total Total number of requests")
        lines.append("# TYPE chemstab_requests_total counter")
        for key, count in self._request_count.items():
            method, path = key.split(":", 1)
            lines.append(f'chemstab_requests_total{{method="{method}",path="{path}"}} {count}')

        # Request duration
        lines.append("# HELP chemstab_request_duration_seconds Request duration in seconds")
        lines.append("# TYPE chemstab_request_duration_seconds summary")
        for key, durations in self._request_duration.items():
            if durations:
                method, path = key.split(":", 1)
                avg = sum(durations) / len(durations)
                lines.append(f'chemstab_request_duration_seconds{{method="{method}",path="{path}",quantile="0.5"}} {avg:.4f}')
                lines.append(f'chemstab_request_duration_seconds{{method="{method}",path="{path}",quantile="0.99"}} {max(durations):.4f}')

        # Error counts
        lines.append("# HELP chemstab_errors_total Total number of errors")
        lines.append("# TYPE chemstab_errors_total counter")
        for status, count in self._error_count.items():
            lines.append(f'chemstab_errors_total{{status="{status}"}} {count}')

        return "\n".join(lines) + "\n"


# Global singleton
metrics = MetricsCollector()


def metrics_endpoint():
    """Return Prometheus metrics."""
    return Response(
        content=metrics.get_metrics(),
        media_type="text/plain; version=0.0.4; charset=utf-8",
    )
