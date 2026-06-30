/**
 * Kimi AI API Service
 * Powers website analysis, lead scoring, and outreach generation.
 */

const KIMI_BASE_URL = "https://api.moonshot.cn/v1";

interface KimiResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

function getHeaders(apiKey: string) {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };
}

/**
 * Analyse a business's website using Kimi AI.
 * Returns a detailed breakdown of scores and recommendations.
 */
export async function analyseWebsite(
  apiKey: string,
  businessName: string,
  websiteUrl: string | null,
  industry: string,
  model = "kimi-latest"
): Promise<{
  overallScore: number;
  websiteScore: number;
  seoScore: number;
  performanceScore: number;
  designScore: number;
  brandScore: number;
  marketingScore: number;
  conversionScore: number;
  localPresenceScore: number;
  growthPotential: number;
  salesProbability: number;
  priority: string;
  analysis: Record<string, unknown>;
  recommendations: string;
} | null> {
  const systemPrompt = `You are an expert web analyst and digital marketing consultant. Analyse a business website and return a JSON object with the following exact structure:

{
  "overallScore": 0-100,
  "websiteScore": 0-100,
  "seoScore": 0-100,
  "performanceScore": 0-100,
  "designScore": 0-100,
  "brandScore": 0-100,
  "marketingScore": 0-100,
  "conversionScore": 0-100,
  "localPresenceScore": 0-100,
  "growthPotential": 0-100,
  "salesProbability": 0-100,
  "priority": "low|medium|high|urgent",
  "analysis": {
    "modernAppearance": 0-100,
    "visualQuality": 0-100,
    "branding": 0-100,
    "typography": 0-100,
    "colors": 0-100,
    "navigation": 0-100,
    "userExperience": 0-100,
    "accessibility": 0-100,
    "coreWebVitals": 0-100,
    "mobileResponsiveness": 0-100,
    "pageSpeed": 0-100,
    "brokenLinks": 0-100,
    "callToActionQuality": 0-100,
    "leadGenerationPotential": 0-100,
    "conversionOptimisation": 0-100,
    "overallProfessionalism": 0-100,
    "contentQuality": 0-100,
    "trustSignals": 0-100,
    "technicalStack": ["tech1", "tech2"],
    "cmsDetection": "string or null",
    "hosting": "string or null",
    "outdatedTechnologies": ["tech1"],
    "ssl": true,
    "schema": true,
    "estimatedWebsiteAge": 0-20
  },
  "recommendations": "Brief summary of top 3 improvements needed"
}

Return ONLY valid JSON. No markdown, no explanation.`;

  const userPrompt = websiteUrl
    ? `Analyse the website ${websiteUrl} for the business "${businessName}" (industry: ${industry}). Assess design, SEO, performance, conversion optimisation, and overall quality. Return the JSON as specified.`
    : `The business "${businessName}" (industry: ${industry}) does NOT have a website. Score this as a major opportunity. A business without a website in ${new Date().getFullYear()} is missing significant revenue potential. Return the JSON as specified with high opportunity scores.`;

  try {
    const response = await fetch(`${KIMI_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: getHeaders(apiKey),
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Kimi API error: ${response.status} - ${error}`);
    }

    const data = (await response.json()) as KimiResponse;
    const content = data.choices[0]?.message?.content || "{}";

    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/) || content.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[1] || jsonMatch[0] : content;

    const result = JSON.parse(jsonStr);

    return {
      overallScore: Math.round(result.overallScore || 50),
      websiteScore: Math.round(result.websiteScore || 0),
      seoScore: Math.round(result.seoScore || 0),
      performanceScore: Math.round(result.performanceScore || 0),
      designScore: Math.round(result.designScore || 0),
      brandScore: Math.round(result.brandScore || 0),
      marketingScore: Math.round(result.marketingScore || 0),
      conversionScore: Math.round(result.conversionScore || 0),
      localPresenceScore: Math.round(result.localPresenceScore || 0),
      growthPotential: Math.round(result.growthPotential || 0),
      salesProbability: Math.round(result.salesProbability || 0),
      priority: result.priority || "medium",
      analysis: result.analysis || {},
      recommendations: result.recommendations || "",
    };
  } catch (err) {
    console.error("Kimi analysis failed:", err);
    return null;
  }
}

/**
 * Generate personalised outreach content (cold email, LinkedIn, phone script).
 */
export async function generateOutreach(
  apiKey: string,
  type: "cold_email" | "linkedin" | "facebook" | "phone_script" | "followup1" | "followup2" | "proposal",
  businessName: string,
  ownerName: string,
  industry: string,
  hasWebsite: boolean,
  websiteUrl: string | null,
  rating: number,
  reviewCount: number,
  city: string,
  model = "kimi-latest"
): Promise<string | null> {
  const prompts: Record<string, string> = {
    cold_email: `Write a personalised cold email from a web designer to ${ownerName} at ${businessName} (${industry} business in ${city}). ${hasWebsite ? `They have a website at ${websiteUrl} but it needs improvement.` : "They don't have a website yet — this is a great opportunity."} Their Google rating is ${rating}/5 with ${reviewCount} reviews. Keep it friendly, concise (under 200 words), and include a clear call to action for a 10-minute call. Mention specific details about their business.`,

    linkedin: `Write a short, professional LinkedIn message to ${ownerName} at ${businessName} (${industry} in ${city}). ${hasWebsite ? "I'd love to help improve their website." : "I'd love to help them get a website."} Keep it under 100 words. Friendly but professional.`,

    facebook: `Write a casual, friendly Facebook message to ${ownerName} at ${businessName} (${industry} in ${city}). ${hasWebsite ? "Offer to improve their website." : "Offer to build them a website."} Include an emoji. Keep it under 80 words.`,

    phone_script: `Write a complete phone script for calling ${ownerName} at ${businessName} (${industry} in ${city}). Include: 1) Introduction, 2) Pitch about ${hasWebsite ? "improving their website" : "building them a website"}, 3) Objection handling for common responses (no time, no budget, already have someone), 4) Close with scheduling a meeting. Keep the tone professional but warm.`,

    followup1: `Write a first follow-up email to ${ownerName} at ${businessName}. Reference my previous message about ${hasWebsite ? "improving their website" : "building them a website"}. Keep it polite, mention that I understand they're busy, and ask for just 10 minutes. Under 100 words.`,

    followup2: `Write a final follow-up email to ${ownerName} at ${businessName}. ${hasWebsite ? "Mention I've helped similar ${industry} businesses increase enquiries by 40-70%." : "Mention I've helped similar ${industry} businesses get their first website and see real results."} Keep it warm and non-pushy. Under 100 words.`,

    proposal: `Write a professional website proposal for ${businessName} (${industry} in ${city}, owned by ${ownerName}). Include: Executive Summary, Recommended Solution (responsive design, SEO, contact forms, social integration), Investment breakdown (£1,500-£3,000 range), Timeline (4 weeks), and Next Steps. Keep it professional and compelling.`,
  };

  const typePrompt = prompts[type];
  if (!typePrompt) return null;

  try {
    const response = await fetch(`${KIMI_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: getHeaders(apiKey),
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: "You are a professional sales copywriter for a web design agency. Write compelling, personalised outreach. Be friendly, professional, and focus on value." },
          { role: "user", content: typePrompt },
        ],
        temperature: 0.7,
      }),
    });

    if (!response.ok) return null;

    const data = (await response.json()) as KimiResponse;
    return data.choices[0]?.message?.content || null;
  } catch {
    return null;
  }
}

/**
 * Test the Kimi API connection.
 */
export async function testConnection(apiKey: string, endpoint?: string): Promise<{ ok: boolean; model?: string; error?: string }> {
  try {
    const baseUrl = endpoint || KIMI_BASE_URL;
    const response = await fetch(`${baseUrl}/models`, {
      method: "GET",
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!response.ok) {
      const error = await response.text();
      return { ok: false, error: `HTTP ${response.status}: ${error}` };
    }

    const data = await response.json() as { data?: Array<{ id: string }> };
    const model = data.data?.[0]?.id;
    return { ok: true, model: model || "connected" };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}
