"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";

type User = {
  id: string;
  name: string;
  email: string;
  avatar?: string;
};

type AuthContextType = {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (
    firstName: string,
    lastName: string,
    email: string,
    password: string
  ) => Promise<void>;
  logout: () => Promise<void>;
  loading: boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Create a key for localStorage
const USER_STORAGE_KEY = "innovation_workflow_user";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Function to retrieve user from localStorage
  const getUserFromStorage = () => {
    try {
      if (typeof window !== "undefined") {
        const storedUser = localStorage.getItem(USER_STORAGE_KEY);
        if (storedUser) {
          return JSON.parse(storedUser);
        }
      }
    } catch (error) {
      console.error("Error retrieving user from storage:", error);
    }
    return null;
  };

  // Function to save user to localStorage
  const saveUserToStorage = (userData: User) => {
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(userData));
      }
    } catch (error) {
      console.error("Error saving user to storage:", error);
    }
  };

  // Function to clear user from localStorage
  const clearUserFromStorage = () => {
    try {
      if (typeof window !== "undefined") {
        localStorage.removeItem(USER_STORAGE_KEY);
      }
    } catch (error) {
      console.error("Error clearing user from storage:", error);
    }
  };

  useEffect(() => {
    // Check if user is logged in on initial load
    const checkUserLoggedIn = async () => {
      try {
        // Always try to get user from localStorage first
        const storedUser = getUserFromStorage();
        if (storedUser) {
          console.log("Found user in localStorage:", storedUser);
          setUser(storedUser);
        }

        // Always validate with server regardless of localStorage
        const response = await fetch("/api/auth/me");

        if (response.ok) {
          const userData = await response.json();
          if (userData && Object.keys(userData).length > 0) {
            console.log("Got valid user data from server:", userData);
            setUser(userData);
            saveUserToStorage(userData);
          } else if (storedUser) {
            // If server returns empty but we have stored user, keep using stored user
            console.log("Server returned empty user data, keeping stored user");
          } else {
            // No stored user and server returned empty
            console.log("No user data available");
            setUser(null);
            clearUserFromStorage();
          }
        } else {
          // Server returned error
          console.warn("Server session validation failed:", response.status);
          if (storedUser) {
            // Keep the stored user temporarily to prevent immediate logout
            // The user experience is better if we show them as logged in
            // and then handle auth failures when they try to perform actions
            console.log(
              "Keeping stored user despite server validation failure"
            );
          } else {
            setUser(null);
            clearUserFromStorage();
          }
        }
      } catch (error) {
        console.error("Authentication check failed:", error);
        // On error, keep existing user if available
        const storedUser = getUserFromStorage();
        if (storedUser && !user) {
          console.log("Using stored user after server error");
          setUser(storedUser);
        }
      } finally {
        setLoading(false);
      }
    };

    checkUserLoggedIn();
  }, []);

  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      // Create FormData for login
      const formData = new FormData();
      formData.append("username", email); // Backend expects "username" field
      formData.append("password", password);

      const response = await fetch("/api/auth/login", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Login failed");
      }

      const userData = await response.json();
      console.log("Login successful, user data:", userData);

      // Set the user state
      setUser(userData);

      // Store user data in localStorage for persistence
      saveUserToStorage(userData);

      // Return the user data in case it's needed
      return userData;
    } catch (error) {
      console.error("Login error:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signup = async (
    firstName: string,
    lastName: string,
    email: string,
    password: string
  ) => {
    setLoading(true);
    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          email,
          password,
          role: "user",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error("Signup failed:", {
          status: response.status,
          statusText: response.statusText,
          data,
        });
        throw new Error(
          data.detail || "Failed to create account. Please try again."
        );
      }

      // Return the response data instead of setting the user
      return data;
    } catch (error) {
      console.error("Signup error:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
      });

      // Clear user state and localStorage
      setUser(null);
      clearUserFromStorage();
    } catch (error) {
      console.error("Logout error:", error);
      // Even if the logout API fails, clear the local user state
      setUser(null);
      clearUserFromStorage();
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, signup, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
