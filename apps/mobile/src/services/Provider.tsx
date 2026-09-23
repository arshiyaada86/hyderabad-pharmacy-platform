import React, { createContext, useContext, useEffect, useState, useRef } from "react";
import { AppConfiguration, CartLine, Profile, ReorderReview, Services } from "./types";
import { SuccessProvider } from "../components/Success";

type Context = {
  configuration?: AppConfiguration;
  services: Services;
  user: Profile | null;
  loading: boolean;
  error: string;
  revision: number;
  cartCount: number;
  cartLines: CartLine[];
  cartReview?: ReorderReview;
  setCartReview: (review?: ReorderReview) => void;
  refresh: () => Promise<void>;
};
const ServiceContext = createContext<Context | null>(null);
export function AppProvider({
  services,
  children,
}: React.PropsWithChildren<{ services: Services }>) {
  const [configuration, setConfiguration] = useState<AppConfiguration>();
  const refreshing = useRef(false);
  const [user, setUser] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [cartLines, setCartLines] = useState<CartLine[]>([]);
  const [cartCount, setCartCount] = useState(0);
  const [cartReview, setCartReview] = useState<ReorderReview>();
  const refresh = async () => {
    if (services.configuration) setConfiguration(await services.configuration());
    const currentUser = await services.auth.current();
    const cart = currentUser ? await services.cart.list() : [];
    setError("");
    setUser(currentUser);
    if (currentUser?.id !== user?.id) setCartReview(undefined);
    setCartLines(cart);
    setCartCount(cart.reduce((total, line) => total + line.quantity, 0));
    setRevision((n) => n + 1);
  };
  useEffect(() => {
    refresh()
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [services]);
  useEffect(() => {
    if (!services.configuration) return;
    const timer = setInterval(() => {
      if (!refreshing.current) { refreshing.current = true; void refresh().catch(() => undefined).finally(() => { refreshing.current = false; }); }
    }, 30000);
    return () => clearInterval(timer);
  }, [services, user?.id]);
  return (
    <ServiceContext.Provider
      value={{ configuration, services, user, loading, error, revision, cartCount, cartLines, cartReview, setCartReview, refresh }}
    >
      <SuccessProvider>{children}</SuccessProvider>
    </ServiceContext.Provider>
  );
}
export function useApp() {
  const value = useContext(ServiceContext);
  if (!value) throw new Error("AppProvider is missing.");
  return value;
}
