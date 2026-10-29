import React from "react";
import { Link } from "react-router-dom";
import { Phone, Mail } from "lucide-react";
import BrandLogo from "./BrandLogo";

// The home page's footer for the other pages (parent enquiry form).
// city: "Bangalore" | "Mumbai" (each city has its own support contact)
const SUPPORT_CONTACT = {
  Bangalore: { phone: "+91 8904457689 / +91 9041157689", email: "support@saraswatitutorial.com" },
  Mumbai: { phone: "+91 9041157689", email: "services@saraswatitutorial.com" },
};

export default function SiteFooter({ city = "Bangalore" }) {
  const contact = SUPPORT_CONTACT[city] || SUPPORT_CONTACT.Bangalore;

  return (
    <footer className="border-t border-white/20 dark:border-slate-800 bg-white/30 dark:bg-slate-900/30 py-12 text-slate-600 dark:text-slate-400">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid gap-8 md:grid-cols-4">
          <div>
            <div className="flex items-center gap-3">
              <BrandLogo alt="Saraswati Tutorial Logo" className="h-10 w-10 rounded-xl object-contain" />
              <span className="text-lg font-black text-slate-950 dark:text-white">Saraswati Tutorial</span>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
              Expert tutoring services mapping local academic boards across Bangalore and Mumbai.
            </p>
          </div>

          <div>
            <h5 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-xs">Direct Services</h5>
            <ul className="mt-4 space-y-2 text-sm">
              <li><Link to="/parent-enquiry" className="hover:text-blue-600">Parent Enquiry</Link></li>
              <li><Link to="/tutor-verification" className="hover:text-blue-600">Become a Tutor</Link></li>
              <li><a href="https://saraswatitutorial.com/" className="hover:text-blue-600">Home Tuition Services</a></li>
              <li><a href="https://saraswatitutorial.com/#tutors" className="hover:text-blue-600">Online Tuition</a></li>
            </ul>
          </div>

          <div>
            <h5 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-xs">Legal Details</h5>
            <ul className="mt-4 space-y-2 text-sm">
              <li><Link to="/terms-conditions" className="hover:text-blue-600">Terms & Conditions</Link></li>
              <li><Link to="/privacy-policy" className="hover:text-blue-600">Privacy Policy</Link></li>
              <li><Link to="/disclaimer" className="hover:text-blue-600">Disclaimer</Link></li>
            </ul>
          </div>

          <div>
            <h5 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-xs">Support Contact</h5>
            <ul className="mt-4 space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-blue-600" />
                <span>{contact.phone}</span>
              </li>
              <li className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-blue-600" />
                <span>{contact.email}</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 border-t border-slate-100 dark:border-slate-800 pt-6 text-center text-xs text-slate-400 dark:text-slate-500">
          &copy; {new Date().getFullYear()} Saraswati Tutorials. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
