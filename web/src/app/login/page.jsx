"use client";

import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { LogIn, Loader, AlertCircle, Zap, Eye, EyeOff } from "lucide-react";

export default function LoginPage() {
  const navigate = useNavigate();
  const [credentials, setCredentials] = useState({
    spaceUrl: "",
    projectId: "",
    apiToken: "",
  });
  const [rememberMe, setRememberMe] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // Check if already logged in
  useEffect(() => {
    const session = localStorage.getItem("sally_sales_session");
    if (session) {
      try {
        const sessionData = JSON.parse(session);
        if (sessionData.isLoggedIn && sessionData.credentials) {
          // Already logged in, redirect to dashboard
          navigate("/dashboard");
        }
      } catch (e) {
        // Invalid session, clear it
        localStorage.removeItem("sally_sales_session");
      }
    }

    // Load saved credentials if remember me was checked
    const savedCredentials = localStorage.getItem("sally_sales_credentials");
    if (savedCredentials) {
      try {
        const creds = JSON.parse(savedCredentials);
        setCredentials(creds);
        setRememberMe(true);
      } catch (e) {
        console.error("Failed to load saved credentials");
      }
    }
  }, [navigate]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setCredentials((prev) => ({
      ...prev,
      [name]: value,
    }));
    setError(""); // Clear error on input change
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      // Validate inputs
      if (!credentials.spaceUrl || !credentials.projectId || !credentials.apiToken) {
        throw new Error("Please fill in all fields");
      }

      // Use the default subscriber ID
      const DEFAULT_SUBSCRIBER_ID = "sally_sales_default_user";

      // Test credentials and create/reuse subscriber
      const response = await fetch("/api/signalwire/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...credentials,
          subscriberId: DEFAULT_SUBSCRIBER_ID,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to connect to SignalWire");
      }

      const data = await response.json();

      // Save session
      const sessionData = {
        isLoggedIn: true,
        credentials,
        subscriberData: data,
        timestamp: new Date().toISOString(),
      };
      localStorage.setItem("sally_sales_session", JSON.stringify(sessionData));
      localStorage.setItem("sally_sales_subscriber_id", DEFAULT_SUBSCRIBER_ID);

      // Save credentials if remember me is checked
      if (rememberMe) {
        localStorage.setItem("sally_sales_credentials", JSON.stringify(credentials));
      } else {
        localStorage.removeItem("sally_sales_credentials");
      }

      // Redirect to dashboard
      navigate("/dashboard");
    } catch (err) {
      console.error("Login error:", err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo & Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl mb-4 shadow-lg">
            <Zap className="text-white" size={32} />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Sally Sales
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            AI-Powered Voice Agent Platform
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-8">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
            Sign in to your account
          </h2>

          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start space-x-3">
              <AlertCircle className="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" size={20} />
              <div className="flex-1">
                <p className="text-sm font-medium text-red-800 dark:text-red-300">
                  {error}
                </p>
              </div>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            {/* Space URL */}
            <div>
              <label
                htmlFor="spaceUrl"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                Space URL
              </label>
              <input
                type="text"
                id="spaceUrl"
                name="spaceUrl"
                value={credentials.spaceUrl}
                onChange={handleInputChange}
                placeholder="demo.signalwire.com"
                className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:text-white transition-all"
                required
              />
            </div>

            {/* Project ID */}
            <div>
              <label
                htmlFor="projectId"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                Project ID
              </label>
              <input
                type="text"
                id="projectId"
                name="projectId"
                value={credentials.projectId}
                onChange={handleInputChange}
                placeholder="5d30e1ba-32c2-..."
                className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:text-white transition-all"
                required
              />
            </div>

            {/* API Token */}
            <div>
              <label
                htmlFor="apiToken"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                API Token
              </label>
              <div className="relative">
                <input
                  type={showToken ? "text" : "password"}
                  id="apiToken"
                  name="apiToken"
                  value={credentials.apiToken}
                  onChange={handleInputChange}
                  placeholder="PTe6d2153a3f9aa..."
                  className="w-full px-4 py-3 pr-12 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:text-white transition-all"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                >
                  {showToken ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            {/* Remember Me */}
            <div className="flex items-center">
              <input
                type="checkbox"
                id="rememberMe"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
              />
              <label
                htmlFor="rememberMe"
                className="ml-2 text-sm text-gray-700 dark:text-gray-300"
              >
                Remember my credentials
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium rounded-lg shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center space-x-2"
            >
              {isLoading ? (
                <>
                  <Loader className="animate-spin" size={20} />
                  <span>Connecting...</span>
                </>
              ) : (
                <>
                  <LogIn size={20} />
                  <span>Sign In</span>
                </>
              )}
            </button>
          </form>

          {/* Help Text */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Don't have a SignalWire account?{" "}
              <a
                href="https://signalwire.com/signup"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
              >
                Sign up free
              </a>
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Powered by SignalWire • Built with ❤️
          </p>
        </div>
      </div>
    </div>
  );
}
