import { NextResponse } from "next/server";
import { Anthropic } from "@anthropic-ai/sdk";

export const dynamic = "force-dynamic";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const PDF_MAGIC = Buffer.from([0x25, 0x50, 0x44, 0x46]);

const PROMPTS = {
  mortgage: `You are an expert UK mortgage document parser. Extract key mortgage details from this statement.
This may be a traditional UK mortgage OR an Islamic finance Home Purchase Plan (HPP) from Gatehouse Bank, Al Rayan Bank, etc.
Islamic terminology: "Rental Rate" = interest rate, "Acquisition payment" = capital portion, total of acquisition + rental = monthly payment.

Return ONLY valid JSON (no markdown, no explanation):
{
  "outstanding_balance": number or null,
  "monthly_payment": number or null,
  "interest_rate": number or null,
  "remaining_years": number or null,
  "lender": string or null,
  "address": string or null
}

Rules:
- outstanding_balance: current/closing balance in £ (number only, strip £ and commas)
- monthly_payment: regular monthly payment amount in £
- interest_rate: annual rate as plain number (4.75% → 4.75)
- remaining_years: remaining term in years, round to 1 decimal place
- lender: full bank/lender name as shown on the document
- address: property address if shown on the document
- Never guess or invent values — use null if not found.`,

  tenancy: `You are an expert UK tenancy agreement parser. Extract tenancy details from this Assured Shorthold Tenancy or similar rental agreement.

Return ONLY valid JSON (no markdown, no explanation):
{
  "monthly_rent": number or null,
  "tenant_name": string or null,
  "tenancy_start": "YYYY-MM-DD" or null,
  "tenancy_end": "YYYY-MM-DD" or null,
  "deposit_amount": number or null,
  "address": string or null
}

Rules:
- monthly_rent: monthly rent in £ (if stated as annual, divide by 12; number only)
- tenant_name: full name of tenant(s), multiple names separated by " & "
- tenancy_start: start date in ISO YYYY-MM-DD format
- tenancy_end: end/expiry date in ISO YYYY-MM-DD format
- deposit_amount: security deposit in £ (number only)
- address: full property address
- Never guess or invent values — use null if not found.`,

  agent: `You are an expert UK lettings agent agreement parser. Extract estate agent details from this management agreement or terms of business.

Return ONLY valid JSON (no markdown, no explanation):
{
  "agent_name": string or null,
  "management_fee_pct": number or null
}

Rules:
- agent_name: full name of the letting/management agency
- management_fee_pct: monthly management fee as a percentage number (10% → 10)
- Never guess or invent values — use null if not found.`,
};

const FIELD_MAPS = {
  mortgage: ["outstanding_balance", "monthly_payment", "interest_rate", "remaining_years", "lender", "address"],
  tenancy: ["monthly_rent", "tenant_name", "tenancy_start", "tenancy_end", "deposit_amount", "address"],
  agent: ["agent_name", "management_fee_pct"],
};

export async function POST(request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "Server configuration error." }, { status: 500 });
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const docType = formData.get("type");

    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
    if (!PROMPTS[docType]) return NextResponse.json({ error: "Invalid document type" }, { status: 400 });
    if (file.size > MAX_FILE_SIZE) return NextResponse.json({ error: "File too large (max 10 MB)" }, { status: 413 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const isPdf = file.type === "application/pdf" || file.name?.toLowerCase().endsWith(".pdf");

    if (isPdf && !buffer.slice(0, 4).equals(PDF_MAGIC)) {
      return NextResponse.json({ error: "File does not appear to be a valid PDF." }, { status: 415 });
    }

    let messageContent;

    if (isPdf) {
      let documentText = null;
      try {
        const { PDFParse } = await import("pdf-parse");
        const parser = new PDFParse({ data: buffer });
        const pdfData = await parser.getText();
        documentText = pdfData.text?.trim();
      } catch {
        // fall through to document API
      }

      if (documentText && documentText.length > 100) {
        messageContent = [
          { type: "text", text: `${PROMPTS[docType]}\n\n--- DOCUMENT START ---\n${documentText}\n--- DOCUMENT END ---` },
        ];
      } else {
        messageContent = [
          { type: "document", source: { type: "base64", media_type: "application/pdf", data: buffer.toString("base64") } },
          { type: "text", text: PROMPTS[docType] },
        ];
      }
    } else {
      const mediaType = file.type.startsWith("image/") ? file.type : "image/jpeg";
      messageContent = [
        { type: "image", source: { type: "base64", media_type: mediaType, data: buffer.toString("base64") } },
        { type: "text", text: PROMPTS[docType] },
      ];
    }

    let response;
    try {
      response = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 512,
        messages: [{ role: "user", content: messageContent }],
      });
    } catch (err) {
      const msg =
        err?.status === 401 ? "Invalid API key." :
        err?.status === 429 || err?.status === 529 ? "Service busy — please try again." :
        "Document processing failed.";
      return NextResponse.json({ error: msg }, { status: 502 });
    }

    const responseText = response.content[0].text;
    let extracted;
    try {
      const match = responseText.match(/\{[\s\S]*\}/);
      extracted = JSON.parse(match ? match[0] : responseText);
    } catch {
      return NextResponse.json({ error: "Could not read document. Please enter details manually." }, { status: 400 });
    }

    // Return only the fields for this doc type, dropping nulls
    const result = {};
    FIELD_MAPS[docType].forEach((key) => {
      if (extracted[key] != null) result[key] = extracted[key];
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error("portfolio-parse error:", err);
    return NextResponse.json({ error: "Unexpected error. Please try again." }, { status: 500 });
  }
}
