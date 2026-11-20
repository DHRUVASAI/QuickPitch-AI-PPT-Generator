# 📺 QuickPitch: AI Presentation Deck Generator (x402 + AWS)

> **YouTube / Audio / Transcript → On-Chain Micropayment → Professional PowerPoint (.pptx)**

QuickPitch is a high-accuracy, production-grade AI presentation generator built for the **x402 Hackathon**. It converts YouTube videos, speech recordings, and text transcripts into ready-to-present PowerPoint slide decks (`.pptx`) instantly, monetized via on-chain micropayments on Algorand.

---

## 1. 📋 Executive Overview & Problem Statement

* **The Problem:** Converting long-form video content, podcasts, speeches, or transcripts into structured presentation decks takes hours of manual labor. Traditional AI deck generators hallucinate generic tech templates, paste verbatim transcript paragraphs, or force monthly subscription plans.
* **The Solution:** Input a YouTube URL, audio file, or transcript, sign a $0.10 USDC micropayment via Algorand (x402 protocol), and receive a high-relevance, professionally formatted `.pptx` presentation in seconds.
* **Key Innovation:** Uses **x402 HTTP Payment Standard** to eliminate monthly subscriptions in favor of pure pay-per-use utility ($0.10 USDC per deck generated).

---

## 2. 🧠 2-Step Structured Knowledge Synthesizer Architecture

QuickPitch utilizes a 2-step AI architecture to guarantee 100% topic faithfulness and human-written presentation quality:

```text
Input (YouTube URL / Audio File / Text Transcript / Speech Title)
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ STEP 1: AI Topic Knowledge Synthesizer                                  │
│ Groq LLaMA 3.1 8B performs deep domain research & structured extraction:│
│ • Speaker, Exact Date, and Historical / Problem Setting                 │
│ • Core Purpose & Primary Thesis Statement                               │
│ • 5 Major Analytical Themes with Concrete Details                       │
│ • Iconic Direct Quotations & Highlight Statements                       │
│ • Specific Rhetorical Devices, Metaphors & Stylistic Analysis           │
│ • Lasting Impact, Legislative Legacy & Strategic Takeaways              │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼ (Structured Research Summary)
┌─────────────────────────────────────────────────────────────────────────┐
│ STEP 2: Intentional Multi-Layout Slide Generator                        │
│ Generates slide structures strictly from synthesized domain facts.      │
│ • Zero hallucinated tech templates (No "Prithvi", "SatMAE" fillers)     │
│ • Zero template placeholders (No "Theme A: Context" generic text)       │
│ • Executive Summarization Mandate (Punchy 3-8 word bullet takeaways)    │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
                      PptxGenJS Visual Theme Renderer
                                     │
                                     ▼
                       Executive PowerPoint (.pptx)
```

---

## 3. 🏗️ Complete System Pipeline

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

## 4. 🤖 Resilient Multi-Provider AI Engine

To guarantee 100% uptime and zero-downtime quota failures during pitch demos, the backend uses an automated failover LLM pipeline:

1. **Primary LLM:** **Groq LLaMA 3.1 8B Instant** — Ultra-fast inference (~0.6 seconds) with 500,000 tokens/day free-tier capacity.
2. **Secondary LLM:** **Groq LLaMA 3.3 70B Versatile** — High-accuracy fallback.
3. **Tertiary LLM:** **OpenAI GPT-4o** — High-precision semantic extraction.
4. **Quaternary LLM:** **Google Gemini 1.5 Flash** — Direct multimodal processing capability.
5. **Resilience Fallback:** Smart NLP text chunk extractor that guarantees a valid presentation is returned even if external LLM APIs experience downtime.

---

## 5. 🎯 Key Features & Quality Mandates

1. **Topic Faithfulness Mandate**:
   - Dynamically adapts to the exact topic. Historical speeches (e.g. Martin Luther King Jr., Abraham Lincoln) generate historical context, rhetorical devices, famous quotes, and civil rights legacy slides rather than AI tech decks.

2. **Executive Summarization Mandate**:
   - Replaces long transcript sentences with punchy, high-impact **3 to 8 word executive takeaway bullets** (e.g. *Universal equality across all races*, *Justice prioritized over discrimination*).

3. **Smart Binary Audio & Text Reader**:
   - Differentiates text transcripts (`.txt`, `.vtt`, `.srt`) from binary audio files (`.mp3`, `.wav`, `.m4a`), preventing raw binary byte corruption while providing speech notes textareas.

4. **In-Line On-Screen Loading Component**:
   - Displays real-time step descriptions (*🔍 Extracting transcript*, *🧠 AI synthesis*, *📐 Slide design*, *🎨 Theme styling*, *📦 .pptx compilation*) with a live elapsed seconds counter.

---

## 6. 🔬 Presentation Depth & Detail Level Modes

Users can select the exact presentation depth before generating:

* ⚡ **Concise (Quick Pitch)**: **7 Slides Total**. Fast, high-level summary with punchy 2-point takeaway cards.
* 📊 **Balanced (Standard)**: **10 Slides Total**. Balanced breakdown of key themes, thesis quotes, and strategy.
* 🔬 **Detailed Report (Executive)**: **13 to 15 Slides Total**. Comprehensive deep dive with in-depth analytical points, technical scope, governance, risk frameworks, and multi-pillar roadmaps.

---

## 7. 🎨 Visual Theme Engine (8 Color Palettes)

Supports 8 distinct visual themes with live color swatches:

1. 🌙 **Dark Monochrome**: Pure Black (`#000000`) & High-Contrast White
2. ☀️ **Clean Light**: Crisp Slate White (`#FFFFFF`) & Charcoal
3. 💜 **Midnight Purple**: Deep Violet (`#1E1B4B`) & Lavender Accent
4. 🌿 **Emerald Growth**: Deep Forest (`#064E3B`) & Mint Accent
5. 🌅 **Warm Sunset**: Dark Zinc (`#18181B`) & Amber Gold Accent
6. 💙 **Cyber Blue**: Deep Navy (`#0F172A`) & Electric Sky Blue Accent
7. 🌸 **Crimson Luxe**: Rich Wine (`#4C0519`) & Rose Pink Accent
8. ⚡ **Neon Matrix**: Pitch Black (`#000000`) & Matrix Neon Green Accent

---

## 8. ⛓️ Algorand Blockchain & x402 Payment Specifications

* **Protocol Standard:** HTTP 402 Payment Required (`@x402/hono` + `@x402-avm/fetch`)
* **Network:** Algorand TestNet (`ALGORAND_TESTNET_CAIP2`)
* **Settlement Currency:** TestNet USDC (`ASA ID: 10458941`)
* **Facilitator API:** `https://facilitator.goplausible.xyz`
* **Merchant Receiver Wallet:** `PCPIRVGC2JUBN2EPN7P3S3IVSBM2NFA2EVY4V3KLEXTBCRK5VGOVQIWIDE`
* **Supported Client Wallets:** Pera Wallet, Defly Wallet, Lute, Exodus (via `@txnlab/use-wallet-react`).

---

## 9. ☁️ AWS Enterprise Cloud Infrastructure

| AWS Service | Configuration & Usage | Cost Model |
|---|---|---|
| **AWS EC2** | `t2.micro` instance running Node.js 20 + PM2 Process Manager | 12-Month Free Tier (750 hrs/mo) |
| **AWS S3** | `quickpitch-ppts` bucket with CORS policies for presentation storage | Free Tier (5 GB + 20k GETs) |
| **AWS Transcribe**| Speech-to-Text engine for raw audio uploads | Pay-per-use ($0.024/min) |
| **AWS IAM** | User `<IAM_USER>` (Account: `<AWS_ACCOUNT_ID>`, Region: `us-east-1`) | Always Free |
| **AWS CLI** | Automated via `deploy-aws.sh` and `configure-aws.ps1` | Always Free |

---

## 10. 🔌 API Specifications

### Payment-Protected Endpoint
`POST /generate-ppt`
* **Protection:** x402 Middleware ($0.10 USDC)
* **Headers:** `Payment-Signature` (Algorand signed transaction payload)
* **Body:**
  ```json
  {
    "source_type": "youtube",
    "url": "https://www.youtube.com/watch?v=smEqnnklfYs",
    "theme": "monochrome-light",
    "detail_level": "balanced"
  }
  ```
* **Response:** `200 OK` with binary `application/vnd.openxmlformats-officedocument.presentationml.presentation` file stream.

### Unprotected Hackathon Demo Endpoint
`POST /generate-ppt-demo`
* **Purpose:** Allows instant presentation generation without wallet transactions for demonstration purposes.

---

## 11. 🚀 Local Run & Verification Guide

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
node -e "fetch('http://localhost:5173/api-proxy/generate-ppt-demo', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({source_type: 'youtube', url: 'https://www.youtube.com/watch?v=smEqnnklfYs', detail_level: 'balanced', theme: 'monochrome-light'})}).then(async r => console.log('STATUS:', r.status, 'SIZE:', (await r.arrayBuffer()).byteLength))"
```
*Result:* **`STATUS: 200`** | **`SIZE: ~159.5 KB`** (Verified with 100% authentic MLK historical analysis, punchy executive bullets, and multi-layout rendering).
