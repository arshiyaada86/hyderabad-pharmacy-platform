import { indianMedicines } from "./indianMedicines";
import { hyderabadDoctors } from "./hyderabadDoctors";
import { Profile } from "../services/types";
import { shopCategories } from "./shopCategories";

export const localities = [
  "Barkas",
  "Chandrayangutta",
  "Falaknuma",
  "Charminar",
  "Mehdipatnam",
  "Tolichowki",
  "Attapur",
  "Malakpet",
  "Santosh Nagar",
  "Saidabad",
  "Banjara Hills",
  "Jubilee Hills",
  "Gachibowli",
  "Madhapur",
] as const;

export const medicines = indianMedicines;
export const doctors = hyderabadDoctors;
export const categories = shopCategories.map(category => category.name);
export const specialties = [...new Set(doctors.map(d => d.specialty))];
export const doctorLocalities = [...new Set(doctors.flatMap(d => d.clinics.map(clinic => clinic.locality)))];
export const customers: Profile[] = [
  {
    id: "customer-1",
    name: "Amina Demo",
    phone: "9000000001",
    address: "12, Demo Lane",
    locality: "Barkas",
    landmark: "Near demo community centre",
    demo: true,
  },
  {
    id: "customer-2",
    name: "Rahul Demo",
    phone: "9000000002",
    address: "24, Sample Road",
    locality: "Mehdipatnam",
    landmark: "Opposite demo park",
    demo: true,
  },
  {
    id: "customer-3",
    name: "Sara Demo",
    phone: "9000000003",
    address: "36, Example Street",
    locality: "Malakpet",
    landmark: "Near demo library",
    demo: true,
  },
];
