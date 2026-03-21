import { Anthropic } from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file) {
      return new Response(
        JSON.stringify({ error: "No file provided" }),
        { status: 400 }
      );
    }

    // Read file buffer
    const buffer = await file.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");

    // Determine media type
    let mediaType = "application/pdf";
    if (file.type.includes("image")) {
      mediaType = file.type;
    }

    // Prepare message for Claude
    let messageContent;

    if (mediaType === "application/pdf") {
      messageContent = [
        {
          type: "document",
          source: {
            type: "base64",
            media_type: "application/pdf",
            data: base64,
          },
        },
        {
          type: "text",
          text: `Extract the following mortgage details from this statement and return ONLY a valid JSON object with these exact fields (use null for any missing values):
{
  "outstandingBalance": number,
  "monthlyPayment": number,
  "interestRate": number,
  "remainingYears": number,
  "lenderName": string,
  "mortgageType": string (one of "Repayment", "Interest Only", "Part & Part"),
  "rateType": string (one of "Fixed", "Variable / Tracker", "SVR (Standard Variable Rate)", "Discounted Variable")
}

Rules:
- Extract ONLY these fields
- Remove currency symbols and commas from numbers
- Convert percentages to decimal (e.g., 4.75% = 4.75)
- Return ONLY the JSON object, no other text
- If you cannot find a field, set it to null`,
        },
      ];
    } else {
      // Image file
      messageContent = [
        {
          type: "image",
          source: {
            type: "base64",
            media_type: mediaType,
            data: base64,
          },
        },
        {
          type: "text",
          text: `Extract the following mortgage details from this image and return ONLY a valid JSON object with these exact fields (use null for any missing values):
{
  "outstandingBalance": number,
  "monthlyPayment": number,
  "interestRate": number,
  "remainingYears": number,
  "lenderName": string,
  "mortgageType": string (one of "Repayment", "Interest Only", "Part & Part"),
  "rateType": string (one of "Fixed", "Variable / Tracker", "SVR (Standard Variable Rate)", "Discounted Variable")
}

Rules:
- Extract ONLY these fields
- Remove currency symbols and commas from numbers
- Convert percentages to decimal (e.g., 4.75% = 4.75)
- Return ONLY the JSON object, no other text
- If you cannot find a field, set it to null`,
        },
      ];
    }

    // Call Claude API
    const response = await client.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: messageContent,
        },
      ],
    });

    // Extract JSON from response
    const responseText = response.content[0].text;

    // Parse the JSON
    let extractedData;
    try {
      // Try to extract JSON from the response (in case there's extra text)
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        extractedData = JSON.parse(jsonMatch[0]);
      } else {
        extractedData = JSON.parse(responseText);
      }
    } catch (parseError) {
      console.error("Failed to parse Claude response:", responseText);
      return new Response(
        JSON.stringify({
          error: "Failed to parse document. Please try another file or enter details manually.",
          raw: responseText,
        }),
        { status: 400 }
      );
    }

    // Validate extracted data
    const result = {
      outstandingBalance:
        extractedData.outstandingBalance !== null &&
        extractedData.outstandingBalance !== undefined
          ? String(extractedData.outstandingBalance)
          : "",
      monthlyPayment:
        extractedData.monthlyPayment !== null &&
        extractedData.monthlyPayment !== undefined
          ? String(extractedData.monthlyPayment)
          : "",
      interestRate:
        extractedData.interestRate !== null &&
        extractedData.interestRate !== undefined
          ? String(extractedData.interestRate)
          : "",
      remainingYears:
        extractedData.remainingYears !== null &&
        extractedData.remainingYears !== undefined
          ? String(extractedData.remainingYears)
          : "",
      bank: extractedData.lenderName || "",
      mortgageType: extractedData.mortgageType || "Repayment",
      rateType: extractedData.rateType || "Fixed",
    };

    return new Response(JSON.stringify(result), { status: 200 });
  } catch (error) {
    console.error("Parse API error:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to process file. Please try again or enter details manually.",
      }),
      { status: 500 }
    );
  }
}
