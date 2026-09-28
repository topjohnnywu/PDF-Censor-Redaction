// lib/sample-pdf.ts
// Generates a clean synthetic multi-page document using jsPDF for demo testing if the user has not loaded a PDF yet.
import { jsPDF } from "jspdf";

export function generateSamplePdfBlob(): Blob {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "pt",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();

  // Page 1: Sensitive Invoice / Medical Record
  doc.setFillColor(248, 250, 252);
  doc.rect(0, 0, pageWidth, 842, "F");

  // Header band
  doc.setFillColor(30, 41, 59);
  doc.rect(40, 40, pageWidth - 80, 50, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("CONFIDENTIAL PATIENT & BILLING RECORD", 55, 72);

  // Body content
  doc.setTextColor(30, 41, 59);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);

  doc.setFont("helvetica", "bold");
  doc.text("PATIENT IDENTIFICATION (DO NOT DISCLOSE)", 40, 125);
  doc.setFont("helvetica", "normal");
  doc.text("Patient Full Name: Jane Angela Doe-Holloway", 40, 145);
  doc.text("Social Security Number: 987-00-4321", 40, 165);
  doc.text("Date of Birth: March 14, 1984 (Age: 42)", 40, 185);
  doc.text("Residential Address: 742 Evergreen Terrace, Springfield, OR 97477", 40, 205);
  doc.text("Direct Contact: +1 (555) 019-2834 | patient.jane@confidential-mail.org", 40, 225);

  doc.setDrawColor(203, 213, 225);
  doc.line(40, 245, pageWidth - 40, 245);

  doc.setFont("helvetica", "bold");
  doc.text("FINANCIAL & PAYMENT DETAILS", 40, 275);
  doc.setFont("helvetica", "normal");
  doc.text("Primary Credit Card: Visa ending in 8841 (Exp: 09/29, CVV: 712)", 40, 295);
  doc.text("Bank Account Routing: #021000021  |  Account: #883910284719", 40, 315);
  doc.text("Total Out-of-Pocket Liability: $4,850.00 USD", 40, 335);

  doc.line(40, 355, pageWidth - 40, 355);

  doc.setFont("helvetica", "bold");
  doc.text("CLINICAL DIAGNOSIS & REMARKS", 40, 385);
  doc.setFont("helvetica", "normal");
  const notes =
    "Patient presented with chronic recurring symptoms. Lab specimen evaluation confirms elevated metabolic panels. Prescribed regime: Compound RX-901 twice daily. Follow-up scheduled with Dr. Marcus Vance on October 12.";
  const splitNotes = doc.splitTextToSize(notes, pageWidth - 80);
  doc.text(splitNotes, 40, 405);

  // Simulated signature box
  doc.setDrawColor(148, 163, 184);
  doc.rect(40, 520, 220, 70);
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text("Authorized Attending Physician Signature:", 45, 535);
  doc.setFont("courier", "italic");
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text("Dr. Marcus Vance, M.D.", 50, 570);

  // Footer
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(148, 163, 184);
  doc.text("Document Ref: CLIN-2026-0924-A · Page 1 of 2 · Stored with strict retention policy", 40, 800);

  // Page 2: Follow-up & Lab test breakdown
  doc.addPage("a4", "portrait");
  doc.setFillColor(248, 250, 252);
  doc.rect(0, 0, pageWidth, 842, "F");

  // Header band
  doc.setFillColor(30, 41, 59);
  doc.rect(40, 40, pageWidth - 80, 50, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("CONFIDENTIAL LABORATORY ANALYSIS", 55, 72);

  doc.setTextColor(30, 41, 59);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("PATIENT IDENTIFICATION (REPEAT FOR FILING)", 40, 125);
  doc.setFont("helvetica", "normal");
  doc.text("Patient Full Name: Jane Angela Doe-Holloway", 40, 145);
  doc.text("Social Security Number: 987-00-4321", 40, 165);
  doc.text("Accession ID: ACC-9940129", 40, 185);

  doc.setDrawColor(203, 213, 225);
  doc.line(40, 210, pageWidth - 40, 210);

  doc.setFont("helvetica", "bold");
  doc.text("SPECIMEN ASSAY RESULTS", 40, 240);
  doc.setFont("helvetica", "normal");
  doc.text("1. Complete Blood Count (CBC): Normal indices across differential", 40, 260);
  doc.text("2. Fasting Glucose Index: 92 mg/dL [Reference range: 70 - 99]", 40, 280);
  doc.text("3. High-Sensitivity Troponin: < 0.01 ng/mL", 40, 300);
  doc.text("4. Genetic Marker Screen: Internal Lab Hash #9983-KLA-291", 40, 320);

  doc.setDrawColor(148, 163, 184);
  doc.rect(40, 520, 220, 70);
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text("Authorized Lab Director Signature:", 45, 535);
  doc.setFont("courier", "italic");
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text("Dr. Sarah Jenkins, Ph.D.", 50, 570);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(148, 163, 184);
  doc.text("Document Ref: CLIN-2026-0924-A · Page 2 of 2 · Stored with strict retention policy", 40, 800);

  return doc.output("blob");
}
