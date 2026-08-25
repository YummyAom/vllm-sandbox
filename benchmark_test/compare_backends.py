"""
Benchmark Suite for Dashboard Control Plane (Python FastAPI vs Go)
Measures:
1. Docker Image Size (MB)
2. Cold Start Time (seconds to HTTP 200)
3. Idle Memory Footprint (MB)
4. Peak Memory Footprint under load (MB)
5. API Throughput (RPS) and Latency Percentiles (P50, P90, P99) under Concurrency
6. WebSocket Concurrency Handling (100 concurrent connections)
"""

import asyncio
import json
import os
import subprocess
import time
from pathlib import Path
import httpx
import websockets

CONTAINER_NAME = "vllm-dashboard-backend"
BASE_URL = "http://localhost:8080"
WS_URL = "ws://localhost:8080/ws/vllm/logs"
OUTPUT_DIR = Path("/home/yummyaom/Projects/VLLM/benchmark_test")


def get_image_size(container_name: str) -> float:
    """Get Docker image size in MB."""
    try:
        # Get image name
        out = subprocess.check_output(
            ["docker", "inspect", "--format={{.Config.Image}}", container_name],
            text=True,
        ).strip()
        # Get virtual size in bytes
        size_bytes = int(
            subprocess.check_output(
                ["docker", "image", "inspect", "--format={{.Size}}", out],
                text=True,
            ).strip()
        )
        return round(size_bytes / (1024 * 1024), 2)
    except Exception as e:
        print(f"Error getting image size: {e}")
        return 0.0


def get_container_mem_mb(container_name: str) -> float:
    """Get current RAM usage of container in MB."""
    try:
        out = subprocess.check_output(
            ["docker", "stats", container_name, "--no-stream", "--format", "{{.MemUsage}}"],
            text=True,
        ).strip()
        # Format is typically "12.34MiB / 7.89GiB"
        used_part = out.split("/")[0].strip()
        if "GiB" in used_part:
            return round(float(used_part.replace("GiB", "")) * 1024, 2)
        elif "MiB" in used_part:
            return round(float(used_part.replace("MiB", "")), 2)
        elif "kB" in used_part or "KiB" in used_part:
            return round(float(used_part.replace("kB", "").replace("KiB", "")) / 1024, 2)
        return 0.0
    except Exception as e:
        print(f"Error getting mem: {e}")
        return 0.0


def measure_cold_start(service_name: str) -> float:
    """Restart container and measure time until /api/vllm/status returns HTTP 200."""
    print("Measuring cold start time...")
    t0 = time.perf_counter()
    subprocess.check_output(
        ["docker", "restart", CONTAINER_NAME],
        text=True,
    )
    # Poll until ready
    ready = False
    while time.perf_counter() - t0 < 30.0:
        try:
            r = httpx.get(f"{BASE_URL}/api/vllm/status", timeout=1.0)
            if r.status_code == 200:
                ready = True
                break
        except Exception:
            pass
        time.sleep(0.05)
    elapsed = time.perf_counter() - t0
    return round(elapsed, 3) if ready else 999.0


async def benchmark_api(concurrency: int, total_requests: int) -> dict:
    """Benchmark REST API endpoints under high concurrency."""
    print(f"Benchmarking API: {total_requests} requests at {concurrency} concurrency...")
    semaphore = asyncio.Semaphore(concurrency)
    latencies = []
    errors = 0

    async def fetch(client: httpx.AsyncClient):
        nonlocal errors
        async with semaphore:
            t0 = time.perf_counter()
            try:
                r = await client.get(f"{BASE_URL}/api/vllm/status")
                if r.status_code == 200:
                    latencies.append(time.perf_counter() - t0)
                else:
                    errors += 1
            except Exception:
                errors += 1

    t_start = time.perf_counter()
    limits = httpx.Limits(max_keepalive_connections=concurrency, max_connections=concurrency * 2)
    async with httpx.AsyncClient(limits=limits, timeout=10.0) as client:
        tasks = [fetch(client) for _ in range(total_requests)]
        await asyncio.gather(*tasks)
    total_time = time.perf_counter() - t_start

    if not latencies:
        return {"error": "All requests failed"}

    latencies_sorted = sorted(latencies)
    n = len(latencies_sorted)

    def p(pct):
        idx = max(0, int(n * pct / 100) - 1)
        return round(latencies_sorted[idx] * 1000, 2)

    return {
        "concurrency": concurrency,
        "total_requests": total_requests,
        "success_requests": n,
        "errors": errors,
        "total_time_sec": round(total_time, 3),
        "rps": round(n / total_time, 2),
        "latency_p50_ms": p(50),
        "latency_p90_ms": p(90),
        "latency_p99_ms": p(99),
        "latency_avg_ms": round(sum(latencies) / n * 1000, 2),
        "latency_min_ms": round(latencies_sorted[0] * 1000, 2),
        "latency_max_ms": round(latencies_sorted[-1] * 1000, 2),
    }


async def benchmark_websockets(num_clients: int = 100, duration_sec: int = 5) -> dict:
    """Benchmark concurrent WebSocket connections."""
    print(f"Benchmarking WebSockets: {num_clients} concurrent connections for {duration_sec}s...")
    connected = 0
    errors = 0

    async def ws_client():
        nonlocal connected, errors
        try:
            async with websockets.connect(WS_URL, open_timeout=5.0) as ws:
                connected += 1
                t_end = time.perf_counter() + duration_sec
                while time.perf_counter() < t_end:
                    try:
                        await asyncio.wait_for(ws.recv(), timeout=1.0)
                    except (asyncio.TimeoutError, Exception):
                        pass
        except Exception:
            errors += 1

    tasks = [asyncio.create_task(ws_client()) for _ in range(num_clients)]
    await asyncio.gather(*tasks, return_exceptions=True)

    return {
        "attempted_connections": num_clients,
        "successful_connections": connected,
        "failed_connections": errors,
    }


async def main():
    backend_type = os.getenv("BACKEND_TYPE", "Python (FastAPI)")
    out_file = OUTPUT_DIR / ("results_python.json" if "python" in backend_type.lower() else "results_go.json")

    print(f"=== Starting Benchmark Suite for {backend_type} ===")

    # 1. Image Size
    image_size_mb = get_image_size(CONTAINER_NAME)
    print(f"• Docker Image Size: {image_size_mb} MB")

    # 2. Idle Memory
    time.sleep(2)
    idle_mem_mb = get_container_mem_mb(CONTAINER_NAME)
    print(f"• Idle Memory Usage: {idle_mem_mb} MB")

    # 3. Cold Start
    cold_start_sec = measure_cold_start(CONTAINER_NAME)
    print(f"• Cold Start Time: {cold_start_sec} s")
    time.sleep(2)

    # 4. API Load Tests at 3 concurrency levels
    api_bench_50 = await benchmark_api(concurrency=50, total_requests=1000)
    api_bench_100 = await benchmark_api(concurrency=100, total_requests=2000)
    api_bench_200 = await benchmark_api(concurrency=200, total_requests=4000)

    # 5. Peak Memory during load
    peak_mem_mb = get_container_mem_mb(CONTAINER_NAME)
    print(f"• Peak Memory Usage: {peak_mem_mb} MB")

    # 6. WebSocket Concurrency
    ws_bench = await benchmark_websockets(num_clients=100, duration_sec=5)
    print(f"• WS Connected: {ws_bench['successful_connections']}/{ws_bench['attempted_connections']}")

    results = {
        "backend": backend_type,
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        "image_size_mb": image_size_mb,
        "idle_mem_mb": idle_mem_mb,
        "peak_mem_mb": peak_mem_mb,
        "cold_start_sec": cold_start_sec,
        "api_benchmarks": {
            "c50": api_bench_50,
            "c100": api_bench_100,
            "c200": api_bench_200,
        },
        "websocket_benchmark": ws_bench,
    }

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    out_file.write_text(json.dumps(results, indent=2))
    print(f"\n✓ Results saved to {out_file}")


if __name__ == "__main__":
    asyncio.run(main())
