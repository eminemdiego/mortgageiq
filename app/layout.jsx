import "./globals.css";
import { Providers } from "./providers";

export const metadata = {
  title: "MortgageIQ — AI-Powered Mortgage Analyser",
  description:
    "Upload your mortgage statement or enter your details. Get AI-powered insights on how to pay off your mortgage faster, save on interest, and plan for rate changes.",
  openGraph: {
    title: "MortgageIQ — Pay Off Your Mortgage Years Faster",
    description:
      "AI analyses your mortgage and shows you exactly how to save thousands in interest.",
    type: "website",
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
