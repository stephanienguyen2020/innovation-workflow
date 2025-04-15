export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
}

const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// Login the user
export const login = async (email: string, password: string): Promise<User> => {
  const response = await fetch(`${apiUrl}/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      username: email, // FastAPI OAuth2 form expects 'username'
      password: password,
    }),
    credentials: "include", // Important for cookie handling
  });

  if (!response.ok) {
    throw new Error("Login failed");
  }

  const data = await response.json();

  // Store token if provided in the response
  if (data.access_token) {
    localStorage.setItem("token", data.access_token);
  }

  const user = {
    id: data.user?.id || "temp-id",
    name:
      `${data.user?.first_name || ""} ${data.user?.last_name || ""}`.trim() ||
      email.split("@")[0],
    email: email,
  };

  localStorage.setItem("user", JSON.stringify(user));
  // For immediate use case, also set a mock user ID
  localStorage.setItem("userId", user.id);
  return user;
};

// Signup the user
export const signup = async (
  firstName: string,
  lastName: string,
  email: string,
  password: string
): Promise<User> => {
  const response = await fetch(`${apiUrl}/signup`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      first_name: firstName,
      last_name: lastName,
      email,
      password,
    }),
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Signup failed");
  }

  const data = await response.json();

  // Store token if provided in the response
  if (data.access_token) {
    localStorage.setItem("token", data.access_token);
  }

  const user = {
    id: data.user?.id || "temp-id",
    name: `${firstName} ${lastName}`,
    email: email,
  };

  localStorage.setItem("user", JSON.stringify(user));
  // For immediate use case, also set a mock user ID
  localStorage.setItem("userId", user.id);
  return user;
};

// Logout the user
export const logout = async (): Promise<void> => {
  const response = await fetch(`${apiUrl}/logout`, {
    method: "POST",
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Logout failed");
  }

  localStorage.removeItem("user");
  localStorage.removeItem("token");
  localStorage.removeItem("userId");
};

export const getCurrentUser = (): User | null => {
  if (typeof window === "undefined") return null;

  const user = localStorage.getItem("user");
  return user ? JSON.parse(user) : null;
};

export const isAuthenticated = (): boolean => {
  return getCurrentUser() !== null;
};

// Get authentication token for API requests
export const getAuthToken = (): string | null => {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
};

// Add authorization headers to fetch requests
export const getAuthHeaders = (): HeadersInit => {
  const token = getAuthToken();
  if (token) {
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
  }
  return {
    "Content-Type": "application/json",
  };
};

// Create a temporary user and token for development
export const createTemporaryAuth = async (): Promise<User> => {
  console.log("Creating local temporary user for development");
  const tempUser = {
    id: `temp-${Date.now()}`,
    name: "Temporary User",
    email: "temp@example.com",
  };

  localStorage.setItem("user", JSON.stringify(tempUser));
  localStorage.setItem("userId", tempUser.id);

  try {
    // Get a valid token from the backend dev-token endpoint
    const response = await fetch(`${apiUrl}/dev-token`);
    if (response.ok) {
      const data = await response.json();
      localStorage.setItem("token", data.access_token);
      console.log("Received valid development token");
    } else {
      // Fallback to fake token if the endpoint is not available
      console.warn(
        "Could not get valid token, using fallback development token"
      );
      localStorage.setItem("token", `dev-token-${Date.now()}`);
    }
  } catch (error) {
    console.error("Error getting development token:", error);
    // Fallback to fake token
    localStorage.setItem("token", `dev-token-${Date.now()}`);
  }

  return tempUser;
};
