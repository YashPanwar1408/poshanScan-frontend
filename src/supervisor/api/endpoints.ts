/** All supervisor API endpoint paths — single source of truth. */
export const ENDPOINTS = {
  login: "/supervisor/login",

  overview: "/supervisor/dashboard/overview",
  trends: "/supervisor/dashboard/trends",
  locations: "/supervisor/dashboard/locations",
  workers: "/supervisor/dashboard/workers",
  flagged: "/supervisor/dashboard/flagged",
  flaggedReview: (id: string) => `/supervisor/dashboard/flagged/${id}/review`,
  export: "/supervisor/dashboard/export",
} as const;
