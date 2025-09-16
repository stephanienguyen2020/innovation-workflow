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

type LoginResponse = {
  userId: string;
  name: string;
  email: string;
  access_token: string;
};

type StoredUserData = {
  userId: string;
  name: string;
  email: string;
  access_token: string;
  token_type: string;
};

type SignupResult = {
  requires_verification?: boolean;
  is_admin?: boolean;
  message?: string;
  email?: string;
};

type AuthContextType = {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (
    firstName: string,
    lastName: string,
    email: string,
    password: string
  ) => Promise<SignupResult>;
  logout: () => Promise<void>;
  loading: boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Create a key for localStorage
const USER_STORAGE_KEY = "innovation_workflow_user";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isHydrated, setIsHydrated] = useState(false);

  // Function to retrieve user from localStorage
  const getUserFromStorage = () => {
    try {
      if (typeof window !== "undefined") {
        const storedUser = localStorage.getItem(USER_STORAGE_KEY);
        if (storedUser) {
          const userData = JSON.parse(storedUser) as StoredUserData;
          // Return just the user data portion
          return {
            id: userData.userId,
            name: userData.name,
            email: userData.email,
          };
        }
      }
    } catch (error) {
      console.error("Error retrieving user from storage:", error);
    }
    return null;
  };

  // Function to save user data and token to localStorage
  const saveUserToStorage = (loginResponse: LoginResponse) => {
    try {
      if (typeof window !== "undefined") {
        console.log("Saving user to storage:", loginResponse);
        // Store both user data and access token
        localStorage.setItem(
          USER_STORAGE_KEY,
          JSON.stringify({
            userId: loginResponse.userId,
            name: loginResponse.name,
            email: loginResponse.email,
            access_token: loginResponse.access_token,
            token_type: "bearer",
          } as StoredUserData)
        );
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

  // Handle hydration first
  useEffect(() => {
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    // Only run after hydration
    if (!isHydrated) return;

    // Check if user is logged in on initial load
    const checkUserLoggedIn = async () => {
      try {
        // Always try to get user from localStorage first
        const storedUser = getUserFromStorage();
        if (storedUser) {
          console.log("Found user in localStorage:", storedUser);
          setUser(storedUser);
        }

        // Just check if token is valid
        const response = await fetch("/api/auth/me");

        if (!response.ok) {
          // Server returned error
          console.warn("Server session validation failed:", response.status);
          setUser(null);
          clearUserFromStorage();
        }
      } catch (error) {
        console.error("Authentication check failed:", error);
        // On error, clear user data
        setUser(null);
        clearUserFromStorage();
      } finally {
        setLoading(false);
      }
    };

    checkUserLoggedIn();
  }, [isHydrated]);

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

      const data = await response.json();

      if (!response.ok) {
        // Check for specific error codes
        if (
          response.status === 403 &&
          data.errorCode === "EMAIL_NOT_VERIFIED"
        ) {
          throw new Error(
            "Email not verified. Please verify your email before logging in."
          );
        }
        throw new Error(data.detail || "Login failed");
      }
      console.log("Login successful, response data:", data);

      // Create login response object with both user data and token
      const loginResponse: LoginResponse = {
        userId: data.userId,
        name: data.name,
        email: data.email,
        access_token: data.access_token,
      };

      // Set the user state (only with user info, not token)
      setUser({
        id: loginResponse.userId,
        name: loginResponse.name,
        email: loginResponse.email,
      });

      // Store complete login response including token in localStorage
      saveUserToStorage(loginResponse);

      // Ensure the state update completes
      await new Promise((resolve) => setTimeout(resolve, 50));
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
          data.detail ||
            data.message ||
            "Failed to create account. Please try again."
        );
      }

      // Return the response data for the frontend to handle email verification
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

  // Don't render children until after hydration to prevent hydration mismatches
  if (!isHydrated) {
    return (
      <AuthContext.Provider
        value={{ user: null, login, signup, logout, loading: true }}
      >
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-lg">Loading...</div>
        </div>
      </AuthContext.Provider>
    );
  }

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
