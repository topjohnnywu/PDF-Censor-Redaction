# 🪓 PDF Censor & Permanent Redaction Studio

> *"Because putting a black rectangle on a PDF doesn't actually delete the text underneath, Dave."*

[![Zero Server](https://img.shields.io/badge/Server-Literally%20Nonexistent-blue?style=flat-square)](#)
[![Privacy](https://img.shields.io/badge/Data%20Leaked-0%25-success?style=flat-square)](#)
[![Admin Rights](https://img.shields.io/badge/Admin%20Rights%20Needed-Zero%20(Zip%20%26%20Double--Click)-orange?style=flat-square)](#)
[![License](https://img.shields.io/badge/License-MIT-purple?style=flat-square)](#)

---

## 🤦 What Is This?

Welcome to the only PDF redaction tool built for people who are tired of government agencies and corporate legal teams accidentally leaking classified nuclear launch codes or SSNs because they used a black highlight pen in Adobe Acrobat.

**PDF Censor Studio** doesn't play games with layers. It **flattens, burns, and rasterizes** your document into fresh, sanitized pixels so that no amount of copy-pasting, DOM inspecting, or forensic metadata sleuthing will ever uncover what was underneath. 

If it's blacked out, it's gone. Reduced to atoms.

---

## ✨ Features Nobody Knew They Needed (Until They Got Sued)

### 🪨 True Pixel-Level Destruction (Permanent Burn-In)
- Most "censor tools" just draw a black rectangle floating over your text. Anyone with a high school diploma can press `Ctrl + A` and copy the sensitive text right out.
- **This app rasterizes every page directly onto an HTML5 canvas and re-encodes it into a pristine image PDF.** The underlying text layer isn't hidden — it ceases to exist.

### ⚡ Batch Redaction Across 1,000 Pages
- Got a recurring customer header, stamp, or signature on all 85 pages of an invoice batch?
- Toggle **"All Pages"**, draw the box once, and watch it obliterate that zone across the entire document in one fell swoop.

### 🔍 OCR & DO (Delivery Order) Extraction
- Because manually transcribing blurry tracking numbers and Delivery Orders is why people contemplate career changes.
- Draw a box, tag it as **"DO Zone"**, and let the embedded Tesseract OCR engine snatch the clean alphanumeric list so you can copy it to your clipboard with one click.

### 💾 Layout Templates (Save, Export, Import)
- Standardized invoice formats from that one vendor that never changes?
- Save your redaction grid as a template, export it as a JSON file, and share it with your coworkers so they stop bothering you about where the boxes go.

### 🎛️ Three Compression Flavors
- **Ultra Fidelity (300 DPI):** Crisp, sharp text for when legal actually has a magnifying glass.
- **Balanced (150 DPI):** The sweet spot. Looks great, doesn't crash your client's email server.
- **Compact (72 DPI):** For when Outlook's 20MB attachment limit is giving you ulcers.

---

## 🚀 How To Run It (Even on Your Office PC From 2008)

Your IT department locked down your laptop? You don't have admin access? Python isn't installed and VS Code is blocked? **Good news:**

### Method 1: The "I Don't Have Admin Rights" Special (Zero Install)
1. Download the ZIP file.
2. Unzip it somewhere your IT admin can't see it (like `C:\Users\You\Documents`).
3. **Double-click `index.html`.**
4. That's literally it. It opens right in Chrome, Edge, or Firefox. No command line, no Node.js, no Docker container consuming 4GB of RAM.

### Method 2: The Local Web Server (For Elitists)
If you insist on seeing `localhost:8000` in your address bar:

```bash
# Python
python3 -m http.server 8000

# Node.js
npx serve .
```

### Method 3: Full Next.js App
If you're a web developer who can't sleep at night without React and Tailwind:

```bash
npm install
npm run dev
# Browse to http://localhost:3000
```

---

## 🔒 Security & Privacy (Read This, Compliance Officers)

- **Zero Cloud Uploads:** None. Not to AWS, not to GCP, not to a basement server in Bucharest.
- **100% Client-Side:** Every single PDF byte is decoded, rendered, redacted, OCR'd, and exported directly inside your browser's V8 memory.
- If you disconnect your Wi-Fi, pull out your Ethernet cable, and walk into a Faraday cage, the app will still work flawlessly.

---

## 🛠️ Tech Stack

- **PDF Engine:** [PDF.js](https://mozilla.github.io/pdf.js/) (Rendering without the headache)
- **PDF Generator:** [jsPDF](https://github.com/parallax/jsPDF) (Re-baking the sanitized pages)
- **OCR:** [Tesseract.js](https://github.com/naptha/tesseract.js/) (Reading text so you don't have to)
- **UI:** Pure HTML5 Canvas & Dark-Mode CSS (No bloated 500MB dependencies)

---

## 📜 License

MIT License. Do whatever you want with it — just stop leaking unredacted PDFs.
