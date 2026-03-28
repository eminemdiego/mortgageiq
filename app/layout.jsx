import "./globals.css";
import { Providers } from "./providers";
import Navbar from "./components/Navbar";

export const metadata = {
  title: "Mortgage AI Calc — Smart Mortgage Analyser",
  description:
    "Upload your mortgage statement or enter your details. Get smart insights on how to pay off your mortgage faster, save on interest, and plan for rate changes.",
  openGraph: {
    title: "Mortgage AI Calc — Pay Off Your Mortgage Years Faster",
    siteName: "Mortgage AI Calc",
    description:
      "Advanced calculations show you exactly how to save thousands in interest.",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Mortgage AI Calc — Smart Mortgage Analyser",
    description:
      "Advanced calculations show you exactly how to save thousands in interest.",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <Navbar />
          {children}
        </Providers>
      </body>
    </html>
  );
}
