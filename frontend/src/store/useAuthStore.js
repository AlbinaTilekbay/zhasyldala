import { create } from "zustand";
import { persist } from "zustand/middleware";

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

export const useAuthStore = create(
  persist(
    (set, get) => ({
      accessToken: null,
      refreshToken: null,
      user: null,

      setAuth: ({ access, refresh, user }) =>
        set({ accessToken: access ?? get().accessToken, refreshToken: refresh ?? get().refreshToken, user: user ?? get().user }),

      setUser: (user) => set({ user }),

      logout: () => set({ accessToken: null, refreshToken: null, user: null }),

      isAuthenticated: () => Boolean(get().accessToken),
      isStaff: () => Boolean(get().user?.is_staff),

      async tryRefresh() {
        const refresh = get().refreshToken;
        if (!refresh) return false;
        try {
          const res = await fetch(`${BASE_URL}/api/auth/token/refresh/`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refresh }),
          });
          if (!res.ok) throw new Error("refresh failed");
          const data = await res.json();
          set({ accessToken: data.access });
          return true;
        } catch {
          set({ accessToken: null, refreshToken: null, user: null });
          return false;
        }
      },
    }),
    { name: "zhasyldala-auth" }
  )
);
