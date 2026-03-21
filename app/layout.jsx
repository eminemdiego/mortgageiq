import "./globals.css";
import { Providers } from "./providers";

export const metadata = {
  title: "Mortgage AI Calc — AI-Powered Mortgage Analyser",
  description:
    "Upload your mortgage statement or enter your details. Get AI-powered insights on how to pay off your mortgage faster, save on interest, and plan for rate changes.",
  openGraph: {
    title: "Mortgage AI Calc — Pay Off Your Mortgage Years Faster",
    siteName: "Mortgage AI Calc",
    description:
      "AI analyses your mortgage and shows you exactly how to save thousands in interest.",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Mortgage AI Calc — AI-Powered Mortgage Analyser",
    description:
      "AI analyses your mortgage and shows you exactly how to save thousands in interest.",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
