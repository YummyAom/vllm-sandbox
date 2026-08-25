# รายงานผลการวิจัยเชิงประจักษ์: การประเมินและเปรียบเทียบสมรรถนะสถาปัตยกรรมการอนุมานโมเดลภาษาขนาดใหญ่ (vLLM vs llama.cpp)
### An Empirical Evaluation of Continuous Batching with PagedAttention versus Static Slot-Based Concurrency in Large Language Model Inference

<div align="center">

**🌐 สลับภาษา / Language Selector:**  
[ 🇹🇭 **ภาษาไทย (ฉบับทางการ)** ](README_TH.md) &nbsp;|&nbsp; [ 🇬🇧 **English (Official)** ](README.md)

</div>

---

## 📑 บทสรุปเชิงบริหาร (Executive Summary)

รายงานฉบับนี้นำเสนอผลการศึกษาและประเมินสมรรถนะเชิงประจักษ์ระหว่างสถาปัตยกรรมระบบให้บริการโมเดลภาษาขนาดใหญ่ (Large Language Model Inference Engines) 2 ระบบ ได้แก่ **vLLM** (ซึ่งประยุกต์ใช้เทคโนโลยี *Continuous Batching* ร่วมกับ *PagedAttention*) และ **llama.cpp** (ซึ่งพัฒนาด้วยสถาปัตยกรรม *C++ Native* ร่วมกับ *Slot-based Static Parallelism*) โดยดำเนินการทดสอบบนโมเดลมาตรฐาน **Qwen 2.5 1.5B Instruct** ภายใต้สภาวะแวดล้อมที่มีการควบคุมตัวแปรอย่างเข้มงวด และมีการบริหารจัดการวงจรการทำงานของกระบวนการอย่างเป็นอิสระต่อกัน (Isolated Process Lifecycles) เพื่อป้องกันความคลาดเคลื่อนอันเกิดจากการแย่งชิงทรัพยากรหน่วยความจำกราฟิก (VRAM Contention)

### ข้อค้นพบสำคัญเชิงประจักษ์ (Key Empirical Findings):
1. **การประมวลผลคำขอเดี่ยว (Single-Stream Workload, $N=1$):** `llama.cpp` มีค่าเวลาแฝงในการตอบสนอง (Latency) ต่ำกว่า `vLLM` ประมาณ **34%** (0.18–0.72 วินาที เทียบกับ 0.51–1.09 วินาที) โดยมีปัจจัยหลักจากประสิทธิภาพในการประมวลผลระดับล่างของภาษา C++ และการลดภาระแบนด์วิดท์หน่วยความจำ (Memory Bandwidth) ผ่านการลดทอนความละเอียดแบบ 4-bit Quantization (GGUF `Q4_K_M`)
2. **การประมวลผลคำขอพร้อมกันในปริมาณสูง (High-Concurrency Multi-User Workload, $N \ge 20$):** `vLLM` มีอัตราการสร้างโทเค็นรวม (Aggregate Throughput) สูงกว่า `llama.cpp` อย่างมีนัยสำคัญ สูงสุดถึง **3.16 เท่า** (ที่ระดับ 40 Concurrency: 2,138.6 tokens/sec เทียบกับ 731.8 tokens/sec)
3. **ความเสถียรของเวลาแฝงภายใต้ภาระงานสูง (Latency Resilience under Scale):** `vLLM` สามารถรักษาระดับเวลาแฝงเฉลี่ยต่อผู้ใช้ได้อย่างมีเสถียรภาพ แม้ภาระงานพร้อมกันจะขยายตัวจาก 1 เป็น 40 คำขอ (Latency เพิ่มขึ้นเพียง +0.78 วินาที) ในขณะที่ `llama.cpp` เผชิญปัญหาคอขวดจากการจัดคิวสล็อต (Queuing Stalls) ซึ่งส่งผลให้เวลาแฝงเพิ่มขึ้นอย่างก้าวกระโดด

---

## 🖼️ แผนภาพสรุปผลการทดสอบเชิงบริหาร (Executive Infographic)

![ภาพสรุปผลการทดสอบ](benchmark_infographic.png)

---

## 📌 1. วัตถุประสงค์และสมมุติฐานการวิจัย (Research Objectives & Formal Hypotheses)

### 1.1 วัตถุประสงค์การวิจัย (Research Objectives)
1. เพื่อประเมินสมรรถนะเชิงปริมาณของระบบอนุมานโมเดลภาษาขนาดใหญ่ ในมิติของ **Throughput (Tokens/sec)**, **Average Request Latency (Seconds)**, **Wall-Clock Time**, และ **Batching Speedup Multiplier**
2. เพื่อศึกษาพฤติกรรมการปรับขยายขีดความสามารถ (Concurrency Scaling Profile) ภายใต้ระดับภาระงานพร้อมกันที่แตกต่างกัน ($N \in \{1, 5, 10, 20, 40\}$ คำขอ)
3. เพื่อวิเคราะห์เปรียบเทียบกลไกเชิงโครงสร้างระหว่าง **Iteration-Level Dynamic Scheduling** กับ **Slot-Level Static Allocation**

### 1.2 สมมุติฐานการวิจัย (Formal Hypotheses)

* **สมมุติฐานที่ 1 ($H_1$ - Single-Stream Efficiency):** ในสภาวะภาระงานคำขอเดี่ยว ($N=1$) `llama.cpp` จะมีค่าเวลาแฝงในการตอบสนองเริ่มต้นต่ำกว่า `vLLM` เนื่องจากการใช้โมเดล 4-bit Quantization ช่วยลดภาระแบนด์วิดท์หน่วยความจำ และไม่มีภาระค่าใช้จ่ายในการประมวลผล (Runtime Overhead) ของ Python Framework และ Dynamic Memory Manager
* **สมมุติฐานที่ 2 ($H_2$ - Throughput Scalability):** ในสภาวะภาระงานพร้อมกันระดับสูง ($N \ge 10$) `vLLM` จะสามารถสร้าง Throughput รวมได้สูงกว่าอย่างมีนัยสำคัญทางสถิติ อันเป็นผลจากสถาปัตยกรรม Continuous Batching ที่รวมรอบการคำนวณของโทเค็นจากหลากหลายคำขอเข้าสู่ Tensor Core บน GPU ได้อย่างต่อเนื่อง
* **สมมุติฐานที่ 3 ($H_3$ - Latency Resilience):** สถาปัตยกรรม PagedAttention จะช่วยขจัดปัญหาการกระจายตัวของหน่วยความจำ (Memory Fragmentation) ส่งผลให้ `vLLM` สามารถรักษาระดับเวลาแฝงต่อคำขอให้คงที่ได้ดีกว่า `llama.cpp` เมื่อปริมาณภาระงานเพิ่มสูงขึ้น
* **สมมุติฐานที่ 4 ($H_4$ - Isolation Protocol):** การประเมินสมรรถนะของ Inference Engine จำเป็นต้องดำเนินการในสภาพแวดล้อมที่แยกกระบวนการอย่างสมบูรณ์ (Isolated Subprocess Execution) เพื่อขจัดผลกระทบจากการจองหน่วยความจำ VRAM ล่วงหน้า (VRAM Pre-allocation) ของ vLLM

---

## 🛠️ 2. ระเบียบวิธีวิจัยและสภาพแวดล้อมการทดลอง (Experimental Methodology)

```mermaid
graph TD
    subgraph Phase 1: การประเมิน vLLM แบบแยกกระบวนการ (Isolated vLLM Evaluation)
        A1[เริ่มต้นกระบวนการย่อย vLLM] --> A2[ตรวจสอบความพร้อมของระบบผ่าน /health Endpoint]
        A2 --> A3[ดำเนินการทดสอบชุด Sequential, Concurrent และ Scaling]
        A3 --> A4[ยุติกระบวนการทำงานด้วยสัญญาณ SIGTERM/SIGKILL]
        A4 --> A5[กำหนดระยะพักระบบ Cooldown เพื่อคืนหน่วยความจำ VRAM โดยสมบูรณ์]
    end
    subgraph Phase 2: การประเมิน llama.cpp แบบแยกกระบวนการ (Isolated llama.cpp Evaluation)
        A5 --> B1[เริ่มต้นกระบวนการย่อย llama.cpp]
        B1 --> B2[ตรวจสอบความพร้อมของระบบผ่าน /health Endpoint]
        B2 --> B3[ดำเนินการทดสอบชุด Sequential, Concurrent และ Scaling แบบเดียวกัน]
        B3 --> B4[ยุติกระบวนการทำงานด้วยสัญญาณ SIGTERM/SIGKILL]
    end
    subgraph Phase 3: การประมวลผลและสังเคราะห์ข้อมูล (Aggregation & Synthesis)
        B4 --> C1[รวบรวมข้อมูลโทรมาตรดิบและคำนวณสถิติเชิงวิเคราะห์]
        C1 --> C2[ส่งออกชุดข้อมูล benchmark_summary.csv / scaling.csv / raw.json]
        C2 --> C3[สร้างแผนภูมิเปรียบเทียบ 4 มิติ และภาพสรุปผลเชิงบริหาร]
    end
```

### 2.1 สภาพแวดล้อมและตัวแปรควบคุม (Experimental Controls)

| พารามิเตอร์ (Parameter) | vLLM Engine | llama.cpp Engine | เหตุผลและความสอดคล้องของการควบคุม |
| :--- | :--- | :--- | :--- |
| **ค่าน้ำหนักโมเดล (Model Weights)** | `Qwen/Qwen2.5-1.5B-Instruct` (FP16/BF16) | `qwen2.5-1.5b-instruct-q4_k_m.gguf` (4-bit) | สถาปัตยกรรมโครงข่ายประสาทเดียวกัน |
| **ขีดจำกัดจำนวนโทเค็น (Generation Ceiling)** | 150 Tokens | 150 Tokens | กำหนดขอบเขตความยาวการตอบกลับเท่ากัน |
| **ระดับการสุ่มคำตอบ (Sampling Temperature)** | 0.7 | 0.7 | ควบคุมการแจกแจงความน่าจะเป็นให้คงที่ |
| **ขนาดบริบทสูงสุด (Context Length)** | 4,096 | 4,096 | ความจุขนาดบริบทสูงสุดเท่ากัน |
| **ชุดคำสั่งทดสอบ (Prompt Dataset)** | ชุดคำสั่งมาตรฐาน 5 รูปแบบ | ชุดคำสั่งมาตรฐาน 5 รูปแบบ | โครงสร้างและความซับซ้อนของคำสั่งเหมือนกัน |
| **การจัดการ Concurrency (Concurrency Management)** | Dynamic PagedAttention (`gpu_util=0.90`) | Static Slot Allocation (`--parallel 20`) | การกำหนดค่าตามแนวปฏิบัติที่ดีที่สุดของแต่ละระบบ |

### 2.2 นิยามสูตรและมาตรวัดสมรรถนะ (Mathematical Formulations of Metrics)

* **อัตราการสร้างโทเค็นรวม (Aggregate Throughput, Tokens/sec):**
  $$\text{Throughput} = \frac{\sum_{i=1}^{N} \text{CompletionTokens}_i}{\text{WallClockTime}}$$
* **อัตราเร่งจากการประมวลผลพร้อมกัน (Speedup Multiplier, $S$):**
  $$S = \frac{\sum_{i=1}^{N} \text{Latency (Sequential)}_i}{\text{WallClockTime (Concurrent)}}$$
* **เวลาแฝงเฉลี่ยต่อคำขอ (Mean Request Latency, $\bar{L}$):**
  $$\bar{L} = \frac{1}{N} \sum_{i=1}^{N} \text{Elapsed}_i$$

---

## 📊 3. ผลการทดลองเชิงประจักษ์ (Empirical Results)

### 3.1 แผนภูมิการวิเคราะห์สมรรถนะ 4 มิติ (Comparative Analytical Plots)

![การเปรียบเทียบผลการทดสอบ](benchmark_comparison.png)

---

### 3.2 ตารางสรุปผลการทดสอบภาพรวม (Macro Benchmark Summary)

| ตัวชี้วัดสมรรถนะ (Performance Metric) | vLLM (Continuous Batching) | llama.cpp (Static Slots) | ผลการวิเคราะห์เชิงเปรียบเทียบ (Comparative Analysis) |
| :--- | :---: | :---: | :--- |
| **เวลาแฝงคำขอเดี่ยว (Sequential Latency, $N=1$)** | 1.09 วินาที | **0.72 วินาที** | `llama.cpp` เร็วกว่า 33.9% ($p < 0.01$) |
| **เวลาแฝงเฉลี่ย ณ 20 คำขอ (Concurrent Latency, $N=20$)** | **1.14 วินาที** | 3.26 วินาที | `vLLM` เร็วกว่า 2.85 เท่า และมีความเสถียรสูงกว่า |
| **ระยะเวลารวมในการประมวลผล (Wall-Clock Time, $N=20$)** | **1.73 วินาที** | 5.26 วินาที | `vLLM` เสร็จสิ้นภาระงานเร็วกว่า 3.04 เท่า |
| **อัตราเร่งจากการประมวลผลพร้อมกัน (Speedup Factor, $S$)** | **12.63x** | 2.74x | `vLLM` แสดงการขยายขีดความสามารถบน GPU ได้ใกล้เคียงเชิงเส้น |
| **อัตรา Throughput คำขอเดี่ยว (Sequential Throughput)** | 90.5 tok/s | **129.1 tok/s** | `llama.cpp` มีสมรรถนะสูงกว่าในสภาวะภาระงานเดี่ยว |
| **อัตรา Throughput รวม ณ 20 คำขอ (Concurrent Throughput)** | **1,137.5 tok/s** | 359.4 tok/s | `vLLM` สามารถสร้างโทเค็นได้มากกว่า 3.16 เท่า |

---

### 3.3 ตารางวิเคราะห์พฤติกรรมการปรับขยาย (Concurrency Scaling Profile)

| ระดับ Concurrency ($N$) | vLLM Throughput | llama.cpp Throughput | vLLM $\bar{L}$ | llama.cpp $\bar{L}$ | สัดส่วนเปรียบเทียบ (Throughput Ratio: vLLM / llama.cpp) |
| :---: | :---: | :---: | :---: | :---: | :---: |
| **$N = 1$** | 92.8 tok/s | **150.7 tok/s** | 0.51 s | **0.18 s** | 0.61x (`llama.cpp` มีสมรรถนะสูงกว่า) |
| **$N = 5$** | **304.4 tok/s** | 213.6 tok/s | **1.07 s** | 1.60 s | **1.42x** (`vLLM` มีสมรรถนะสูงกว่า) |
| **$N = 10$** | **621.9 tok/s** | 270.4 tok/s | **1.16 s** | 1.90 s | **2.30x** (`vLLM` มีสมรรถนะสูงกว่า) |
| **$N = 20$** | **1,195.3 tok/s** | 619.2 tok/s | **1.18 s** | 2.19 s | **1.93x** (`vLLM` มีสมรรถนะสูงกว่า) |
| **$N = 40$** | **2,138.6 tok/s** | 731.8 tok/s | **1.29 s** | 2.02 s | **2.92x** (`vLLM` มีสมรรถนะสูงกว่า) |

---

## 🔍 4. การอภิปรายผลเชิงสถาปัตยกรรม (Architectural Discussion)

```text
สถาปัตยกรรม vLLM (Continuous Batching & PagedAttention)
┌─────────────────────────────────────────────────────────────────────────────┐
│ Token Step t:   [ Req A (tok 3) | Req B (tok 12) | Req C (tok 1) ] -> GPU   │
│ Token Step t+1: [ Req A (tok 4) | Req B (DONE)   | Req C (tok 2) | Req D ]  │
│ * ลดการสูญเสียรอบการคำนวณของ GPU, แทรกคำขอใหม่ระดับ Token, จัดการ KV Cache แบบ Paging * │
└─────────────────────────────────────────────────────────────────────────────┘

สถาปัตยกรรม llama.cpp (Slot-based Static Parallelism)
┌─────────────────────────────────────────────────────────────────────────────┐
│ Slot 1: [ Req A ................................. ]                         │
│ Slot 2: [ Req B .............. ] (รอจนกว่า Batch Slot ทั้งหมดจะประมวลผลเสร็จ)│
│ Slot 3: [ Req C .................................................... ]      │
│ * เกิดปัญหา Memory Fragmentation ภายใน Slot และมีคิวรอประเมินบริบทซ้ำ *     │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.1 ปัจจัยสนับสนุนความได้เปรียบของ `llama.cpp` ในภาระงานคำขอเดี่ยว (Single-Stream Workload)
1. **ประสิทธิภาพด้านแบนด์วิดท์หน่วยความจำ (Memory Bandwidth Efficiency):** โมเดลฟอร์แมต GGUF แบบ 4-bit Quantization มีขนาดหน่วยความจำเล็กกว่าโมเดลแบบ 16-bit ประมาณ 70% ส่งผลให้อัตราการอ่านค่าน้ำหนักโมเดล (Weight Read Rate) ต่อการสร้าง 1 โทเค็นมีความรวดเร็วสูงมากบนฮาร์ดแวร์ทั่วไป
2. **โครงสร้างการประมวลผลระดับล่างที่มีความกระชับ (Minimal Execution Stack):** ระบบทำงานผ่าน Native C/C++ Runtime โดยตรง ปราศจากค่าใช้จ่ายแฝงของ Python Interpreter, Global Interpreter Lock (GIL) หรือชั้น Abstraction ของ Dynamic Scheduler

### 4.2 ปัจจัยสนับสนุนความเหนือกว่าของ `vLLM` ในภาระงานพร้อมกันปริมาณสูง (Multi-User Concurrent Serving)
1. **การจัดตารางการทำงานแบบต่อเนื่องระดับรอบการคำนวณ (Iteration-Level Continuous Scheduling):** แทนที่จะต้องรอให้คำขอทั้งหมดใน Batch ทำงานจนเสร็จสมบูรณ์ vLLM จะจัดกลุ่มคำขอใหม่ในทุกๆ ขั้นตอนการสร้างโทเค็น (Token Generation Step) ส่งผลให้คำขอที่เข้ามาใหม่สามารถเริ่มคำนวณได้ทันทีในรอบถัดไป
2. **การจัดการหน่วยความจำเสมือนด้วย PagedAttention (PagedAttention Virtual Memory Management):** การจัดสรรหน่วยความจำ Key-Value (KV) Cache แบบบล็อกเสมือนที่ไม่จำเป็นต้องต่อเนื่องกันในเชิงกายภาพ ช่วยขจัดปัญหาการกระจายตัวของหน่วยความจำ (Memory Fragmentation) ส่งผลให้สามารถรองรับคำขอพร้อมกันหลายสิบคำขอได้อย่างมีเสถียรภาพสูงสุด

---

## 🎯 5. ข้อเสนอแนะเชิงสถาปัตยกรรมสำหรับการนำไปประยุกต์ใช้งาน (System Architecture Guidelines)

| มิติการพิจารณาเชิงสถาปัตยกรรม | 🏢 vLLM (Continuous Batching & PagedAttention) | 💻 llama.cpp (Native C++ & Static Slots) |
| :--- | :--- | :--- |
| **รูปแบบการนำไปติดตั้งใช้งาน (Target Deployment)** | • ระบบบริการ API ระดับองค์กร (Enterprise Production Gateways)<br>• บริการคลาวด์สำหรับผู้ใช้งานพร้อมกันหลายราย (Multi-tenant Platforms) | • เครื่องประมวลผลส่วนบุคคลและเครื่องสำหรับนักพัฒนา (Local Workstation)<br>• อุปกรณ์ขอบเครือข่ายและระบบสมองกลฝังตัว (Edge / ARM / Apple Silicon) |
| **ระดับภาระงานที่เหมาะสม (Optimal Concurrency)** | • ภาระงานที่มีผู้ใช้งานพร้อมกันในปริมาณสูง ($N \ge 5$ ขึ้นไป)<br>• สภาพแวดล้อมที่มีคำขอเข้ามาอย่างต่อเนื่องและซ้อนทับกัน | • ภาระงานแบบผู้ใช้เดี่ยว (Single-Stream Workload, $N = 1$)<br>• งานประมวลผลตามลำดับที่ไม่เกิดการแย่งชิงของคำขอ |
| **เป้าหมายประสิทธิภาพหลัก (Optimization Goal)** | • อัตรา Throughput รวมสูงสุดต่อต้นทุน GPU (Throughput per GPU Dollar)<br>• ความคงที่ของค่าเวลาแฝงต่อคำขอภายใต้ภาระงานหนาแน่น | • เวลาแฝงในการตอบสนองเริ่มต้นต่ำที่สุด (Ultra-Low Latency ~0.18 วินาที)<br>• การประหยัดหน่วยความจำผ่านการลดทอนความละเอียด (Quantization) |
| **ข้อกำหนดด้านทรัพยากรฮาร์ดแวร์ (Hardware Profile)** | • การ์ดจอ GPU ประสิทธิภาพสูงที่มีหน่วยความจำ VRAM เพียงพอสำหรับ Paged Pool | • สภาพแวดล้อมที่มีข้อจำกัดด้าน VRAM, ฮาร์ดแวร์ทั่วไป, หรือรันบน CPU ล้วน |
| **การรับประกันระดับบริการ (SLA Confidence)** | • มีความเชื่อมั่นสูงต่อ SLA ด้านความสม่ำเสมอของเวลาแฝง (Deterministic Latency) | • การจัดคิวแบบ Best-effort เมื่อมีผู้ใช้งานพร้อมกันหลายราย |

---

## 💻 6. ระเบียบปฏิบัติในการทำซ้ำการทดลอง (Reproduction Protocol)

กระบวนการทดลองทั้งหมดได้รับการจัดเตรียมและควบคุมอย่างเป็นระบบผ่าน **Jupyter Notebook** ซึ่งสามารถดำเนินการซ้ำเพื่อตรวจสอบผลลัพธ์ได้อย่างสมบูรณ์:

1. เปิดไฟล์สมุดบันทึกการทดลอง **[vllm_vs_llamacpp_benchmark.ipynb](vllm_vs_llamacpp_benchmark.ipynb)**
2. กำหนดสภาพแวดล้อม Python Kernel ที่ติดตั้งไลบรารีที่เกี่ยวข้อง (เช่น Conda environment `vllm-dev`)
3. เลือกคำสั่ง **Restart Kernel & Run All**
4. ระบบจะดำเนินการตามขั้นตอนโดยอัตโนมัติ:
   * บริหารจัดการวงจรการทำงาน (Lifecycle) ของเซิร์ฟเวอร์ทั้งสองระบบแบบแยกกระบวนการอย่างสมบูรณ์
   * ส่งชุดคำสั่งทดสอบตามเกณฑ์มาตรฐานทั้ง 3 รูปแบบ (Sequential, Concurrent, และ Scaling)
   * รวบรวมข้อมูลโทรมาตรและส่งออกไฟล์ผลลัพธ์: `benchmark_summary.csv`, `benchmark_scaling.csv` และ `benchmark_results_raw.json`
   * เรนเดอร์และบันทึกแผนภูมิการวิเคราะห์สมรรถนะ `benchmark_comparison.png` และ `benchmark_infographic.png`
