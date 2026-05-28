import { Mail, Phone, MapPin } from "lucide-react";

export function Contact() {
  return (
    <main className="flex-1 overflow-auto p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-semibold text-gray-900">Contact Support</h1>
          <a href="/" className="px-6 py-2 bg-brand text-white font-semibold rounded-lg hover:bg-blue-700 transition">
            ← Back
          </a>
        </div>

        {/* Contact Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Email */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <Mail className="h-6 w-6 text-blue-500" />
              <h3 className="font-semibold text-gray-900">Email Support</h3>
            </div>
            <p className="text-gray-600 text-sm mb-2">
              <a href="mailto:admin@healthcare.com" className="text-blue-600 hover:underline">
                admin@healthcare.com
              </a>
            </p>
            <p className="text-gray-600 text-sm">
              <a href="mailto:support@healthcare.com" className="text-blue-600 hover:underline">
                support@healthcare.com
              </a>
            </p>
          </div>

          {/* Phone */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <Phone className="h-6 w-6 text-green-500" />
              <h3 className="font-semibold text-gray-900">Phone Support</h3>
            </div>
            <p className="text-gray-600 text-sm mb-2">+84 (0) 123 456 789</p>
            <p className="text-gray-600 text-sm">Mon-Fri 9AM-6PM (Vietnam Time)</p>
          </div>

          {/* Location */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <MapPin className="h-6 w-6 text-red-500" />
              <h3 className="font-semibold text-gray-900">Office Location</h3>
            </div>
            <p className="text-gray-600 text-sm mb-1">123 Healthcare Street</p>
            <p className="text-gray-600 text-sm">Ho Chi Minh City, Vietnam</p>
          </div>
        </div>

        {/* Support Categories */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">📞 Support Categories</h2>
          <div className="space-y-3">
            {[
              { category: "System Issues", desc: "Report bugs or technical problems" },
              { category: "Account Management", desc: "Help with admin account issues" },
              { category: "Feature Requests", desc: "Suggest new features or improvements" },
              { category: "Security Concerns", desc: "Report security vulnerabilities" },
              { category: "Compliance Questions", desc: "Healthcare compliance inquiries" },
              { category: "General Inquiries", desc: "Any other questions" },
            ].map((item) => (
              <div key={item.category} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg hover:bg-blue-50 transition cursor-pointer">
                <div className="text-blue-500 font-bold text-lg mt-0.5">→</div>
                <div>
                  <h3 className="font-semibold text-gray-900">{item.category}</h3>
                  <p className="text-gray-600 text-sm">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* FAQ */}
        <section className="bg-white rounded-lg border border-gray-200 p-6 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">❓ Frequently Asked Questions</h2>
          <div className="space-y-3">
            {[
              {
                q: "How do I verify a doctor's credentials?",
                a: "Go to Document Verification section, upload required documents and follow the verification workflow.",
              },
              {
                q: "How do I handle user violations?",
                a: "Navigate to Violation Reports, review violations and take appropriate action.",
              },
              {
                q: "Can I export system reports?",
                a: "Yes, all reports can be downloaded from the Overview dashboard.",
              },
              {
                q: "How is patient data secured?",
                a: "All data is encrypted and stored securely following healthcare compliance standards.",
              },
            ].map((faq, idx) => (
              <details key={idx} className="bg-gray-50 border border-gray-200 rounded-lg p-4 cursor-pointer hover:bg-blue-50 transition">
                <summary className="font-semibold text-gray-900">{faq.q}</summary>
                <p className="text-gray-600 mt-3 text-sm">{faq.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Response Time */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="font-semibold text-gray-900 mb-2">⏱️ Response Time</h3>
          <p className="text-gray-700">
            We strive to respond to all support inquiries within 24 hours. For urgent security issues, 
            please call our hotline immediately.
          </p>
        </div>
      </div>
    </main>
  );
}
