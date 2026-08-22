# vLLM Architecture and Observability Lab

A containerized, turn-key laboratory and observability playground designed for studying and dissecting the internal architecture of **vLLM**, including **PagedAttention**, **KV-Cache pre-allocation**, **Continuous Batching**, and **GPU memory dynamics**.

---

## Overview

This stack integrates an optimized vLLM OpenAI-compatible inference engine with full-stack telemetry using **NVIDIA DCGM-Exporter**, **Prometheus**, and **Grafana**. It provides complete transparency into both hardware-level GPU behaviors and software-level inference metrics.

```
+----------------------------------------------------------------+
|                          Clients                               |
+-------------------------------+--------------------------------+
                                | HTTP POST /v1/chat/completions
                                v
+----------------------------------------------------------------+
|                        vLLM Engine                             |
|              (Inference, PagedAttention, KV-Cache)             |
+-------------------------------+--------------------------------+
                                | Metrics (:8000/metrics)
+-------------------------------+--------------------------------+
|                    NVIDIA DCGM-Exporter                        |
|                  (GPU Hardware & VRAM Telemetry)               |
+-------------------------------+--------------------------------+
                                | Metrics (:9400/metrics)
                                v
+----------------------------------------------------------------+
|                         Prometheus                             |
|                 (Time-series Metrics Scraper)                  |
+-------------------------------+--------------------------------+
                                |
                                v
+----------------------------------------------------------------+
|                          Grafana                               |
|        (Pre-provisioned Real-time Observability Dashboard)     |
+----------------------------------------------------------------+
```

---

## Key Exploration Areas

1. **VRAM Composition & Memory Allocation Mechanics**
   - **Model Weights & Runtime:** Static memory footprint consumed by the model architecture and PyTorch runtime.
   - **KV-Cache Buffer:** Pre-allocated memory chunk reserved by vLLM for PagedAttention token caching.
   - **Active KV-Cache Usage (%):** Actual percentage of the KV-cache currently storing active request tokens.
   - **Free GPU VRAM:** Unallocated device memory available for other processes.

2. **Prefill vs. Decode Latency Phases**
   - **Time To First Token (TTFT):** Measures prompt evaluation and prefill computation latency.
   - **Inter-Token Latency (ITL / TPOT):** Measures decoding token-by-token generation throughput.

3. **Continuous Batching & Queue Dynamics**
   - Track active requests running simultaneously across engine iterations.
   - Monitor request waiting queues and memory preemption occurrences under heavy load.

---

## Architecture & Tech Stack

| Component | Port | Description |
| :--- | :--- | :--- |
| **vLLM** | `8000` | High-throughput LLM serving engine with OpenAI-compatible API |
| **NVIDIA DCGM-Exporter** | `9400` | Hardware-level GPU telemetry exporter (VRAM, compute, temperature, power) |
| **Prometheus** | `9090` | Time-series metrics collection engine (scrapes every 5 seconds) |
| **Grafana** | `3000` | Real-time visualization dashboard with automated provisioning |

---

## Prerequisites

- **Linux OS** (Ubuntu / Debian / Arch / Fedora)
- **NVIDIA GPU** with proprietary drivers installed
- **NVIDIA Container Toolkit** (`nvidia-docker2`)
- **Docker** and **Docker Compose (v2+)**

To verify NVIDIA Container Toolkit:
```bash
docker run --rm --gpus all nvidia/cuda:12.0.0-base-ubuntu22.04 nvidia-smi
```

---

## Tested Hardware Specifications

This lab was built, benchmarked, and verified on the following hardware environment:

| Component | Specification |
| :--- | :--- |
| **CPU** | AMD Ryzen 9 270 (w/ Radeon 780M Graphics) |
| **System Memory (RAM)** | 32 GB (30.6 GiB Usable) |
| **GPU** | NVIDIA GeForce RTX 5050 Laptop GPU |
| **GPU Memory (VRAM)** | 8 GB GDDR (8,151 MiB) |
| **NVIDIA Driver Version** | 610.57.04 |
| **CUDA Version** | 13.3 |
| **Operating System** | Linux (x86_64) |
| **Tested Baseline Model** | `Qwen/Qwen3-0.6B` / `Qwen/Qwen2.5-0.5B-Instruct` |

---

## Quick Start

### 1. Clone the repository
```bash
git clone <your-repo-url>
cd <repo-folder>
```

### 2. Configure Environment (Optional)
Copy the example environment file:
```bash
cp .env.example .env
```
Edit `.env` to customize your model or Hugging Face access token:
```env
# Required for gated models (e.g. Llama-3, Gemma-2)
HF_TOKEN=

# Model identifier
MODEL_NAME=Qwen/Qwen2.5-0.5B-Instruct

# GPU utilization ratio (0.0 to 1.0)
GPU_MEMORY_UTILIZATION=0.85
```

### 3. Launch the Stack
```bash
docker compose up -d
```

### 4. Access Services
- **vLLM API:** `http://localhost:8000`
- **Grafana Dashboard:** `http://localhost:3000` (User: `admin` / Password: `admin`)
- **Prometheus Metrics:** `http://localhost:9090`

---

## Monitoring with Grafana

The stack comes with a pre-configured dashboard: **vLLM Production Monitoring Dashboard**.

### Key Dashboard Panels:
- **Free GPU VRAM:** Real-time unallocated device memory.
- **Model & Runtime VRAM:** Fixed VRAM consumed by model weights.
- **KV-Cache Buffer Allocated:** Total VRAM reserved for PagedAttention blocks.
- **Active KV-Cache Usage (%):** Percentage of KV-cache currently occupied by active contexts.
- **GPU Temp & Compute Util:** GPU core temperature and utilization.
- **VRAM Memory Breakdown Over Time (Stacked):** Continuous visual representation of memory composition.
- **Token Generation Throughput:** Real-time generation tokens/s and prompt tokens/s.
- **Latency Percentiles:** P95 and P50 Time To First Token (TTFT) and Time Per Output Token.

---

## Testing Inference

Send a chat completion request to the OpenAI-compatible endpoint:

```bash
curl http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "Qwen/Qwen3-0.6B",
    "messages": [
      {"role": "user", "content": "Explain how PagedAttention solves memory fragmentation in LLM inference."}
    ],
    "max_tokens": 256
  }'
```

Streaming response example:
```bash
curl http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "Qwen/Qwen3-0.6B",
    "messages": [{"role": "user", "content": "Write a python function to compute fibonacci numbers."}],
    "stream": true
  }'
```

---

## Memory Optimization & Tuning Guide

### 1. Controlling Total GPU Allocation
By default, vLLM attempts to reserve 85-90% of total VRAM for model weights and KV-cache. If you want to reduce VRAM consumption to leave room for desktop or other workloads:

In `docker-compose.yml`:
```yaml
command:
  - Qwen/Qwen3-0.6B
  - --gpu-memory-utilization
  - "0.40" # Allocates ~40% of total GPU memory
```

### 2. Restricting Context Length
Reduce maximum context length if working with smaller VRAM cards:
```yaml
command:
  - Qwen/Qwen3-0.6B
  - --max-model-len
  - "2048"
```

### 3. Setting Exact KV-Cache Size
You can set an explicit byte size for the KV-cache buffer instead of a percentage ratio:
```yaml
command:
  - Qwen/Qwen3-0.6B
  - --kv-cache-memory
  - "2147483648" # Exactly 2.0 GiB for KV-Cache
```

---

## Directory Structure

```
.
├── docker-compose.yml              # Complete multi-container orchestration definition
├── prometheus.yml                  # Prometheus scrape configurations for vLLM & DCGM
├── .env.example                    # Template for environment variables
├── .gitignore                      # Git ignore rules for ML and runtime data
├── grafana/
│   ├── provisioning/
│   │   ├── datasources/
│   │   │   └── datasource.yml     # Automated Prometheus datasource connection
│   │   └── dashboards/
│   │       └── dashboard.yml      # Dashboard provider configuration
│   └── dashboards/
│       └── vllm-dashboard.json    # Complete pre-built Grafana dashboard definition
└── README.md
```

---

## License

This project is licensed under the MIT License.
