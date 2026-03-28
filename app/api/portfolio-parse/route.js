import { NextResponse } from "next/server";
import { Anthropic } from "@anthropic-ai/sdk";

export const dynamic = "force-dynamic";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const PDF_MAGIC = Buffer.from([0x25, 0x50, 0x44, 0x46]);

// Page limits per doc type — agent docs only need first 2 pages
const PAGE_LIMITS = { mortgage: 6, tenancy: 6, agent: 2 };
// Text cap per doc type — agent needs very little text
const TEXT_CAPS = { mortgage: 8000, tenancy: 8000, agent: 3000 };

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

  tenancy: `You are an expert UK tenancy agreement parser. Extract tenancy details from this Assured Shorthold Tenancy (AST) or similar rental agreement.

Return ONLY valid JSON (no markdown, no explanation):
{
  "monthly_rent": number or null,
  "tenant_name": string or null,
  "tenancy_start": "YYYY-MM-DD" or null,
  "tenancy_end": "YYYY-MM-DD" or null,
  "deposit_amount": number or null,
  "address": string or null,
  "break_clause_date": "YYYY-MM-DD" or null,
  "break_clause_notice_months": number or null,
  "deposit_scheme": "DPS" | "MyDeposits" | "TDS" | null,
  "pet_clause": "allowed" | "not_allowed" | "with_permission" | null,
  "notice_period_months": number or null,
  "permitted_occupants": number or null
}

Rules:
- monthly_rent: monthly rent in £ (if stated as annual, divide by 12; number only)
- tenant_name: full name of tenant(s), multiple names separated by " & "
- tenancy_start: start date in ISO YYYY-MM-DD format
- tenancy_end: end/expiry date in ISO YYYY-MM-DD format (the fixed-term end, not a rolling/periodic extension)
- deposit_amount: security deposit in £ (number only)
- address: full property address
- break_clause_date: earliest date on which either party can exercise a break clause (ISO YYYY-MM-DD), or null if no break clause
- break_clause_notice_months: notice period in months required to exercise the break clause, or null
- deposit_scheme: which government-approved deposit protection scheme is named (DPS = Deposit Protection Service, MyDeposits, TDS = Tenancy Deposit Scheme), or null if not mentioned
- pet_clause: "allowed" if pets are explicitly permitted, "not_allowed" if explicitly prohibited, "with_permission" if landlord consent is required, null if not mentioned
- notice_period_months: notice period either party must give to end a periodic/rolling tenancy, in months (usually 1 or 2), or null
- permitted_occupants: maximum number of permitted occupants if stated, or null
- Never guess or invent values — use null if not found.`,

  agent: `Extract the estate agent name and their management fee percentage from this document. Return ONLY valid JSON:
{"agent_name": string or null, "management_fee_pct": number or null}
Rules:
- agent_name: full name of the letting/management agency
- management_fee_pct: fee as a number (10% → 10, 8.25% → 8.25). If only amounts shown, calculate: (commission exc. VAT / gross rent) × 100. If VAT-inclusive, divide by 1.2 first.
- Never guess — use null if not found.`,
};

const FIELD_MAPS = {
  mortgage: ["outstanding_balance", "monthly_payment", "interest_rate", "remaining_years", "lender", "address"],
  tenancy: ["monthly_rent", "tenant_name", "tenancy_start", "tenancy_end", "deposit_amount", "address", "break_clause_date", "break_clause_notice_months", "deposit_scheme", "pet_clause", "notice_period_months", "permitted_occupants"],
  agent: ["agent_name", "management_fee_pct"],
};

// ─── Fast regex extraction for agent documents ──────────────────────────────
function tryRegexAgentExtraction(text) {
  if (!text) return null;

  let agentName = null;
  let feePct = null;

  // Try to find fee percentage — look for common patterns
  const feePatterns = [
    /(?:management\s*fee|our\s*fee|agent(?:'?s)?\s*fee|commission|letting\s*fee)[:\s]*(\d+(?:\.\d+)?)\s*%/i,
    /(\d+(?:\.\d+)?)\s*%\s*(?:\+\s*vat)?[^%]*(?:management|commission|our\s*fee|agent)/i,
    /(?:fee|commission|charge)[:\s]*(\d+(?:\.\d+)?)\s*%/i,
  ];
  for (const pattern of feePatterns) {
    const match = text.match(pattern);
    if (match) {
      const pct = parseFloat(match[1]);
      if (pct > 0 && pct < 50) { feePct = pct; break; }
    }
  }

  // If no direct percentage, try to calculate from amounts
  if (feePct === null) {
    const rentMatch = text.match(/(?:rent|gross\s*rent)[:\s]*£?\s*([\d,]+(?:\.\d{2})?)/i);
    const commMatch = text.match(/(?:commission|management\s*fee|our\s*fee|agent\s*fee|deduction)[:\s]*£?\s*([\d,]+(?:\.\d{2})?)/i);
    if (rentMatch && commMatch) {
      const rent = parseFloat(rentMatch[1].replace(/,/g, ""));
      let comm = parseFloat(commMatch[1].replace(/,/g, ""));
      // Check if there's a VAT line suggesting the commission includes VAT
      const vatMatch = text.match(/vat[:\s]*£?\s*([\d,]+(?:\.\d{2})?)/i);
      if (vatMatch) {
        // Commission is likely exc. VAT already if VAT is shown separately
      } else if (text.match(/inc(?:luding|l\.?)?\s*vat/i)) {
        comm = comm / 1.2;
      }
      if (rent > 0 && comm > 0 && comm < rent) {
        feePct = Math.round((comm / rent) * 10000) / 100;
      }
    }
  }

  // Try to find agent name — usually at the top, in headers or "from" lines
  const namePatterns = [
    /(?:from|agent|agency|company|lettings?\s*by|managed\s*by)[:\s]*([A-Z][A-Za-z\s&']+(?:Ltd|Limited|LLP|PLC|Group|Lettings?|Properties|Estate\s*Agents?)?)/i,
    /^([A-Z][A-Za-z\s&']{3,}(?:Ltd|Limited|LLP|PLC|Lettings?|Properties|Estate\s*Agents?))/m,
  ];
  for (const pattern of namePatterns) {
    const match = text.match(pattern);
    if (match) {
      agentName = match[1].trim().replace(/\s+/g, " ");
      if (agentName.length > 3 && agentName.length < 80) break;
      agentName = null;
    }
  }

  // Only return if we got at least the fee (the most important field)
  if (feePct !== null) {
    return { agent_name: agentName, management_fee_pct: feePct };
  }

  return null;
}

// ─── Main handler ───────────────────────────────────────────────────────────
export async function POST(request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "Server configuration error." }, { status: 500 });
  }

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

    // ── Step 1: Extract text from PDF ────────────────────────────────────────
    let documentText = null;
    if (isPdf) {
      try {
        const { PDFParse } = await import("pdf-parse");
        const maxPages = PAGE_LIMITS[docType] || 6;
        const parser = new PDFParse({ data: buffer, max: maxPages });
        const pdfData = await parser.getText();
        documentText = pdfData.text?.trim();
      } catch {
        // fall through
      }
    }

    // ── Step 2: For agent docs, try fast regex extraction first ───────────────
    if (docType === "agent" && documentText && documentText.length > 20) {
      const regexResult = tryRegexAgentExtraction(documentText);
      if (regexResult && regexResult.management_fee_pct !== null) {
        // Fast path — got what we need without AI
        const result = {};
        FIELD_MAPS.agent.forEach((key) => {
          if (regexResult[key] != null) result[key] = regexResult[key];
        });
        return NextResponse.json(result);
      }
    }

    // ── Step 3: Build AI prompt ──────────────────────────────────────────────
    let messageContent;
    const textCap = TEXT_CAPS[docType] || 8000;

    if (documentText && documentText.length > 100) {
      const truncated = documentText.length > textCap ? documentText.slice(0, textCap) + "\n[...truncated]" : documentText;
      messageContent = [
        { type: "text", text: `${PROMPTS[docType]}\n\n--- DOCUMENT START ---\n${truncated}\n--- DOCUMENT END ---` },
      ];
    } else if (isPdf) {
      // Only fall back to base64 for non-agent docs (agent docs are too slow this way)
      if (docType === "agent") {
        return NextResponse.json({ error: "Could not read this document. Please enter the agent name and fee manually." }, { status: 400 });
      }
      messageContent = [
        { type: "document", source: { type: "base64", media_type: "application/pdf", data: buffer.toString("base64") } },
        { type: "text", text: PROMPTS[docType] },
      ];
    } else {
      const mediaType = file.type.startsWith("image/") ? file.type : "image/jpeg";
      messageContent = [
        { type: "image", source: { type: "base64", media_type: mediaType, data: buffer.toString("base64") } },
        { type: "text", text: PROMPTS[docType] },
      ];
    }

    // ── Step 4: Call Claude with timeout ──────────────────────────────────────
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    let response;
    try {
      const timeoutMs = docType === "agent" ? 10000 : 30000;
      response = await Promise.race([
        client.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: docType === "agent" ? 128 : 512,
          messages: [{ role: "user", content: messageContent }],
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("TIMEOUT")), timeoutMs)
        ),
      ]);
    } catch (err) {
      if (err.message === "TIMEOUT") {
        return NextResponse.json(
          { error: "Extraction timed out — please enter details manually." },
          { status: 408 }
        );
      }
      const msg =
        err?.status === 401 ? "Invalid API key." :
        err?.status === 429 || err?.status === 529 ? "Service busy — please try again in a moment." :
        "Could not extract details automatically — please enter manually.";
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
    return NextResponse.json({ error: "Something went wrong. Please enter details manually." }, { status: 500 });
  }
}
