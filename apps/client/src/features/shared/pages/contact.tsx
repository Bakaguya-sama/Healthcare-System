import { Mail, Phone, MapPin } from "lucide-react";

export function Contact() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Header */}
      <div className="bg-brand text-white py-12 px-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-4">Contact Us</h1>
            <p className="text-lg text-blue-100">
              We're here to help. Get in touch with us anytime
            </p>
          </div>
          <a href="/" className="px-6 py-2 bg-white text-brand font-semibold rounded-lg hover:bg-blue-50 transition whitespace-nowrap">
            ← Back
          </a>
        </div>
      </div>

      {/* Contact Section */}
      <div className="max-w-6xl mx-auto px-4 py-12">
        <h2 className="text-3xl font-bold text-gray-900 mb-8">Get In Touch</h2>

        <div className="space-y-8">
          {/* Email */}
          <div className="flex gap-4">
            <div className="bg-blue-100 text-brand p-4 rounded-lg h-fit">
              <Mail className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-1">Email</h3>
              <p className="text-gray-600">support@healthcare.com</p>
              <p className="text-gray-600">info@healthcare.com</p>
            </div>
          </div>

          {/* Phone */}
          <div className="flex gap-4">
            <div className="bg-blue-100 text-brand p-4 rounded-lg h-fit">
              <Phone className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-1">Phone</h3>
              <p className="text-gray-600">+84 (0) 123 456 789</p>
              <p className="text-gray-600">Mon-Fri 9AM-6PM</p>
            </div>
          </div>

          {/* Address */}
          <div className="flex gap-4">
            <div className="bg-blue-100 text-brand p-4 rounded-lg h-fit">
              <MapPin className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-1">Address</h3>
              <p className="text-gray-600">123 Healthcare Street</p>
              <p className="text-gray-600">Ho Chi Minh City, Vietnam</p>
            </div>
          </div>
        </div>

        {/* Response Time */}
        <div className="mt-12 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <p className="text-gray-600">
            <strong>Response Time:</strong> We typically respond to all inquiries within 24 hours
          </p>
        </div>
      </div>
    </div>
  );
}
