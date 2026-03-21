import { NextResponse } from "next/server";
import { Anthropic } from "@anthropic-ai/sdk";

export const dynamic = "force-dynamic";

export async function POST(request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "Server configuration error: API key not configured." },
      { status: 500 }
    );
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const {
    balance,
    payment,
    rate,
    years,
    bank,
    mortgageType,
    rateType,
    fixedUntil,
    earlyRepaymentCharge,
    overpaymentAllowance,
    originalLoanAmount,
    originalTerm,
    isIslamicFinance,
    revertingTo,
    ercEndDate,
    propertyAddress,
    totalInterest,
    maxMonthlyOverpayment,
    maxAnnualOverpayment,
    tenYearsExtra,
    tenYearsInterestSaved,
    tenYearsWithinLimit,
    tenYearsMaxYearsSaved,
    tenYearsMaxInterestSaved,
  } = body;

  const islamicNote = isIslamicFinance
    ? `This is an Islamic Finance Home Purchase Plan (HPP), likely from ${bank || "an Islamic bank"}. Use "rental charges" instead of "interest", "Home Purchase Plan" instead of "mortgage", "acquisition balance" instead of "outstanding balance". Do NOT recommend offset mortgages. DO include an HPP-specific tip about making lump sum overpayments directly to reduce the acquisition balance and contacting ${bank || "the lender"} to confirm the overpayment allowance process.`
    : `This is a conventional UK mortgage.`;

  const prompt = `You are a senior UK mortgage adviser generating a personalised written report for a homeowner.

${islamicNote}

Mortgage details:
- Lender: ${bank || "Not specified"}
- Outstanding balance: £${Number(balance).toLocaleString("en-GB")}
- Monthly payment: £${Number(payment).toLocaleString("en-GB")}
- Interest/rental rate: ${rate}%
- Remaining term: ${years} years
- Mortgage type: ${mortgageType || "Repayment"}
- Rate type: ${rateType || "Fixed"}
- Fixed rate ends: ${fixedUntil || "Not specified"}
- Reverts to: ${revertingTo || "Not specified"}
- Early Repayment Charge: ${earlyRepaymentCharge ? earlyRepaymentCharge + "% until " + (ercEndDate || "end of fixed period") : "None"}
- Annual overpayment allowance: ${overpaymentAllowance || 10}%
- Max monthly overpayment without penalty: £${Number(maxMonthlyOverpayment).toLocaleString("en-GB")}
- Max annual overpayment without penalty: £${Number(maxAnnualOverpayment).toLocaleString("en-GB")}
- Total ${isIslamicFinance ? "rental charges" : "interest"} at current rate: £${Number(totalInterest).toLocaleString("en-GB")}
- To pay off 10 years sooner: extra £${Number(tenYearsExtra).toLocaleString("en-GB")}/month saves £${Number(tenYearsInterestSaved).toLocaleString("en-GB")} in ${isIslamicFinance ? "rental charges" : "interest"}
- That overpayment is ${tenYearsWithinLimit ? "within" : "EXCEEDS"} the penalty-free allowance
- At max allowance: saves ${tenYearsMaxYearsSaved} years and £${Number(tenYearsMaxInterestSaved).toLocaleString("en-GB")}
${originalLoanAmount ? `- Original loan amount: £${Number(originalLoanAmount).toLocaleString("en-GB")}` : ""}
${originalTerm ? `- Original term: ${originalTerm} years` : ""}
${propertyAddress ? `- Property: ${propertyAddress}` : ""}

Generate 5–7 personalised, specific, actionable recommendations for this homeowner. Each must:
1. Reference exact £ figures from the data above (do not round or generalise)
2. Be specific to their situation (rate type, bank, term, Islamic/conventional)
3. Be actionable — tell them exactly what to do
4. Be a single sentence or two at most
5. Use plain English, no jargon

Return ONLY a JSON array of strings — no markdown, no code fences, no explanation. Example format:
["Recommendation 1 here.", "Recommendation 2 here.", "Recommendation 3 here."]`;

  let response;
  try {
    response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });
  } catch (err) {
    console.error("Processing API error:", err);
    return NextResponse.json(
      { error: "AI service error. Please try again." },
      { status: 502 }
    );
  }

  const responseText = response.content[0].text.trim();
  let recommendations;
  try {
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    recommendations = JSON.parse(jsonMatch ? jsonMatch[0] : responseText);
    if (!Array.isArray(recommendations)) throw new Error("Not an array");
  } catch {
    console.error("Failed to parse recommendations response:", responseText);
    return NextResponse.json(
      { error: "Failed to parse AI response." },
      { status: 500 }
    );
  }

  return NextResponse.json({ recommendations });
}
