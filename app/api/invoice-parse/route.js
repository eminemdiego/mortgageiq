import { NextResponse } from "next/server";
import { Anthropic } from "@anthropic-ai/sdk";

export const dynamic = "force-dynamic";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const PDF_MAGIC = Buffer.from([0x25, 0x50, 0x44, 0x46]);

const INVOICE_PROMPT = `You are an expert UK accounts assistant. Extract invoice/receipt details from this document.

Return ONLY valid JSON (no markdown, no explanation):
{
  "supplier": string or null,
  "invoice_date": "YYYY-MM-DD" or null,
  "invoice_number": string or null,
  "description": string or null,
  "amount": number or null,
  "vat_amount": number or null,
  "category": string
}

Field rules:
- supplier: full company/trader name
- invoice_date: date on the invoice in ISO YYYY-MM-DD format
- invoice_number: invoice or receipt reference number (string)
- description: short description of the work or goods (1-2 sentences)
- amount: total amount due/paid in £ including VAT (number, no £ symbol)
- vat_amount: VAT element in £ (number), or null if not shown or zero-rated
- category: classify the expense. Return exactly one of:
  "repairs_maintenance" (plumbing, electrical, boiler, general repairs, decorating)
  "gas_safety" (gas safety certificate / CP12)
  "eicr" (electrical installation condition report / EICR)
  "epc" (energy performance certificate)
  "insurance" (buildings insurance, landlord insurance, contents)
  "ground_rent" (ground rent)
  "service_charge" (service charge, management charge on leasehold)
  "professional_fees" (accountant, solicitor, surveyor)
  "letting_agent" (letting agent fees, tenant-find fee, management commission)
  "cleaning" (cleaning, inventory check, check-out report)
  "furniture_appliances" (furniture, white goods, appliances)
  "other" (anything that doesn't fit above)

- Never guess or invent values — use null if not found.`;

export async function POST(request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "Server configuration error." }, { status: 500 });
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
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
        const parser = new PDFParse({ data: buffer, max: 3 });
        const pdfData = await parser.getText();
        documentText = pdfData.text?.trim();
      } catch {
        // fall through to document API
      }

      if (documentText && documentText.length > 50) {
        const truncated = documentText.length > 4000 ? documentText.slice(0, 4000) : documentText;
        messageContent = [{ type: "text", text: `${INVOICE_PROMPT}\n\n--- DOCUMENT START ---\n${truncated}\n--- DOCUMENT END ---` }];
      } else {
        messageContent = [
          { type: "document", source: { type: "base64", media_type: "application/pdf", data: buffer.toString("base64") } },
          { type: "text", text: INVOICE_PROMPT },
        ];
      }
    } else {
      const mediaType = file.type.startsWith("image/") ? file.type : "image/jpeg";
      messageContent = [
        { type: "image", source: { type: "base64", media_type: mediaType, data: buffer.toString("base64") } },
        { type: "text", text: INVOICE_PROMPT },
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
        "Invoice processing failed.";
      return NextResponse.json({ error: msg }, { status: 502 });
    }

    const responseText = response.content[0].text;
    let extracted;
    try {
      const match = responseText.match(/\{[\s\S]*\}/);
      extracted = JSON.parse(match ? match[0] : responseText);
    } catch {
      return NextResponse.json({ error: "Could not read invoice. Please enter details manually." }, { status: 400 });
    }

    return NextResponse.json({
      supplier: extracted.supplier || null,
      invoice_date: extracted.invoice_date || null,
      invoice_number: extracted.invoice_number || null,
      description: extracted.description || null,
      amount: extracted.amount ?? null,
      vat_amount: extracted.vat_amount ?? null,
      category: extracted.category || "other",
    });
  } catch (err) {
    console.error("invoice-parse error:", err);
    return NextResponse.json({ error: "Unexpected error. Please try again." }, { status: 500 });
  }
}
