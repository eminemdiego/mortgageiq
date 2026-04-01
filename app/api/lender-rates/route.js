import { createClient } from "@supabase/supabase-js";
import { auth } from "@/app/api/auth/[...nextauth]/route";

export const dynamic = "force-dynamic";

const ADMIN_EMAIL = "ahmed.sarwar@hotmail.co.uk";

function supabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
}

// Lender name aliases for fuzzy matching
const LENDER_ALIASES = {
  "gatehouse bank": ["gatehouse bank plc", "gatehouse bank ltd", "gatehouse"],
  "halifax": ["halifax plc", "halifax (a trading name of bank of scotland)", "halifax a division of bank of scotland", "hbos"],
  "nationwide": ["nationwide building society", "nationwide bs"],
  "natwest": ["national westminster bank", "national westminster bank plc", "natwest bank", "natwest plc"],
  "barclays": ["barclays bank", "barclays bank plc", "barclays bank uk plc"],
  "hsbc": ["hsbc bank", "hsbc uk bank plc", "hsbc bank plc"],
  "santander": ["santander uk", "santander uk plc", "abbey national"],
  "virgin money": ["virgin money plc", "clydesdale bank", "yorkshire bank"],
  "lloyds": ["lloyds bank", "lloyds banking group", "lloyds bank plc", "lloyds tsb"],
  "tsb": ["tsb bank", "tsb bank plc"],
  "coventry bs": ["coventry building society", "coventry bs"],
  "yorkshire bs": ["yorkshire building society"],
  "skipton bs": ["skipton building society", "skipton"],
  "al rayan bank": ["al rayan bank plc", "al rayan", "islamic bank of britain"],
  "the mortgage works": ["tmw", "the mortgage works (uk) plc"],
  "paragon": ["paragon bank", "paragon mortgages", "paragon bank plc"],
  "bm solutions": ["bm solutions (a trading name of bank of scotland)", "birmingham midshires"],
  "landbay": ["landbay partners"],
  "fleet mortgages": ["fleet mortgages ltd"],
  "kent reliance": ["kent reliance for intermediaries", "onesavings bank"],
  "first direct": ["first direct bank"],
};

// Default lender rate data (seeded if table empty)
const DEFAULT_LENDERS = [
  { lender_name: "Gatehouse Bank", svr_rate: 7.99, bbr_margin: null, rate_type: "Islamic (Rental Rate)", source_url: "https://www.gatehousebank.com" },
  { lender_name: "Halifax", svr_rate: 7.99, bbr_margin: null, rate_type: "Standard", source_url: "https://www.halifax.co.uk/mortgages/existing-customers/your-mortgage-rate/" },
  { lender_name: "Nationwide", svr_rate: 7.49, bbr_margin: null, rate_type: "Standard", source_url: "https://www.nationwide.co.uk/mortgages/mortgage-rates/" },
  { lender_name: "NatWest", svr_rate: 7.74, bbr_margin: null, rate_type: "Standard", source_url: "https://www.natwest.com/mortgages/mortgage-rates.html" },
  { lender_name: "Barclays", svr_rate: 8.24, bbr_margin: null, rate_type: "Standard", source_url: "https://www.barclays.co.uk/mortgages/existing-customer-rates/" },
  { lender_name: "HSBC", svr_rate: 6.99, bbr_margin: null, rate_type: "Standard", source_url: "https://www.hsbc.co.uk/mortgages/our-rates/" },
  { lender_name: "Santander", svr_rate: 7.50, bbr_margin: null, rate_type: "Standard", source_url: "https://www.santander.co.uk/personal/mortgages/our-mortgage-rates" },
  { lender_name: "Virgin Money", svr_rate: 8.49, bbr_margin: null, rate_type: "Standard", source_url: "https://uk.virginmoney.com/mortgages/rates/" },
  { lender_name: "Lloyds", svr_rate: 7.99, bbr_margin: null, rate_type: "Standard", source_url: "https://www.lloydsbank.com/mortgages/our-rates.html" },
  { lender_name: "TSB", svr_rate: 7.99, bbr_margin: null, rate_type: "Standard", source_url: "https://www.tsb.co.uk/mortgages/rates/" },
  { lender_name: "Coventry BS", svr_rate: 7.49, bbr_margin: null, rate_type: "Standard", source_url: "https://www.coventrybuildingsociety.co.uk/mortgages/rates.html" },
  { lender_name: "Yorkshire BS", svr_rate: 7.99, bbr_margin: null, rate_type: "Standard", source_url: "https://www.ybs.co.uk/mortgages/rates" },
  { lender_name: "Skipton BS", svr_rate: 7.49, bbr_margin: null, rate_type: "Standard", source_url: "https://www.skipton.co.uk/mortgages/rates" },
  { lender_name: "Al Rayan Bank", svr_rate: 7.99, bbr_margin: null, rate_type: "Islamic (Rental Rate)", source_url: "https://www.alrayanbank.co.uk" },
  { lender_name: "The Mortgage Works", svr_rate: 8.49, bbr_margin: null, rate_type: "BTL", source_url: "https://www.themortgageworks.co.uk" },
  { lender_name: "Paragon", svr_rate: 8.10, bbr_margin: null, rate_type: "BTL", source_url: "https://www.paragonbankinggroup.co.uk" },
  { lender_name: "BM Solutions", svr_rate: 8.49, bbr_margin: null, rate_type: "BTL", source_url: "https://www.bmsolutions.co.uk" },
  { lender_name: "First Direct", svr_rate: 6.99, bbr_margin: null, rate_type: "Standard", source_url: "https://www.firstdirect.com/mortgages/rates/" },
];

// Fuzzy match a statement lender name to our database name
function matchLenderName(rawName) {
  if (!rawName) return null;
  const lower = rawName.toLowerCase().trim();

  // Direct match
  for (const [canonical, aliases] of Object.entries(LENDER_ALIASES)) {
    if (canonical === lower || aliases.some((a) => a === lower)) {
      // Return the title-case canonical name as stored in DB
      return DEFAULT_LENDERS.find((l) => l.lender_name.toLowerCase() === canonical)?.lender_name || canonical;
    }
  }

  // Partial match — check if any canonical or alias is contained in the raw name
  for (const [canonical, aliases] of Object.entries(LENDER_ALIASES)) {
    if (lower.includes(canonical) || aliases.some((a) => lower.includes(a))) {
      return DEFAULT_LENDERS.find((l) => l.lender_name.toLowerCase() === canonical)?.lender_name || canonical;
    }
  }

  // Check if raw name contains any DB lender name
  for (const lender of DEFAULT_LENDERS) {
    if (lower.includes(lender.lender_name.toLowerCase())) {
      return lender.lender_name;
    }
  }

  return null;
}

// Parse "SVR + 1%" style reversion strings
function parseReversionRate(revertingTo, svrRate, bbrRate) {
  if (!revertingTo || !svrRate) return null;
  const rt = revertingTo.toLowerCase().trim();

  // "SVR + X%" or "SVR - X%"
  const svrMatch = rt.match(/svr\s*([+-])\s*([\d.]+)\s*%?/);
  if (svrMatch) {
    const sign = svrMatch[1] === "+" ? 1 : -1;
    const margin = parseFloat(svrMatch[2]);
    return { rate: Math.round((svrRate + sign * margin) * 100) / 100, formula: revertingTo, base: "SVR", margin: sign * margin };
  }

  // Plain "SVR" or "Standard Variable Rate" or "Lender Variable Rate"
  if (rt.includes("svr") || rt.includes("standard variable") || rt.includes("lender variable") || rt.includes("variable rate")) {
    return { rate: svrRate, formula: revertingTo, base: "SVR", margin: 0 };
  }

  // "BBR + X%" / "Base Rate + X%"
  const bbrMatch = rt.match(/(?:bbr|base\s*rate)\s*([+-])\s*([\d.]+)\s*%?/);
  if (bbrMatch && bbrRate) {
    const sign = bbrMatch[1] === "+" ? 1 : -1;
    const margin = parseFloat(bbrMatch[2]);
    return { rate: Math.round((bbrRate + sign * margin) * 100) / 100, formula: revertingTo, base: "BBR", margin: sign * margin };
  }

  // Just a number like "8.5%"
  const numMatch = rt.match(/([\d.]+)\s*%/);
  if (numMatch) {
    return { rate: parseFloat(numMatch[1]), formula: revertingTo, base: "explicit", margin: 0 };
  }

  return null;
}

// GET — public: look up a lender's SVR and calculate reverted rate
// ?lender=Gatehouse Bank&revertingTo=SVR+1%
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const rawLender = searchParams.get("lender");
    const revertingTo = searchParams.get("revertingTo");
    const all = searchParams.get("all"); // if "true", return all lenders

    const sb = supabase();

    if (all === "true") {
      const { data, error } = await sb.from("lender_rates").select("*").order("lender_name");
      if (error) throw error;

      // If empty, seed with defaults
      if (!data || data.length === 0) {
        const seeded = DEFAULT_LENDERS.map((l) => ({ ...l, last_fetched: new Date().toISOString() }));
        const { data: inserted, error: insertErr } = await sb.from("lender_rates").insert(seeded).select();
        if (insertErr) throw insertErr;
        return Response.json({ lenders: inserted });
      }
      return Response.json({ lenders: data });
    }

    // Single lender lookup
    const matchedName = matchLenderName(rawLender);
    if (!matchedName) {
      return Response.json({
        matched: false,
        lender: rawLender,
        message: `We don't have live rate data for "${rawLender}" yet.`,
      });
    }

    // Fetch from DB
    const { data, error } = await sb.from("lender_rates").select("*").ilike("lender_name", matchedName).single();

    if (error || !data) {
      // Try to seed and retry
      const defaultLender = DEFAULT_LENDERS.find((l) => l.lender_name === matchedName);
      if (defaultLender) {
        const { data: inserted } = await sb.from("lender_rates").upsert({ ...defaultLender, last_fetched: new Date().toISOString() }, { onConflict: "lender_name" }).select().single();
        if (inserted) {
          const revertedRate = revertingTo ? parseReversionRate(revertingTo, inserted.svr_rate, inserted.bbr_rate) : null;
          return Response.json({
            matched: true,
            lender: inserted.lender_name,
            svr_rate: inserted.svr_rate,
            bbr_rate: inserted.bbr_rate,
            rate_type: inserted.rate_type,
            last_fetched: inserted.last_fetched,
            source_url: inserted.source_url,
            revertedRate,
          });
        }
      }
      return Response.json({ matched: false, lender: rawLender, message: `Could not find rate data for "${rawLender}".` });
    }

    const revertedRate = revertingTo ? parseReversionRate(revertingTo, data.svr_rate, data.bbr_rate) : null;

    return Response.json({
      matched: true,
      lender: data.lender_name,
      svr_rate: data.svr_rate,
      bbr_rate: data.bbr_rate,
      rate_type: data.rate_type,
      last_fetched: data.last_fetched,
      source_url: data.source_url,
      revertedRate,
    });
  } catch (err) {
    console.error("GET lender-rates error:", err);
    return Response.json({ error: "Failed to fetch lender rate" }, { status: 500 });
  }
}

// PUT — admin: update a lender's rate
export async function PUT(request) {
  try {
    const session = await auth();
    if (!session?.user?.email || session.user.email !== ADMIN_EMAIL) {
      return Response.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await request.json();
    const { id, ...updates } = body;
    if (!id) return Response.json({ error: "id required" }, { status: 400 });

    const sb = supabase();
    const { data, error } = await sb
      .from("lender_rates")
      .update({ ...updates, last_fetched: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return Response.json(data);
  } catch (err) {
    console.error("PUT lender-rates error:", err);
    return Response.json({ error: "Failed to update" }, { status: 500 });
  }
}

// POST — admin: add a new lender
export async function POST(request) {
  try {
    const session = await auth();
    if (!session?.user?.email || session.user.email !== ADMIN_EMAIL) {
      return Response.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await request.json();

    // Seed all defaults
    if (body.seed === true) {
      const sb = supabase();
      const seeded = DEFAULT_LENDERS.map((l) => ({ ...l, last_fetched: new Date().toISOString() }));
      const { data, error } = await sb.from("lender_rates").upsert(seeded, { onConflict: "lender_name" }).select();
      if (error) throw error;
      return Response.json({ seeded: data?.length || 0 });
    }

    const { lender_name, svr_rate, source_url, rate_type } = body;
    if (!lender_name || !svr_rate) return Response.json({ error: "lender_name and svr_rate required" }, { status: 400 });

    const sb = supabase();
    const { data, error } = await sb
      .from("lender_rates")
      .upsert({ lender_name, svr_rate, source_url: source_url || "", rate_type: rate_type || "Standard", last_fetched: new Date().toISOString() }, { onConflict: "lender_name" })
      .select()
      .single();
    if (error) throw error;
    return Response.json(data);
  } catch (err) {
    console.error("POST lender-rates error:", err);
    return Response.json({ error: "Failed to add lender" }, { status: 500 });
  }
}
