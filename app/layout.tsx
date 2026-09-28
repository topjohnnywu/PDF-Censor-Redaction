import type {Metadata} from 'next';
import Script from 'next/script';
import './globals.css'; // Global styles

export const metadata: Metadata = {
  title: 'PDF Censor & Redaction Studio',
  description: 'Secure, 100% in-browser visual redaction tool for PDFs with pixel-level permanent burn-in export and multi-page alignment.',
  openGraph: {
    title: 'PDF Censor & Redaction Studio',
    description: 'Secure, 100% in-browser visual redaction tool for PDFs with pixel-level permanent burn-in export and multi-page alignment.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'PDF Censor & Redaction Studio',
    description: 'Secure, 100% in-browser visual redaction tool for PDFs with pixel-level permanent burn-in export and multi-page alignment.',
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en">
      <head>
        {/* Load battle-tested PDF.js library with worker & image decoders for scanned PDFs */}
        <Script
          src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs"
          type="module"
          strategy="beforeInteractive"
        />
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
