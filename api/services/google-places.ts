/**
 * Google Places API Service
 * Searches for real businesses by location, industry, and keywords.
 * Requires GOOGLE_PLACES_API_KEY in environment variables.
 */

const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY || "";
const PLACES_BASE_URL = "https://maps.googleapis.com/maps/api/place";

export interface PlaceResult {
  placeId: string;
  name: string;
  address: string;
  phone?: string;
  website?: string;
  rating?: number;
  reviewCount?: number;
  latitude: number;
  longitude: number;
  photos?: string[];
  openingHours?: string;
  types: string[];
}

interface RawPlace {
  place_id: string;
  name: string;
  formatted_address?: string;
  vicinity?: string;
  geometry?: { location: { lat: number; lng: number } };
  rating?: number;
  user_ratings_total?: number;
  photos?: Array<{ photo_reference: string }>;
  types?: string[];
  opening_hours?: { weekday_text?: string[] };
  formatted_phone_number?: string;
  website?: string;
  business_status?: string;
}

/**
 * Search for businesses using Google Places Text Search API.
 * This finds REAL businesses in the specified area.
 * Uses the provided API key or falls back to env var.
 */
export async function searchBusinessesWithKey(
  apiKey: string,
  query: string,
  location?: string,
  maxResults = 20
): Promise<PlaceResult[]> {
  if (!apiKey) {
    throw new Error("GOOGLE_PLACES_API_KEY not configured. Add it in Settings > API Keys.");
  }

  // Build the search query
  const searchQuery = location ? `${query} in ${location}` : query;

  // Step 1: Text Search to find places
  const textSearchUrl = new URL(`${PLACES_BASE_URL}/textsearch/json`);
  textSearchUrl.searchParams.set("query", searchQuery);
  textSearchUrl.searchParams.set("key", apiKey);

  const textResponse = await fetch(textSearchUrl.toString());
  if (!textResponse.ok) {
    throw new Error(`Google Places API error: ${textResponse.status}`);
  }

  const textData = await textResponse.json() as { results: RawPlace[]; status: string; error_message?: string };

  if (textData.status !== "OK" && textData.status !== "ZERO_RESULTS") {
    throw new Error(`Google Places API: ${textData.status} - ${textData.error_message || ""}`);
  }

  if (!textData.results || textData.results.length === 0) {
    return [];
  }

  // Step 2: Get details for each place (limited to maxResults)
  const limited = textData.results.slice(0, maxResults);
  const detailed: PlaceResult[] = [];

  for (const place of limited) {
    try {
      const detail = await getPlaceDetailsWithKey(apiKey, place.place_id);
      if (detail) detailed.push(detail);
    } catch {
      // Fallback to basic info if details fail
      detailed.push(placeToResultWithKey(apiKey, place));
    }
  }

  return detailed;
}

/**
 * Legacy wrapper that uses env var.
 */
export async function searchBusinesses(
  query: string,
  location?: string,
  maxResults = 20
): Promise<PlaceResult[]> {
  return searchBusinessesWithKey(GOOGLE_PLACES_API_KEY, query, location, maxResults);
}

/**
 * Get detailed information about a specific place using a provided API key.
 */
export async function getPlaceDetailsWithKey(apiKey: string, placeId: string): Promise<PlaceResult | null> {
  if (!apiKey) return null;

  const detailUrl = new URL(`${PLACES_BASE_URL}/details/json`);
  detailUrl.searchParams.set("place_id", placeId);
  detailUrl.searchParams.set("fields", "place_id,name,formatted_address,formatted_phone_number,website,rating,user_ratings_total,geometry,photos,types,opening_hours,vicinity,business_status");
  detailUrl.searchParams.set("key", apiKey);

  const response = await fetch(detailUrl.toString());
  if (!response.ok) return null;

  const data = await response.json() as { result?: RawPlace; status: string };
  if (data.status !== "OK" || !data.result) return null;

  return placeToResult(data.result, apiKey);
}

/**
 * Legacy wrapper using env var.
 */
export async function getPlaceDetails(placeId: string): Promise<PlaceResult | null> {
  return getPlaceDetailsWithKey(GOOGLE_PLACES_API_KEY, placeId);
}

/**
 * Search for businesses near a specific geographic point.
 */
export async function searchNearby(
  lat: number,
  lng: number,
  keyword: string,
  radius = 20000 // 20km default
): Promise<PlaceResult[]> {
  if (!GOOGLE_PLACES_API_KEY) {
    throw new Error("GOOGLE_PLACES_API_KEY not configured.");
  }

  const url = new URL(`${PLACES_BASE_URL}/nearbysearch/json`);
  url.searchParams.set("location", `${lat},${lng}`);
  url.searchParams.set("radius", String(radius));
  url.searchParams.set("keyword", keyword);
  url.searchParams.set("key", GOOGLE_PLACES_API_KEY);

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Google Places API error: ${response.status}`);
  }

  const data = await response.json() as { results: RawPlace[]; status: string; error_message?: string };

  if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
    throw new Error(`Google Places API: ${data.status}`);
  }

  if (!data.results) return [];

  const results: PlaceResult[] = [];
  for (const place of data.results.slice(0, 20)) {
    try {
      const detail = await getPlaceDetails(place.place_id);
      if (detail) results.push(detail);
    } catch {
      results.push(placeToResult(place));
    }
  }

  return results;
}

/**
 * Convert raw Google Place data to our PlaceResult format.
 */
function placeToResult(place: RawPlace, apiKey?: string): PlaceResult {
  const key = apiKey || GOOGLE_PLACES_API_KEY;
  const photoUrls = key && (place.photos || []).length > 0
    ? (place.photos || [])
        .slice(0, 3)
        .map((p) =>
          `${PLACES_BASE_URL}/photo?maxwidth=400&photo_reference=${p.photo_reference}&key=${key}`
        )
    : [];

  return {
    placeId: place.place_id,
    name: place.name,
    address: place.formatted_address || place.vicinity || "",
    phone: place.formatted_phone_number,
    website: place.website,
    rating: place.rating,
    reviewCount: place.user_ratings_total,
    latitude: place.geometry?.location?.lat || 0,
    longitude: place.geometry?.location?.lng || 0,
    photos: photoUrls,
    openingHours: place.opening_hours?.weekday_text?.join(", "),
    types: place.types || [],
  };
}

/**
 * Guess industry from Google Place types.
 */
export function guessIndustry(types: string[]): string {
  const typeMap: Record<string, string> = {
    dentist: "Dental",
    doctor: "Medical",
    hospital: "Medical",
    pharmacy: "Medical",
    physiotherapist: "Medical",
    hair_care: "Hairdressing",
    beauty_salon: "Beauty",
    spa: "Beauty",
    electrician: "Electrical",
    plumber: "Plumbing",
    roofing_contractor: "Construction",
    general_contractor: "Construction",
    painter: "Construction",
    locksmith: "Trade Services",
    lawyer: "Legal",
    accounting: "Accounting",
    bank: "Financial",
    real_estate_agency: "Real Estate",
    restaurant: "Restaurant",
    cafe: "Bakery & Cafe",
    bakery: "Bakery & Cafe",
    bar: "Hospitality",
    gym: "Fitness",
    school: "Education",
    store: "Retail",
    supermarket: "Retail",
    car_repair: "Automotive",
    laundry: "Services",
    florist: "Retail",
    funeral_home: "Services",
    insurance_agency: "Insurance",
    travel_agency: "Travel",
    veterinary_care: "Veterinary",
  };

  for (const type of types) {
    const clean = type.replace("establishment", "").replace("point_of_interest", "").trim();
    if (typeMap[clean]) return typeMap[clean];
  }

  // Fallback: try matching any type
  for (const type of types) {
    for (const [key, value] of Object.entries(typeMap)) {
      if (type.includes(key)) return value;
    }
  }

  return "Business";
}
