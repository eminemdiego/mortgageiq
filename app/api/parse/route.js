import { Anthropic } from "@anthropic-ai/sdk";
import { PDFParse } from "pdf-parse";

export const dynamic = "force-dynamic";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const EXTRACTION_PROMPT = `You are an expert UK mortgage document parser. Extract mortgage details from this document.

This may be a traditional UK mortgage OR an Islamic finance Home Purchase Plan (HPP) — such as those from Gatehouse Bank, Al Rayan Bank, Ahli United Bank, etc.

Islamic finance terminology translation:
- "Rental Rate" / "Rent Rate" → interest rate
- "Acquisition payment" / "Acquisition" → capital/repayment portion
- "Rental payment" → interest portion
- "Home Purchase Plan" / "HPP" / "Purchase Plan" / "Diminishing Musharakah" → mortgage type = "Repayment"
- "Balance as at [closing date]" → outstanding balance
- The total of acquisition + rental payments → monthly payment
- Bank name in the letterhead/header → lender name
- "Product Type" field → rate type
- "End Date" of current product → fixed rate end date
- "Reverting to" → what the rate reverts to after fix ends
- "Early Redemption Charge" / "ERC" → early repayment charge

Return ONLY a valid JSON object (no markdown, no explanation, just raw JSON):
{
  "outstandingBalance": number,
  "monthlyPayment": number,
  "interestRate": number,
  "remainingYears": number,
  "lenderName": string,
  "mortgageType": string,
  "rateType": string,
  "fixedUntil": string or null,
  "revertingTo": string or null,
  "earlyRepaymentCharge": number or null,
  "ercEndDate": string or null,
  "originalLoanAmount": number or null,
  "originalTerm": number or null,
  "propertyAddress": string or null,
  "isIslamicFinance": boolean
}

Field rules:
- outstandingBalance: the closing/outstanding balance in £ (strip £ and commas, return number)
- monthlyPayment: the regular monthly payment (for Islamic HPP: acquisition + rental total)
- interestRate: annual rate as plain number (4.75% → 4.75)
- remainingYears: remaining term in years (if shown in months, divide by 12 and round to 1dp)
- lenderName: full bank/lender name as shown on the statement
- mortgageType: one of exactly "Repayment", "Interest Only", "Part & Part"
- rateType: one of exactly "Fixed", "Variable / Tracker", "SVR (Standard Variable Rate)", "Discounted Variable"
- fixedUntil: human-readable end date of current rate, e.g. "March 2027"
- revertingTo: what rate reverts to, e.g. "Standard Variable Rate" or "SVR"
- earlyRepaymentCharge: ERC as a percentage number (3% → 3), or null
- ercEndDate: date ERC period ends, e.g. "December 2026", or null
- originalLoanAmount: original loan/purchase plan amount in £ (number), or null
- originalTerm: original mortgage term in years (number), or null
- propertyAddress: full property address if shown on the statement, or null
- isIslamicFinance: true if this is an Islamic finance/HPP product, false otherwise

If a field cannot be found, use null. Never guess or invent values.`;

export async function POST(request) {
  // Check API key upfront for a clear error
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY is not set");
    return Response.json(
      { error: "Server configuration error: API key not set. Please contact support." },
      { status: 500 }
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file) {
      return Response.json({ error: "No file provided" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const isPdf = file.type === "application/pdf" || file.name?.toLowerCase().endsWith(".pdf");

    let messageContent;

    if (isPdf) {
      // Try pdf-parse for text extraction; fall back to Claude vision if it fails
      let documentText = null;
      try {
        const parser = new PDFParse({ data: buffer });
        const pdfData = await parser.getText();
        documentText = pdfData.text?.trim();
      } catch (err) {
        console.error("pdf-parse failed, using Claude vision:", err.message);
      }

      if (documentText && documentText.length > 100) {
        messageContent = [
          {
            type: "text",
            text: `${EXTRACTION_PROMPT}\n\n--- DOCUMENT TEXT START ---\n${documentText}\n--- DOCUMENT TEXT END ---`,
          },
        ];
      } else {
        // Scanned/image PDF — send as base64 document
        messageContent = [
          {
            type: "document",
            source: {
              type: "base64",
              media_type: "application/pdf",
              data: buffer.toString("base64"),
            },
          },
          { type: "text", text: EXTRACTION_PROMPT },
        ];
      }
    } else {
      // Image file (JPG, PNG)
      const mediaType = file.type.startsWith("image/") ? file.type : "image/jpeg";
      messageContent = [
        {
          type: "image",
          source: {
            type: "base64",
            media_type: mediaType,
            data: buffer.toString("base64"),
          },
        },
        { type: "text", text: EXTRACTION_PROMPT },
      ];
    }

    let response;
    try {
      response = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        messages: [{ role: "user", content: messageContent }],
      });
    } catch (err) {
      console.error("Claude API error:", err);
      const msg = err?.status === 401
        ? "Invalid API key. Please check server configuration."
        : err?.status === 529 || err?.status === 429
        ? "AI service is busy. Please try again in a moment."
        : "AI service error. Please try again or enter details manually.";
      return Response.json({ error: msg }, { status: 502 });
    }

    const responseText = response.content[0].text;

    let extractedData;
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      extractedData = JSON.parse(jsonMatch ? jsonMatch[0] : responseText);
    } catch {
      console.error("Failed to parse Claude response:", responseText);
      return Response.json(
        { error: "Failed to read document structure. Please enter details manually." },
        { status: 400 }
      );
    }

    const str = (val) => (val !== null && val !== undefined ? String(val) : "");

    const result = {
      outstandingBalance:   str(extractedData.outstandingBalance),
      monthlyPayment:       str(extractedData.monthlyPayment),
      interestRate:         str(extractedData.interestRate),
      remainingYears:       str(extractedData.remainingYears),
      bank:                 extractedData.lenderName || "",
      mortgageType:         extractedData.mortgageType || "Repayment",
      rateType:             extractedData.rateType || "Fixed",
      fixedUntil:           extractedData.fixedUntil || "",
      revertingTo:          extractedData.revertingTo || "",
      earlyRepaymentCharge: str(extractedData.earlyRepaymentCharge),
      ercEndDate:           extractedData.ercEndDate || "",
      originalLoanAmount:   str(extractedData.originalLoanAmount),
      originalTerm:         str(extractedData.originalTerm),
      propertyAddress:      extractedData.propertyAddress || "",
      isIslamicFinance:     extractedData.isIslamicFinance || false,
    };

    return Response.json(result, { status: 200 });
  } catch (error) {
    console.error("Parse API unexpected error:", error);
    return Response.json(
      { error: "Unexpected error processing file. Please try again or enter details manually." },
      { status: 500 }
    );
  }
}
