export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
}

// Login the user
export const login = async (email: string, password: string): Promise<User> => {
  const response = await fetch("/auth/login", {
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
  const user = {
    id: data.user?.id || "temp-id",
    name:
      `${data.user?.first_name || ""} ${data.user?.last_name || ""}`.trim() ||
      email.split("@")[0],
    email: email,
  };

  localStorage.setItem("user", JSON.stringify(user));
  return user;
};

// Signup the user
export const signup = async (
  firstName: string,
  lastName: string,
  email: string,
  password: string
): Promise<User> => {
  const response = await fetch("/auth/signup", {
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
  const user = {
    id: data.user?.id || "temp-id",
    name: `${firstName} ${lastName}`,
    email: email,
  };

  localStorage.setItem("user", JSON.stringify(user));
  return user;
};

// Logout the user
export const logout = async (): Promise<void> => {
  const response = await fetch("/auth/logout", {
    method: "POST",
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Logout failed");
  }

  localStorage.removeItem("user");
};

export const getCurrentUser = (): User | null => {
  if (typeof window === "undefined") return null;

  const user = localStorage.getItem("user");
  return user ? JSON.parse(user) : null;
};

export const isAuthenticated = (): boolean => {
  return getCurrentUser() !== null;
};
