"use client";

import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import {
  Users,
  FileText,
  Phone,
  Plus,
  Activity,
  Clock,
  TrendingUp,
  Zap,
  ArrowRight,
} from "lucide-react";

export default function DashboardPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalEmployees: 0,
    activeCalls: 0,
    totalCalls: 0,
    avgDuration: 0,
  });
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      // Load employees from localStorage for now
      const employeesData = localStorage.getItem("sally_sales_employees");
      const employees = employeesData ? JSON.parse(employeesData) : [];

      // Load call history (mock for now)
      const callHistory = localStorage.getItem("sally_sales_call_history");
      const calls = callHistory ? JSON.parse(callHistory) : [];

      // Calculate stats
      const activeCalls = calls.filter((c) => c.status === "active").length;
      const totalCalls = calls.length;
      const avgDuration =
        totalCalls > 0
          ? calls.reduce((sum, c) => sum + (c.duration || 0), 0) / totalCalls
          : 0;

      setStats({
        totalEmployees: employees.length,
        activeCalls,
        totalCalls,
        avgDuration: Math.round(avgDuration),
      });

      // Get recent activity
      const activity = calls
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, 5)
        .map((call) => ({
          id: call.id,
          type: "call",
          employee: call.employeeName || "Unknown Employee",
          message: `Call ${call.status} - ${call.duration || 0}s`,
          timestamp: call.timestamp,
        }));

      setRecentActivity(activity);
    } catch (error) {
      console.error("Failed to load dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const quickActions = [
    {
      title: "Create Employee",
      description: "Add a new AI voice agent",
      icon: Plus,
      color: "blue",
      action: () => navigate("/dashboard/employees?new=true"),
    },
    {
      title: "Browse Templates",
      description: "Start with a pre-built agent",
      icon: FileText,
      color: "purple",
      action: () => navigate("/dashboard/templates"),
    },
    {
      title: "View Employees",
      description: "Manage your AI agents",
      icon: Users,
      color: "green",
      action: () => navigate("/dashboard/employees"),
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-8 text-white shadow-xl">
        <h1 className="text-3xl font-bold mb-2">Welcome back!</h1>
        <p className="text-blue-100">
          Manage your AI voice agents and track their performance
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Employees"
          value={stats.totalEmployees}
          icon={Users}
          color="blue"
          trend={null}
        />
        <StatCard
          title="Active Calls"
          value={stats.activeCalls}
          icon={Phone}
          color="green"
          trend={null}
        />
        <StatCard
          title="Total Calls"
          value={stats.totalCalls}
          icon={Activity}
          color="purple"
          trend="+12%"
        />
        <StatCard
          title="Avg Duration"
          value={`${stats.avgDuration}s`}
          icon={Clock}
          color="orange"
          trend="-5%"
        />
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {quickActions.map((action) => (
            <QuickActionCard key={action.title} {...action} />
          ))}
        </div>
      </div>

      {/* Recent Activity */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          Recent Activity
        </h2>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
          {recentActivity.length === 0 ? (
            <div className="p-12 text-center">
              <Activity className="mx-auto text-gray-400 dark:text-gray-600 mb-4" size={48} />
              <p className="text-gray-500 dark:text-gray-400 mb-4">
                No recent activity
              </p>
              <button
                onClick={() => navigate("/dashboard/employees?new=true")}
                className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                <Plus size={18} />
                <span>Create Your First Employee</span>
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {recentActivity.map((item) => (
                <div key={item.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <Zap className="text-blue-600 dark:text-blue-400" size={16} />
                        <span className="font-medium text-gray-900 dark:text-white">
                          {item.employee}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {item.message}
                      </p>
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {new Date(item.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Getting Started Guide (if no employees) */}
      {stats.totalEmployees === 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-800 rounded-xl p-6">
          <div className="flex items-start space-x-4">
            <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
              <Zap className="text-white" size={24} />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-2">
                Get Started with Sally Sales
              </h3>
              <p className="text-blue-800 dark:text-blue-200 mb-4">
                Create your first AI voice agent in minutes. Choose from our templates or build your own from scratch.
              </p>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => navigate("/dashboard/templates")}
                  className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  <FileText size={18} />
                  <span>Browse Templates</span>
                  <ArrowRight size={16} />
                </button>
                <button
                  onClick={() => navigate("/dashboard/employees?new=true")}
                  className="inline-flex items-center space-x-2 px-4 py-2 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-blue-600 dark:text-blue-400 border border-blue-300 dark:border-blue-700 rounded-lg transition-colors"
                >
                  <Plus size={18} />
                  <span>Create From Scratch</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ title, value, icon: Icon, color, trend }) {
  const colorClasses = {
    blue: "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400",
    green: "bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400",
    purple: "bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400",
    orange: "bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400",
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${colorClasses[color]}`}>
          <Icon size={24} />
        </div>
        {trend && (
          <div className={`flex items-center space-x-1 text-sm ${trend.startsWith('+') ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            <TrendingUp size={14} />
            <span>{trend}</span>
          </div>
        )}
      </div>
      <div className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
        {value}
      </div>
      <div className="text-sm text-gray-500 dark:text-gray-400">{title}</div>
    </div>
  );
}

function QuickActionCard({ title, description, icon: Icon, color, action }) {
  const colorClasses = {
    blue: "from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800",
    purple: "from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800",
    green: "from-green-600 to-green-700 hover:from-green-700 hover:to-green-800",
  };

  return (
    <button
      onClick={action}
      className={`group bg-gradient-to-r ${colorClasses[color]} p-6 rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all text-left`}
    >
      <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center mb-4">
        <Icon className="text-white" size={24} />
      </div>
      <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
      <p className="text-sm text-white/90">{description}</p>
      <div className="mt-4 flex items-center text-white group-hover:translate-x-1 transition-transform">
        <span className="text-sm font-medium">Get started</span>
        <ArrowRight size={16} className="ml-2" />
      </div>
    </button>
  );
}
