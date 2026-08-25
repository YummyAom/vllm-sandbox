"""
Generate Presentation Ready Comparison Charts (Python vs Go Backend)
Produces high-resolution PNG charts in benchmark_test/backend_comparison.png
"""

import json
from pathlib import Path
import matplotlib.pyplot as plt
import numpy as np

DATA_DIR = Path("/home/yummyaom/Projects/VLLM/benchmark_test")
PY_DATA = json.loads((DATA_DIR / "results_python.json").read_text())
GO_DATA = json.loads((DATA_DIR / "results_go.json").read_text())

# Set modern dark styling for presentation
plt.style.use("dark_background")
fig, axs = plt.subplots(2, 2, figsize=(14, 10), dpi=300)
fig.suptitle("vLLM Control Plane: Python (FastAPI) vs Go (Golang) Empirical Evaluation", fontsize=16, fontweight="bold", y=0.98)

colors = {"py": "#f75f5f", "go": "#3dd68c"}

# 1. Resource Footprint (Image & Memory)
ax1 = axs[0, 0]
metrics_res = ["Docker Image (MB)", "Idle RAM (MB)", "Peak RAM @ 200c (MB)"]
py_res = [PY_DATA["image_size_mb"], PY_DATA["idle_mem_mb"], PY_DATA["peak_mem_mb"]]
go_res = [GO_DATA["image_size_mb"], GO_DATA["idle_mem_mb"], GO_DATA["peak_mem_mb"]]

x = np.arange(len(metrics_res))
width = 0.35
b1 = ax1.bar(x - width/2, py_res, width, label="Python (FastAPI)", color=colors["py"], alpha=0.9)
b2 = ax1.bar(x + width/2, go_res, width, label="Go (Golang)", color=colors["go"], alpha=0.9)

ax1.set_title("Resource Consumption (Lower is Better)", fontsize=12, fontweight="bold", pad=12)
ax1.set_xticks(x)
ax1.set_xticklabels(metrics_res, fontsize=10)
ax1.set_ylabel("Megabytes (MB)", fontsize=10)
ax1.legend()
ax1.grid(axis="y", linestyle="--", alpha=0.2)

for bar in b1:
    y = bar.get_height()
    ax1.text(bar.get_x() + bar.get_width()/2, y + 5, f"{y:.1f}M", ha="center", va="bottom", fontsize=8, color="white")
for bar in b2:
    y = bar.get_height()
    ax1.text(bar.get_x() + bar.get_width()/2, y + 5, f"{y:.1f}M", ha="center", va="bottom", fontsize=8, color="#3dd68c", fontweight="bold")

# 2. Cold Start Time
ax2 = axs[0, 1]
cs_labels = ["Python (FastAPI)", "Go (Golang)"]
cs_vals = [PY_DATA["cold_start_sec"], GO_DATA["cold_start_sec"]]
bars_cs = ax2.bar(cs_labels, cs_vals, color=[colors["py"], colors["go"]], width=0.45)
ax2.set_title("Cold Start Time to HTTP 200 Ready (Lower is Better)", fontsize=12, fontweight="bold", pad=12)
ax2.set_ylabel("Seconds (s)", fontsize=10)
ax2.grid(axis="y", linestyle="--", alpha=0.2)

for bar in bars_cs:
    y = bar.get_height()
    ax2.text(bar.get_x() + bar.get_width()/2, y + 0.1, f"{y:.3f}s", ha="center", va="bottom", fontsize=10, fontweight="bold")

# Add speedup text
ax2.text(1, cs_vals[1] + 1.2, f"⚡ {cs_vals[0]/cs_vals[1]:.1f}x Faster Startup", ha="center", color="#3dd68c", fontsize=11, fontweight="bold")

# 3. Throughput (RPS)
ax3 = axs[1, 0]
conc_labels = ["50 Concurrency", "100 Concurrency", "200 Concurrency"]
py_rps = [PY_DATA["api_benchmarks"]["c50"]["rps"], PY_DATA["api_benchmarks"]["c100"]["rps"], PY_DATA["api_benchmarks"]["c200"]["rps"]]
go_rps = [GO_DATA["api_benchmarks"]["c50"]["rps"], GO_DATA["api_benchmarks"]["c100"]["rps"], GO_DATA["api_benchmarks"]["c200"]["rps"]]

x3 = np.arange(len(conc_labels))
b3_1 = ax3.bar(x3 - width/2, py_rps, width, label="Python (FastAPI)", color=colors["py"], alpha=0.9)
b3_2 = ax3.bar(x3 + width/2, go_rps, width, label="Go (Golang)", color=colors["go"], alpha=0.9)
ax3.set_title("API Throughput / RPS (Higher is Better)", fontsize=12, fontweight="bold", pad=12)
ax3.set_xticks(x3)
ax3.set_xticklabels(conc_labels, fontsize=10)
ax3.set_ylabel("Requests Per Second (RPS)", fontsize=10)
ax3.legend()
ax3.grid(axis="y", linestyle="--", alpha=0.2)

for bar in b3_1:
    y = bar.get_height()
    ax3.text(bar.get_x() + bar.get_width()/2, y + 8, f"{y:.0f}", ha="center", va="bottom", fontsize=9, color="white")
for bar in b3_2:
    y = bar.get_height()
    ax3.text(bar.get_x() + bar.get_width()/2, y + 8, f"{y:.0f}", ha="center", va="bottom", fontsize=9, color="#3dd68c", fontweight="bold")

# 4. Latency P50 (ms)
ax4 = axs[1, 1]
py_p50 = [PY_DATA["api_benchmarks"]["c50"]["latency_p50_ms"], PY_DATA["api_benchmarks"]["c100"]["latency_p50_ms"], PY_DATA["api_benchmarks"]["c200"]["latency_p50_ms"]]
go_p50 = [GO_DATA["api_benchmarks"]["c50"]["latency_p50_ms"], GO_DATA["api_benchmarks"]["c100"]["latency_p50_ms"], GO_DATA["api_benchmarks"]["c200"]["latency_p50_ms"]]

b4_1 = ax4.bar(x3 - width/2, py_p50, width, label="Python (FastAPI)", color=colors["py"], alpha=0.9)
b4_2 = ax4.bar(x3 + width/2, go_p50, width, label="Go (Golang)", color=colors["go"], alpha=0.9)
ax4.set_title("Median Latency P50 (Lower is Better)", fontsize=12, fontweight="bold", pad=12)
ax4.set_xticks(x3)
ax4.set_xticklabels(conc_labels, fontsize=10)
ax4.set_ylabel("Latency (Milliseconds)", fontsize=10)
ax4.legend()
ax4.grid(axis="y", linestyle="--", alpha=0.2)

for bar in b4_1:
    y = bar.get_height()
    ax4.text(bar.get_x() + bar.get_width()/2, y + 40, f"{y:.0f}ms", ha="center", va="bottom", fontsize=9, color="white")
for bar in b4_2:
    y = bar.get_height()
    ax4.text(bar.get_x() + bar.get_width()/2, y + 40, f"{y:.0f}ms", ha="center", va="bottom", fontsize=9, color="#3dd68c", fontweight="bold")

plt.tight_layout()
out_png = DATA_DIR / "backend_comparison.png"
plt.savefig(out_png, dpi=300)
print(f"Chart saved to {out_png}")
