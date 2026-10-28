import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";

import HomePage from "./pages/HomePage";
import MumbaiPage from "./pages/MumbaiPage";
import ParentOnboarding from "./pages/ParentOnboarding";
import AnalyticsTracker from "./components/AnalyticsTracker";

// Every other page is downloaded only when it is opened, so visitors do not
// download the admin dashboard and admins do not download the public pages.
// If a page file is missing (the site was updated while this tab was open), reload once.
function lazyPage(importPage) {
  return lazy(() =>
    importPage()
      .then((module) => {
        sessionStorage.removeItem("pageReloadedForUpdate");
        return module;
      })
      .catch((error) => {
        if (!sessionStorage.getItem("pageReloadedForUpdate")) {
          sessionStorage.setItem("pageReloadedForUpdate", "1");
          window.location.reload();
          return new Promise(() => {});
        }
        throw error;
      })
  );
}

const AdminDashboard = lazyPage(() => import("./pages/AdminDashboard"));
const AdminLogin = lazyPage(() => import("./pages/AdminLogin"));
const ParentEnquiryForm = lazyPage(() => import("./pages/ParentEnquiryForm"));
const BlogPage = lazyPage(() => import("./pages/BlogPage"));
const BlogDetail = lazyPage(() => import("./pages/BlogDetail"));
const ThankYou = lazyPage(() => import("./pages/ThankYou"));
const TutorRegistration = lazyPage(() => import("./pages/TutorRegistration"));
const PaymentPage = lazyPage(() => import("./pages/PaymentPage"));
const BlogLogin = lazyPage(() => import("./pages/BlogLogin"));
const AdminBlogEditor = lazyPage(() => import("./pages/AdminBlogEditor"));
const CategoryPage = lazyPage(() => import("./pages/CategoryPage"));
const CoursePage = lazyPage(() => import("./pages/CoursePage"));
const SubCategoryPage = lazyPage(() => import("./pages/SubCategoryPage"));
const PrivacyPolicy = lazyPage(() => import("./pages/PrivacyPolicy"));
const Disclaimer = lazyPage(() => import("./pages/Disclaimer"));
const TermsConditions = lazyPage(() => import("./pages/TermsAndConditions"));
const Testimonials = lazyPage(() => import("./pages/Testimonials"));
const TeacherLogin = lazyPage(() => import("./pages/TeacherLogin"));
const TeacherDashboard = lazyPage(() => import("./pages/TeacherDashboard"));
const ParentPortal = lazyPage(() => import("./pages/ParentPortal"));

// Admin Protected Route
function ProtectedRoute({ children }) {
  const token = localStorage.getItem("adminToken");
  return token ? children : <Navigate to="/admin-login" replace />;
}

// Blog Editor Protected Route
function BlogProtectedRoute({ children }) {
  const token = localStorage.getItem("blogEditorToken");
  return token ? children : <Navigate to="/blog-login" replace />;
}

// Tutor Protected Route
function TutorProtectedRoute({ children }) {
  const token = localStorage.getItem("tutorToken");
  return token ? children : <Navigate to="/teacher/login" replace />;
}

export default function App() {
  const host = window.location.hostname;

  const isMumbaiSubdomain =
    host === "mumbai.saraswatitutorial.com" ||
    host.startsWith("mumbai.");

  // tnc.saraswatitutorials.com (handles both spellings of domain)
  const isTncSubdomain =
    host === "tnc.saraswatitutorials.com" ||
    host === "tnc.saraswatitutorial.com" ||
    host.startsWith("tnc.");

  return (
    <HelmetProvider>
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 transition-colors duration-200">
        <AnalyticsTracker />
        <Suspense fallback={<div className="py-24 text-center text-sm font-semibold text-slate-500">Loading...</div>}>
        <Routes>
          {/* Public Pages */}
          <Route
            path="/"
            element={
              isTncSubdomain
                ? <ParentOnboarding />
                : isMumbaiSubdomain
                ? <MumbaiPage />
                : <HomePage />
            }
          />

          <Route path="/mumbai" element={<MumbaiPage />} />

          <Route path="/blogs" element={<BlogPage />} />
          <Route path="/blogs/:slug" element={<BlogDetail />} />
          <Route path="/parent-enquiry" element={<ParentEnquiryForm />} />
          <Route path="/thank-you" element={<ThankYou />} />
          <Route path="/tutor-verification" element={<TutorRegistration />} />
          <Route path="/tutor-register" element={<Navigate to="/tutor-verification" replace />} />
          <Route path="/payment" element={<PaymentPage />} />

          {/* Teacher & Parent Portal Routes */}
          <Route path="/teacher/login" element={<TeacherLogin />} />
          <Route path="/teacher-login" element={<Navigate to="/teacher/login" replace />} />
          <Route
            path="/teacher/dashboard"
            element={
              <TutorProtectedRoute>
                <TeacherDashboard />
              </TutorProtectedRoute>
            }
          />
          <Route path="/parent/login" element={<ParentPortal />} />
          <Route path="/parent/attendance" element={<Navigate to="/parent/login" replace />} />

          {/* Admin Login */}
          <Route path="/admin-login" element={<AdminLogin />} />

          {/* Blog Editor Login */}
          <Route path="/blog-login" element={<BlogLogin />} />

          {/* Admin Dashboard */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />

          {/* Blog Editor Page */}
          <Route
            path="/admin/blogs"
            element={
              <BlogProtectedRoute>
                <AdminBlogEditor />
              </BlogProtectedRoute>
            }
          />

          <Route path="/testimonials" element={<Testimonials />} />

          <Route path="/courses/:category" element={<CategoryPage />} />
          <Route path="/courses/:main/:sub" element={<SubCategoryPage />} />
          <Route path="/courses/:main/:sub/:course" element={<CoursePage />} />

          <Route path="/terms-conditions" element={<TermsConditions />} />
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
          <Route path="/disclaimer" element={<Disclaimer />} />

          <Route path="*" element={<h1>404 - Page Not Found</h1>} />
        </Routes>
        </Suspense>
      </div>
    </HelmetProvider>
  );
}