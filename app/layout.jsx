import "./globals.css";
import { Providers } from "./providers";
import Navbar from "./components/Navbar";

export const metadata = {
  title: "Mortgage AI Calc — Smart Mortgage Analyser",
  description:
    "Upload your mortgage statement or enter your details. Get smart insights on how to pay off your mortgage faster, save on interest, and plan for rate changes.",
  metadataBase: new URL("https://mortgageaicalc.co.uk"),
  openGraph: {
    title: "Mortgage AI Calc — Pay Off Your Mortgage Years Faster",
    siteName: "Mortgage AI Calc",
    description:
      "Advanced calculations show you exactly how to save thousands in interest.",
    type: "website",
    url: "https://mortgageaicalc.co.uk",
  },
  twitter: {
    card: "summary",
    title: "Mortgage AI Calc — Smart Mortgage Analyser",
    description:
      "Advanced calculations show you exactly how to save thousands in interest.",
  },
  alternates: {
    canonical: "https://mortgageaicalc.co.uk",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Mortgage AI Calc",
  url: "https://mortgageaicalc.co.uk",
  description:
    "AI-powered mortgage analyser. Upload your statement to see how overpayments can save you thousands in interest.",
  applicationCategory: "FinanceApplication",
  operatingSystem: "Web",
  author: {
    "@type": "Person",
    name: "Dr. Ahmed Sarwar",
  },
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "GBP",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <Providers>
          <Navbar />
          {children}
        </Providers>
      </body>
    </html>
  );
}
