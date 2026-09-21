import { Doctor } from "../services/types";

// Public hospital profiles checked 20 September 2026. Schedules must be confirmed with the hospital.
const profiles = [
  ["santosh-reddy", "Dr. C.H. Santosh Reddy", "MD (General Medicine)", "General Physician", "Malakpet", "Mon–Sat · 12:00 PM–3:00 PM", "malakpet/general-medicine/dr-c-h-santosh-reddy"],
  ["santosh-kumar", "Dr. C. Santosh Kumar", "MD, DM", "Cardiologist", "Malakpet", "Mon–Sat · 11:00 AM–3:00 PM; unavailable on Wednesdays", "malakpet/cardiology/dr-c-santosh-kumar"],
  ["prasanth-babu", "Dr. B. Prasanth Babu", "MBBS, DCH, DNB (Paediatrics), Fellowship in Neonatology", "Pediatrician", "Malakpet", "Mon–Sat · 9:00 AM–4:00 PM", "malakpet/pediatrics/dr-b-prasanth-babu"],
  ["jyothsna", "Dr. M. V. Jyothsna", "MBBS, MS (Obstetrics & Gynaecology)", "Gynecologist", "Malakpet", "Mon–Sat · 10:30 AM–1:30 PM", "malakpet/gynaecology/dr-m-v-jyothsna"],
  ["arun-mukka", "Dr. Arun Mukka", "MD, DM (Endocrinology)", "Endocrinologist", "Somajiguda", "Mon–Sat · 11:00 AM–4:00 PM", "dr-arun-mukka"],
  ["padmaja", "Dr. Padmaja", "MD (Dermatology)", "Dermatologist", "Somajiguda", "Mon–Sat · 5:00 PM–7:00 PM", "somajiguda/dermatology/dr-padmaja"],
  ["sindhuja-tekumalla", "Dr. Sindhuja Tekumalla", "MD, DVL (PGIMER), MRCP-SCE (UK)", "Dermatologist", "Hitec City", "Mon–Sat · 10:00 AM–5:00 PM", "hitec-city/dermatology/dr-sindhuja-tekumalla"],
  ["nagendra-mahendra", "Dr. Nagendra Mahendra", "MBBS, DLO, DNB (ENT)", "ENT", "Malakpet", "Mon–Sat · 9:00 AM–5:00 PM", "malakpet/ent/dr-nagendra-mahendra"],
  ["sunil-dachepalli", "Dr. Sunil Dachepalli", "MS (Ortho), MCh (Ortho), MSc (UK), MRCS (Edin), FRCS", "Orthopedic", "Somajiguda", "Mon–Sat · 10:30 AM–5:00 PM and 5:00 PM–7:00 PM", "somajiguda/arthroscopy-sports-medicine/dr-sunil-dachepalli"],
] as const;

const addresses: Record<string, string> = {
  Malakpet: "16-10-29, Nalgonda X Roads, near New Market Metro station, Jamal Colony, Malakpet, Telangana 500036",
  Somajiguda: "6-3-905, Raj Bhavan Road, Matha Nagar, Somajiguda, Telangana 500082",
  "Hitec City": "Survey No. 41/14, JNTU to Hitech City Main Road, Khanamet Village, Serilingampally, Kothaguda, Telangana 500081",
};

export const hyderabadDoctors: Doctor[] = profiles.map(([id, name, qualifications, specialty, locality, timings, path]) => ({
  id: `yashoda-${id}`, name, qualifications, specialty, locality, timings,
  clinic: `Yashoda Hospitals, ${locality}`,
  address: addresses[locality],
  clinics: [{
    id: locality.toLowerCase().replace(/ /g, "-"),
    name: `Yashoda Hospitals, ${locality}`, address: addresses[locality], locality, timings,
    mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`Yashoda Hospitals ${locality}, ${addresses[locality]}, Hyderabad`)}`,
    directionsUrl: `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`Yashoda Hospitals ${locality}, ${addresses[locality]}, Hyderabad`)}`,
    sourceUrl: `https://www.yashodahospitals.com/locations/${locality.toLowerCase().replace(/ /g, "-")}/`,
  }],
  photo: "", // Initials instead of an unrelated or synthetic portrait.
  sourceUrl: `https://www.yashodahospitals.com/doctor/${path}/`,
  sourceCheckedAt: "2026-09-20",
}));
