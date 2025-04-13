// Basic authentication utility for frontend
// This is a placeholder for real authentication logic that will be implemented in the backend

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
}

export const login = (email: string, password: string): Promise<User> => {
  // This would normally make an API call
  return new Promise((resolve) => {
    // Simulate network delay
    setTimeout(() => {
      // Store in localStorage for persistence
      const user = { id: "1", name: "Test User", email };
      localStorage.setItem("user", JSON.stringify(user));
      resolve(user);
    }, 500);
  });
};

export const signup = (
  name: string,
  email: string,
  password: string
): Promise<User> => {
  // This would normally make an API call
  return new Promise((resolve) => {
    // Simulate network delay
    setTimeout(() => {
      // Store in localStorage for persistence
      const user = { id: "1", name, email };
      localStorage.setItem("user", JSON.stringify(user));
      resolve(user);
    }, 500);
  });
};

export const logout = (): Promise<void> => {
  return new Promise((resolve) => {
    localStorage.removeItem("user");
    resolve();
  });
};

export const getCurrentUser = (): User | null => {
  if (typeof window === "undefined") return null;

  const user = localStorage.getItem("user");
  return user ? JSON.parse(user) : null;
};

export const isAuthenticated = (): boolean => {
  return getCurrentUser() !== null;
};
