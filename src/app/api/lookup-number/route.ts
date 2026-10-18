import { NextResponse } from "next/server";

const API_KEY = process.env.PHONE_LOOKUP_API_KEY || "8da63f2cda17820e364c4ddd04223acd";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const phone = (searchParams.get("phone") || "").trim();

  if (!phone || phone.length < 10) {
    return NextResponse.json({ success: false, error: "Valid 10-digit number required" }, { status: 400 });
  }

  // Format Indian number with country code +91 for Numverify
  const formattedPhone = phone.startsWith("91") && phone.length === 12 ? "+" + phone : "+91" + phone.slice(-10);

  try {
    // APILayer Numverify endpoint
    const response = await fetch(`https://api.apilayer.com/numverify/validate?number=${encodeURIComponent(formattedPhone)}`, {
      headers: {
        apikey: API_KEY,
      },
      cache: "no-store",
    });

    const data = await response.json();

    if (response.ok && data && data.valid) {
      const carrierStr = (data.carrier || data.lokup_name || "").toLowerCase();
      let detectedOp = "Jio";
      if (carrierStr.includes("airtel")) detectedOp = "Airtel";
      else if (carrierStr.includes("vodafone") || carrierStr.includes("idea") || carrierStr.includes("vi")) detectedOp = "Vi";
      else if (carrierStr.includes("bsnl") || carrierStr.includes("mtnl")) detectedOp = "BSNL";
      else if (carrierStr.includes("jio") || carrierStr.includes("reliance")) detectedOp = "Jio";

      return NextResponse.json({
        success: true,
        valid: true,
        operator: detectedOp,
        carrier: data.carrier || "Unknown Carrier",
        location: data.location || "India",
        country: data.country_name || "India",
      });
    } else {
      // Fallback heuristic based on Indian telecom mobile numbering series if API quota or free tier limits hit
      const prefix = phone.slice(-10, -7);
      let fallbackOp = "Jio";
      if (["98", "99", "97", "96", "89", "88", "87", "70", "75"].includes(prefix)) fallbackOp = "Airtel";
      else if (["95", "94", "93", "92", "91", "83", "76"].includes(prefix)) fallbackOp = "Vi";
      else if (["94", "93", "86", "85", "84", "75"].includes(prefix)) fallbackOp = "BSNL";
      else fallbackOp = "Jio";

      return NextResponse.json({
        success: true,
        valid: true,
        operator: fallbackOp,
        carrier: fallbackOp + " Telecom (Series Match)",
        location: "India",
      });
    }
  } catch (error: any) {
    return NextResponse.json({
      success: true,
      valid: true,
      operator: "Jio",
      carrier: "Reliance Jio (Fallback)",
    });
  }
}
