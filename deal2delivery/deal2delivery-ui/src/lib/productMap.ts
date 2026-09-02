// Frontend product remapping — translates old SAP catalog names to NovaTech Electronics
// without touching Databricks tables or re-running the pipeline.

export const NAME_MAP: Record<string, string> = {
  "Cloud Storage - 1TB":                 'Business Laptop Pro 15"',
  "Cloud Compute - VM Instance":         'Ultrabook Slim 13"',
  "Database Service - Standard":         "Workstation Desktop i9",
  "Database Service - Premium":          'All-in-One Desktop 27"',
  "API Management Platform":            "Smartphone Pro Max 256GB",
  "Security Suite - Enterprise":         'Business Tablet 11"',
  "Analytics Platform":                  "Wireless Earbuds Pro",
  "ML Model Training Credits":           "Smartwatch Series 5",
  "Professional Services - Consulting":  "USB-C Hub 10-Port",
  "Support Contract - Premium":          "Mechanical Keyboard Wireless",
  "Data Integration Tool":               "4K USB Webcam Pro",
  "Backup & Recovery Service":           "Laptop Stand & Dock",
};

export const MATNR_NAME_MAP: Record<string, string> = {
  P100001: 'Business Laptop Pro 15"',
  P100002: 'Ultrabook Slim 13"',
  P100003: "Workstation Desktop i9",
  P100004: 'All-in-One Desktop 27"',
  P100005: "Smartphone Pro Max 256GB",
  P100006: 'Business Tablet 11"',
  P100007: "Wireless Earbuds Pro",
  P100008: "Smartwatch Series 5",
  P100009: "USB-C Hub 10-Port",
  P100010: "Mechanical Keyboard Wireless",
  P100011: "4K USB Webcam Pro",
  P100012: "Laptop Stand & Dock",
};

// Old SAP category codes → display labels
export const CATEGORY_DISPLAY: Record<string, string> = {
  CLOUD: "COMP",
  SOFTW: "MOBI",
  SERV:  "ACCS",
  COMP:  "COMP",
  MOBI:  "MOBI",
  ACCS:  "ACCS",
};

// When calling the simulate API, translate display category back to the DB value
export const CATEGORY_TO_DB: Record<string, string> = {
  COMP: "CLOUD",
  MOBI: "SOFTW",
  ACCS: "SERV",
  All:  "",
};

export function pName(raw: string, matnr?: string): string {
  if (matnr && MATNR_NAME_MAP[matnr]) return MATNR_NAME_MAP[matnr];
  return NAME_MAP[raw] ?? raw;
}

export function pCat(raw: string): string {
  return CATEGORY_DISPLAY[raw] ?? raw;
}
