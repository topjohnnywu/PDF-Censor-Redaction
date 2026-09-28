"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

// Dynamically import client component with SSR disabled since it uses canvas and browser window APIs
const PdfCensorStudio = dynamic(
  () => import("@/components/pdf-censor-studio"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-screen w-full items-center justify-center bg-slate-950 text-slate-400">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
          <span className="text-sm font-medium">Loading PDF Censor Studio...</span>
        </div>
      </div>
    ),
  }
);

export default function Home() {
  return (
    <main className="min-h-screen w-full bg-slate-950">
      <PdfCensorStudio />
    </main>
  );
}
