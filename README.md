# 📺 QuickPitch: AI PPT Generator (x402 + AWS)

> **YouTube / Audio / Transcript → Micro-Payment → Professional PowerPoint**

QuickPitch is a high-accuracy, production-grade web application built for the **x402 Hackathon**. It converts YouTube videos, speech recordings, and text transcripts into ready-to-present PowerPoint slide decks (`.pptx`) instantly, monetized via on-chain micropayments on Algorand.

---

## 1. 📋 Executive Overview & Problem Statement

* **The Problem:** Converting long-form video content, podcasts, speeches, or transcripts into structured presentation decks takes hours of manual labor.
* **The Solution:** Paste a URL or audio file, sign a $0.10 USDC micropayment via Algorand (x402 protocol), and receive a formatted `.pptx` presentation in seconds.
* **Key Innovation:** Uses **x402 HTTP Payment Standard** to eliminate monthly subscriptions in favor of pure pay-per-use utility.

---

## 2. 🏗️ Complete System Architecture

```text
                               ┌──────────────────────────────────────────┐
                               │           Vite + React Frontend          │
                               │   (Vercel/Linear Minimalist Dark UI)     │
                               └────────────────────┬─────────────────────┘
                                                    │
                                   HTTP Request + Payment-Signature
                                                    │
                               ┌────────────────────▼─────────────────────┐
                               │       SentinelAI / x402 Gateway          │
                               │       Hono Server (Port 4021)            │
                               └────────────────────┬─────────────────────┘
                                                    │
                   ┌────────────────────────────────┼────────────────────────────────┐
                   │                                │                                │
         1. Verify Payment                 2. Fetch Content               3. AI LLM Pipeline
                   │                                │                                │
        ┌──────────▼──────────┐          ┌──────────▼──────────┐          ┌──────────▼──────────┐
        │  GoPlausible x402   │          │  youtube-transcript │          │ Primary: Groq LLaMA │
        │ Facilitator Service │          │    & Audio Parser   │          │ 3.1 8B Instant      │
        │ (Algorand TestNet)  │          └─────────────────────┘          │ 2nd: Groq 70B       │
        └─────────────────────┘                                           │ 3rd: OpenAI GPT-4o  │
                                                                          └──────────┬──────────┘
                                                                                     │
                                                                          4. Generate Presentation
                                                                                     │
                                                                          ┌──────────▼──────────┐
                                                                          │  PptxGenJS Engine   │
                                                                          │ (Outputs .pptx blob)│
                                                                          └──────────┬──────────┘
                                                                                     │
                                                                          5. Cloud Storage (AWS)
                                                                                     │
                                                                          ┌──────────▼──────────┐
                                                                          │  AWS S3 + EC2 Core  │
                                                                          └─────────────────────┘
```

---

## 3. 🤖 Resilient Multi-Provider AI Engine

To guarantee 100% uptime and zero-downtime quota failures during pitch demos, the backend uses an automated failover LLM pipeline:

1. **Primary LLM:** **Groq LLaMA 3.1 8B Instant** — Ultra-fast inference (~0.6 seconds) with 500,000 tokens/day free-tier capacity.
2. **Secondary LLM:** **Groq LLaMA 3.3 70B Versatile** — High-accuracy fallback.
3. **Tertiary LLM:** **OpenAI GPT-4o** — High-precision semantic extraction.
4. **Quaternary LLM:** **Google Gemini 1.5 Flash** — Direct multimodal processing capability.
5. **Resilience Fallback:** Smart NLP text chunk extractor that guarantees a valid presentation is returned even if external LLM APIs experience downtime.

---

## 4. 🧠 10/10 Story Arc & Anti-Repetition Engine

1. **Mandatory 8-Step Story Arc**:
   Every presentation strictly follows a logical narrative progression:
   - 📌 **Slide 1**: *Executive Overview & Problem Context* (Why traditional approaches fail / key bottleneck)
   - 🔬 **Slide 2**: *Core Technical Innovation & Architecture* (Specific model names & mechanisms)
   - 📊 **Slide 3**: *Datasets & Empirical Benchmarks* (Specific datasets like Sentinel-2/Landsat & concrete metrics)
   - 💬 **Slide 4**: *Core Thesis & Highlight Statement* (Full-width takeaway quotation)
   - 🛠️ **Slide 5**: *System Pipeline & Integration* (APIs, workflows, data ingestion)
   - 🌍 **Slide 6**: *Real-World Case Studies & Applications* (Practical deployment scenarios)
   - 🚀 **Slide 7**: *Phased Implementation Roadmap* (Phase 1 Initiate, Phase 2 Scale, Phase 3 Optimize)
   - 🔮 **Slide 8+**: *Future Vision, Risk Framework & Conclusion*

2. **Strict Anti-Repetition Mandate**:
   - Enforces zero duplicate or paraphrased slides across the deck. Every slide explores a completely unique dimension of the topic.

3. **Domain Entity & Concrete Metric Extraction**:
   - Automatically extracts specific model names (`Prithvi`, `SatMAE`, `Clay`, `DOFA`, `LLaMA-3`), datasets (`Sentinel-2`, `Landsat-8`, `SAR`), and empirical metrics (`94.5% Accuracy`, `10x Throughput`).

---

## 5. 🔬 Presentation Depth & Detail Level Modes

Users can select the exact presentation depth before generating:

* ⚡ **Concise (Quick Pitch)**: **7 Slides Total**. Fast, high-level summary with punchy 2-point takeaway cards.
* 📊 **Balanced (Standard)**: **9 to 10 Slides Total**. Balanced breakdown of key themes, thesis quotes, and strategy.
* 🔬 **Detailed Report (Executive)**: **12 to 15 Slides Total**. Comprehensive deep dive with in-depth analytical points, technical scope, governance, risk frameworks, and multi-pillar roadmaps.

---

## 6. 🎨 Visual Theme Engine (8 Color Palettes with Swatches)

Supports 8 distinct visual themes with live color dot swatch previews:

1. 🌙 **Dark Monochrome**: Pure Black (`#000000`) & High-Contrast White
2. ☀️ **Clean Light**: Crisp Slate White (`#FFFFFF`) & Charcoal
3. 💜 **Midnight Purple**: Deep Violet (`#1E1B4B`) & Lavender Accent
4. 🌿 **Emerald Growth**: Deep Forest (`#064E3B`) & Mint Accent
5. 🌅 **Warm Sunset**: Dark Zinc (`#18181B`) & Amber Gold Accent
6. 💙 **Cyber Blue**: Deep Navy (`#0F172A`) & Electric Sky Blue Accent
7. 🌸 **Crimson Luxe**: Rich Wine (`#4C0519`) & Rose Pink Accent
8. ⚡ **Neon Matrix**: Pitch Black (`#000000`) & Matrix Neon Green Accent

---

## 7. ⛓️ Algorand Blockchain & x402 Payment Specifications

* **Protocol Standard:** HTTP 402 Payment Required (`@x402/hono` + `@x402-avm/fetch`)
* **Network:** Algorand TestNet
* **Settlement Currency:** TestNet USDC (`ASA ID: 10458941`)
* **Facilitator API:** `https://facilitator.goplausible.xyz`
* **Merchant Receiver Wallet:** `PCPIRVGC2JUBN2EPN7P3S3IVSBM2NFA2EVY4V3KLEXTBCRK5VGOVQIWIDE`
* **Supported Client Wallets:** Pera Wallet, Defly Wallet, Lute, Exodus (via `@txnlab/use-wallet-react`).

---

## 8. ☁️ AWS Enterprise Cloud Infrastructure

| AWS Service | Configuration & Usage | Cost Model |
|---|---|---|
| **AWS EC2** | `t2.micro` instance running Node.js 20 + PM2 Process Manager | 12-Month Free Tier (750 hrs/mo) |
| **AWS S3** | `quickpitch-ppts` bucket with CORS policies for presentation storage | Free Tier (5 GB + 20k GETs) |
| **AWS Transcribe**| Speech-to-Text engine for raw audio uploads | Pay-per-use ($0.024/min) |
| **AWS IAM** | User `VUPO` (Account: `957036694697`, Region: `us-east-1`) | Always Free |
| **AWS CLI** | Automated via `deploy-aws.sh` and `configure-aws.ps1` | Always Free |

---

## 9. 🔌 API Specifications

### Payment-Protected Endpoint
`POST /generate-ppt`
* **Protection:** x402 Middleware ($0.10 USDC)
* **Headers:** `Payment-Signature` (Algorand signed transaction payload)
* **Body:**
  ```json
  {
    "source_type": "youtube",
    "url": "https://www.youtube.com/watch?v=UF8uR6Z6KLc",
    "theme": "emerald-growth",
    "detail_level": "detailed"
  }
  ```
* **Response:** `200 OK` with binary `application/vnd.openxmlformats-officedocument.presentationml.presentation` file stream.

### Unprotected Hackathon Demo Endpoint
`POST /generate-ppt-demo`
* **Purpose:** Allows instant presentation generation without wallet transactions for demonstration purposes.

---

## 10. 🚀 Local Run & Verification Guide

### Backend Server (`http://localhost:4021`)
```bash
cd x402-demo-server
npm run dev
```

### Frontend Web App (`http://localhost:5173`)
```bash
cd X402-Usecase/projects/X402-Usecase
npx vite --port 5173
```

### End-to-End Verification & Benchmarks
```bash
node -e "fetch('http://localhost:5173/api-proxy/generate-ppt-demo', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({source_type: 'youtube', url: 'https://www.youtube.com/watch?v=UF8uR6Z6KLc', detail_level: 'detailed', theme: 'cyber-blue'})}).then(async r => console.log('STATUS:', r.status, 'SIZE:', (await r.arrayBuffer()).byteLength))"
```
*Result:* **`STATUS: 200`** | **`SIZE: ~195.0 KB`** (15-slide detailed report verified).
