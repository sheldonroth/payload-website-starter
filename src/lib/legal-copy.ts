/**
 * Legal Protection Copy Constants
 *
 * This file contains all legally-protective language used throughout the CMS.
 * These phrases are designed to implement the "Weather Report" doctrine:
 * - Transform subjective opinions into objective instrument readings
 * - Shift user focus from our conclusions to brand ingredient lists
 * - Provide clear methodological limitations and disclaimers
 *
 * IMPORTANT: Do not modify these without legal review.
 * Last Legal Review: January 2026
 */

// ============================================================================
// Shield Layer 1: Screening Watermark
// ============================================================================

export const SCREENING_WATERMARK = {
  /** Primary watermark text - appears on all reports and graphs */
  PRIMARY: 'Preliminary Mass Spec Screening / Non-Regulatory',
  /** Short version for space-constrained UI */
  SHORT: 'Screening Data / Non-Regulatory',
  /** Accessibility label */
  A11Y_LABEL: 'This is preliminary screening data, not regulatory testing',
} as const;

// ============================================================================
// Shield Layer 2: Batch Disclaimer (N=1 Defense)
// ============================================================================

export const BATCH_DISCLAIMER = {
  /** Template with sample ID placeholder */
  TEMPLATE: 'Results valid for Sample #{sampleId} only. Formulas may vary by batch.',
  /** Generic version when sample ID unavailable */
  GENERIC: 'Results valid for tested sample only. Formulas may vary by batch.',
  /** Extended explanation */
  EXTENDED:
    'This report reflects testing of a single product sample. Manufacturing variations between batches may result in different findings. We recommend periodic retesting.',
} as const;

// ============================================================================
// Shield Layer 3: Right of Reply
// ============================================================================

export const MANUFACTURER_REPLY = {
  /** CTA button text */
  BUTTON_TEXT: 'Are you the manufacturer? Dispute this data.',
  /** Alternative shorter text */
  BUTTON_TEXT_SHORT: 'Manufacturer? Dispute this data',
  /** URL path for dispute form */
  FORM_PATH: '/manufacturer-dispute',
  /** Confirmation message */
  CONFIRMATION:
    'We review all manufacturer disputes within 14 business days and will contact you with our findings.',
} as const;

// ============================================================================
// Detection Language Templates ("Weather Report" Style)
// ============================================================================

export const DETECTION_TEMPLATES = {
  /** VOC detection - use with compound name and match probability */
  VOC_DETECTED:
    'Screening detected volatility peaks consistent with {compound} (Match Probability: {probability}%).',
  /** Heavy metal detection - use with metal name, measured value, and threshold */
  HEAVY_METAL:
    'Analysis indicated {metal} levels at {measured} ppm. Reference threshold: {threshold} ppm.',
  /** Generic contaminant - use with contaminant name and NIST match */
  CONTAMINANT:
    'Mass spec identified peaks consistent with {contaminant} (NIST Match: {match}%).',
  /** Label variance - use with declared, measured, and variance values */
  LABEL_VARIANCE: 'Declared: {declared}. Measured: {measured}. Variance: {variance}%.',
  /** Multiple detections summary */
  MULTIPLE_DETECTIONS: 'Screening flagged {count} finding(s). See detailed results below.',
  /** No detections found */
  CLEAN_RESULT:
    'Screening detected no undisclosed volatile compounds above reporting threshold.',
} as const;

// ============================================================================
// Approved Verdict Language
// ============================================================================

export const VERDICT_LANGUAGE = {
  /** Positive result indicators */
  POSITIVE: {
    HEADLINE: 'Screening Passed',
    SUBHEADLINE: 'No concerning findings detected',
    DETAIL:
      'Our screening detected no undisclosed volatile compounds or significant label variances.',
  },
  /** Caution/Notable result indicators */
  CAUTION: {
    HEADLINE: 'Notable Findings',
    SUBHEADLINE: 'Review screening results',
    DETAIL:
      'Our screening detected findings that warrant review. See detailed results below.',
  },
  /** Flagged result indicators - used for AVOID products */
  FLAGGED: {
    HEADLINE: 'Screening Flagged',
    SUBHEADLINE: 'Significant findings detected',
    DETAIL:
      'Our screening detected significant findings. Review the detailed data and consider alternatives.',
  },
} as const;

// ============================================================================
// Methodology Disclaimers
// ============================================================================

export const METHODOLOGY = {
  /** What this IS */
  WHAT_IT_IS:
    'A sensitive screening tool that identifies volatile chemicals "off-gassing" from the product using Headspace Gas Chromatography-Mass Spectrometry (GC/MS).',
  /** What this is NOT */
  WHAT_IT_IS_NOT:
    'This is NOT a regulatory compliance test. We do not quantify non-volatile ingredients or certify products as "safe" or "unsafe."',
  /** NIST disclaimer */
  NIST_DISCLAIMER:
    'We rely on NIST Library Matching to identify compounds. While high-probability matches (90%+) are strong indicators, they are not 100% definitive proof of chemical structure without certified reference standards. We publish the raw probability scores so you can decide for yourself.',
  /** General educational disclaimer */
  EDUCATIONAL:
    'For educational and informational purposes only. Not medical advice. Consult qualified professionals for health decisions.',
  /** Short educational disclaimer */
  EDUCATIONAL_SHORT: 'For educational purposes only. Not medical advice.',
} as const;

// ============================================================================
// Affiliate & Recommendation Language
// ============================================================================

export const AFFILIATE = {
  /** FTC-required disclosure */
  DISCLOSURE:
    'Affiliate Disclosure: We may earn a commission from purchases made through links on this page. This funds our independent lab testing.',
  /** Short disclosure */
  DISCLOSURE_SHORT: 'Affiliate link - supports our testing',
  /** Data-driven recommendation intro */
  RECOMMENDATION_INTRO:
    'Looking for alternatives? These products passed our screening with 0 unlisted VOCs:',
  /** Alternative recommendation text */
  CLEAN_ALTERNATIVES:
    'Products in this category that showed no undisclosed volatile compounds in our screening:',
  /** Label accuracy alternatives */
  ACCURATE_LABELS:
    'Products that matched their label claims within 5% variance in our testing:',
} as const;

// ============================================================================
// CMS Field Descriptions (for admin UI)
// ============================================================================

export const CMS_FIELD_DESCRIPTIONS = {
  /** Sample ID field */
  SAMPLE_ID:
    'Unique identifier for this tested sample (e.g., TPR-2026-0001). Required for N=1 defense.',
  /** Detection results field */
  DETECTION_RESULTS:
    'Screening detection data. Use Weather Report language: "Screening detected peaks consistent with X"',
  /** Match probability field */
  MATCH_PROBABILITY:
    'NIST Library match probability (0-100%). High matches (90%+) are strong indicators but not definitive.',
  /** Manufacturer response field */
  MANUFACTURER_RESPONSE:
    'Track manufacturer disputes and our responses for Right of Reply defense.',
  /** Purchase documentation field */
  PURCHASE_DOCUMENTATION:
    'Chain of custody evidence: receipt photo, purchase date, location, lot number.',
} as const;

// ============================================================================
// Fragrance Whitelist (Tortious Interference Shield)
// These are known fragrance allergens from IFRA/EU Cosmetics Regulation
// If detected AND "Fragrance/Parfum" is on label, use softer language
// ============================================================================

export const FRAGRANCE_COMPONENTS = [
  // Terpenes
  'Limonene',
  'Linalool',
  'Pinene',
  'Myrcene',
  'Terpineol',
  // Aldehydes
  'Citral',
  'Citronellal',
  'Hydroxycitronellal',
  // Alcohols
  'Geraniol',
  'Citronellol',
  'Farnesol',
  'Benzyl Alcohol',
  // Esters
  'Benzyl Benzoate',
  'Benzyl Salicylate',
  'Benzyl Cinnamate',
  // Phenols
  'Eugenol',
  'Isoeugenol',
  // Lactones
  'Coumarin',
  // Others
  'Cinnamal',
  'Cinnamyl Alcohol',
  'Amyl Cinnamal',
  'Hexyl Cinnamal',
  'Anise Alcohol',
  'Evernia Prunastri', // Oakmoss
  'Evernia Furfuracea', // Treemoss
] as const;

/**
 * Check if a compound is a known fragrance component
 */
export function isFragranceComponent(compound: string): boolean {
  const lowerCompound = compound.toLowerCase();
  return FRAGRANCE_COMPONENTS.some(fc => lowerCompound.includes(fc.toLowerCase()));
}

/**
 * Classify detection type based on compound and package text
 * @param compound - The detected compound name
 * @param fullPackageText - All text from the product package (ingredients, warnings, allergens)
 */
export function classifyDetection(
  compound: string,
  fullPackageText: string
): 'fragrance_component' | 'hidden_contaminant' | 'standard' {
  const lowerText = fullPackageText.toLowerCase();
  const lowerCompound = compound.toLowerCase();

  // Check if compound is explicitly mentioned anywhere on package
  const compoundMentioned = lowerText.includes(lowerCompound);

  // Check for generic fragrance/parfum disclosure
  const hasFragranceDisclosure =
    lowerText.includes('fragrance') ||
    lowerText.includes('parfum') ||
    lowerText.includes('aroma') ||
    lowerText.includes('may contain') ||
    lowerText.includes('allergen');

  // If it's a known fragrance component AND disclosed (explicitly or via Fragrance)
  if (isFragranceComponent(compound) && (compoundMentioned || hasFragranceDisclosure)) {
    return 'fragrance_component';
  }

  // Known contaminants that are NEVER fragrance components
  const KNOWN_CONTAMINANTS = ['benzene', 'lead', 'mercury', 'cadmium', 'arsenic', 'pfas', 'pfoa', 'pfos', 'formaldehyde', '1,4-dioxane'];
  if (KNOWN_CONTAMINANTS.some(c => lowerCompound.includes(c))) {
    return 'hidden_contaminant';
  }

  // Default: standard detection
  return 'standard';
}

/**
 * Get display mode based on match probability (Low-Confidence Gatekeeper)
 */
export function getDisplayMode(matchProbability: number): 'primary' | 'low_confidence' | 'hidden' {
  if (matchProbability >= 80) return 'primary';
  if (matchProbability >= 50) return 'low_confidence';
  return 'hidden';
}

// ============================================================================
// Prohibited Terms (DO NOT USE - Reference Only)
// ============================================================================

export const PROHIBITED_TERMS = [
  'toxic',
  'dangerous',
  'unsafe',
  'poisonous',
  'deadly',
  'harmful',
  'cancer-causing',
  'avoid',
  "don't buy",
  'stay away',
  'boycott',
  'stop using',
  'liar',
  'lies',
  'fraud',
  'fraudulent',
  'scam',
  'deceptive',
  'knowingly',
  'intentionally',
  'always contains',
  'never safe',
  'worst',
  'terrible',
] as const;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Format a detection template with actual values
 */
export function formatDetection(
  template: string,
  values: Record<string, string | number>
): string {
  let result = template;
  Object.entries(values).forEach(([key, value]) => {
    result = result.replace(`{${key}}`, String(value));
  });
  return result;
}

/**
 * Format batch disclaimer with sample ID
 */
export function formatBatchDisclaimer(sampleId?: string): string {
  if (sampleId) {
    return BATCH_DISCLAIMER.TEMPLATE.replace('{sampleId}', sampleId);
  }
  return BATCH_DISCLAIMER.GENERIC;
}

/**
 * Check if text contains prohibited terms
 */
export function containsProhibitedTerms(text: string): string[] {
  const lowerText = text.toLowerCase();
  return PROHIBITED_TERMS.filter((term) => lowerText.includes(term.toLowerCase()));
}

/**
 * Get verdict language for API responses
 */
export function getVerdictLanguage(verdict: 'recommend' | 'caution' | 'avoid') {
  const map = {
    recommend: VERDICT_LANGUAGE.POSITIVE,
    caution: VERDICT_LANGUAGE.CAUTION,
    avoid: VERDICT_LANGUAGE.FLAGGED,
  };
  return map[verdict];
}
