export interface TeamMember {
  name: string;
  role: string;
  affiliation?: string;
  bio?: string;
}

export const TEAM_MEMBERS: TeamMember[] = [
  {
    name: "Project Lead & System Architect",
    role: "Lead Researcher",
    affiliation: "PoshanScan Research Initiative",
    bio: "Computer vision and field epidemiology integration.",
  },
  {
    name: "Clinical Nutrition Advisor",
    role: "Public Health Consultant",
    affiliation: "Child Nutrition & Triage Protocols",
    bio: "Guidance on WHO MUAC screening guidelines and referral workflows.",
  },
  {
    name: "Frontend & Field UX Specialist",
    role: "Lead Software Engineer",
    affiliation: "Community Health Systems",
    bio: "Supervisor portal architecture, accessibility, and offline frontline workflows.",
  },
  {
    name: "Machine Learning Engineer",
    role: "Computer Vision Researcher",
    affiliation: "Model Calibration & Marker Detection",
    bio: "ArUco detection, arm segmentation, and geometric circumference estimation.",
  },
];
