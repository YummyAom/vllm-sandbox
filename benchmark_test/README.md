# 🚀 Benchmark & Evaluation Suite

โฟลเดอร์นี้รวบรวมเครื่องมือ สคริปต์ และรายงานผลการทดสอบประสิทธิภาพสำหรับระบบ **vLLM Inference & Control Plane**

---

## 📑 สารบัญเอกสารและรายงานผลการทดลอง

| เอกสาร | รายละเอียด |
| :--- | :--- |
| 📊 **[BACKEND_BENCHMARK_REPORT_TH.md](./BACKEND_BENCHMARK_REPORT_TH.md)** | **รายงานฉบับเต็ม:** การทดลองเปรียบเทียบ Control Plane ระหว่าง **Python (FastAPI)** vs **Go (Golang)** (สเปกเครื่อง, ระเบียบวิธี, ผลสถิติ, และบทวิเคราะห์เชิงสถาปัตยกรรม) |
| 📄 **[README_TH.md](./README_TH.md)** | รายงานการทดลองเปรียบเทียบ Inference Engine: **vLLM vs Llama.cpp** (Throughput, VRAM, KV-Cache) |

---

## 📁 ไฟล์ข้อมูลและกราฟประกอบการนำเสนอ

* 🖼️ **[backend_comparison.png](./backend_comparison.png)**: ภาพกราฟสรุปผลเปรียบเทียบ Resource, Latency, RPS และ Cold Start ความละเอียดสูง (Dark Theme) เหมาะสำหรับนำไปแปะใน Slide นำเสนอ
* 📋 **[results_python.json](./results_python.json)**: ข้อมูลดิบผลการทดสอบฝั่ง Python (FastAPI)
* 📋 **[results_go.json](./results_go.json)**: ข้อมูลดิบผลการทดสอบฝั่ง Go (Golang)
* 🐍 **[compare_backends.py](./compare_backends.py)**: สคริปต์รัน Benchmark อัตโนมัติ (วัด Memory, Cold Start, Concurrency, WebSockets)
* 📈 **[generate_report_charts.py](./generate_report_charts.py)**: สคริปต์สำหรับ Render ภาพกราฟเปรียบเทียบจากไฟล์ JSON

---

## 🛠️ วิธีการรัน Benchmark ซ้ำ (Reproduction)

หากต้องการรันการทดสอบใหม่อีกครั้ง:

```bash
# 1. รัน Benchmark เพื่อเก็บข้อมูลดิบ
/home/yummyaom/miniconda3/envs/vllm-dev/bin/python compare_backends.py

# 2. สร้างภาพกราฟเปรียบเทียบใหม่
/home/yummyaom/miniconda3/envs/vllm-dev/bin/python generate_report_charts.py
```
