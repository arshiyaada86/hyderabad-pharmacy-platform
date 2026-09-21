export type Medicine = {
  sourceUrl?: string;
  sourceCheckedAt?: string;
  manufacturerGroup?: "Dr. Reddy's" | "Abbott" | "Cipla";
  id: string;
  brandName: string;
  genericName: string;
  manufacturer: string;
  composition: string;
  strength: string;
  dosageForm: string;
  packageSize: string;
  image: string;
  category: string;
  price: number;
  prescriptionRequired: boolean;
  active: boolean;
};
export type Clinic = {
  id: string;
  name: string;
  address: string;
  locality: string;
  mapsUrl: string;
  directionsUrl: string;
  sourceUrl: string;
  timings: string;
};
export type Doctor = {
  clinics: Clinic[];
  id: string;
  name: string;
  qualifications: string;
  specialty: string;
  clinic: string;
  address: string;
  locality: string;
  timings: string;
  contact?: string;
  photo: string;
  sourceUrl: string;
  sourceCheckedAt: string;
};
export type Profile = {
  id: string;
  name: string;
  phone: string;
  address: string;
  locality: string;
  landmark: string;
  demo: true;
};
export type ProfileInput = Pick<
  Profile,
  "name" | "address" | "locality" | "landmark"
>;
export type Media = {
  id: string;
  uri: string;
  mimeType: "image/jpeg";
  size: number;
};
export type CartLine = { medicineId: string; quantity: number };
export type OrderStatus =
  | "Order Received"
  | "Confirmed"
  | "Preparing"
  | "Out for Delivery"
  | "Delivered"
  | "Cancelled";
export type Order = {
  sample?: boolean;
  id: string;
  customerId: string;
  date: string;
  items: { medicine: Medicine; quantity: number }[];
  total: number;
  delivery: ProfileInput;
  status: OrderStatus;
  eta?: string;
  prescription?: Media;
  prescriptionSubmitted: boolean;
  timeline: { status: OrderStatus; date: string }[];
};
export type ReorderReview = {
  orderId: string;
  available: { medicineId: string; name: string; quantity: number; previousPrice: number; currentPrice: number }[];
  unavailable: string[];
};
export type MedicineRequest = {
  id: string;
  customerId: string;
  photo: Media;
  date: string;
  status: "Received";
  demo?: boolean;
};
export interface MedicineService {
  list(query?: string, category?: string): Promise<Medicine[]>;
  get(id: string): Promise<Medicine>;
}
export interface DoctorService {
  list(
    query?: string,
    specialty?: string,
    locality?: string,
  ): Promise<Doctor[]>;
  get(id: string): Promise<Doctor>;
}
export interface AuthService {
  current(): Promise<Profile | null>;
  sendOtp(phone: string): Promise<void>;
  verifyOtp(phone: string, code: string): Promise<Profile | null>;
  register(input: ProfileInput): Promise<Profile>;
  update(input: ProfileInput): Promise<Profile>;
  logout(): Promise<void>;
}
export interface CartService {
  list(): Promise<CartLine[]>;
  setQuantity(id: string, quantity: number): Promise<void>;
  add(id: string, quantity: number): Promise<void>;
}
export interface OrderService {
  list(): Promise<Order[]>;
  get(id: string): Promise<Order>;
  place(prescription?: Media): Promise<Order>;
  again(id: string): Promise<ReorderReview>;
}
export interface RequestService {
  list(): Promise<MedicineRequest[]>;
  submit(photo: Media): Promise<MedicineRequest>;
}
export interface MediaService {
  pick(source: "camera" | "gallery" | "file"): Promise<Media | null>;
  validate(media: Media): Promise<void>;
  remove(media: Media): Promise<void>;
}
export type Services = {
  medicine: MedicineService;
  doctor: DoctorService;
  auth: AuthService;
  cart: CartService;
  order: OrderService;
  request: RequestService;
  media: MediaService;
  reference: {
    categories: readonly string[];
    specialties: readonly string[];
    localities: readonly string[];
    doctorLocalities: readonly string[];
    demoPhone: string;
    demoOtp: string;
  };
};
export interface KeyValueStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}
