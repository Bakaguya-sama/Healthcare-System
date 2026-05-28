import { CheckCircle } from "lucide-react";

export function Services() {
  const services = [
    {
      title: "AI Health Assistant",
      description: "24/7 AI-powered health consultations and medical advice",
      features: [
        "Instant health assessments",
        "Symptom analysis",
        "Personalized recommendations",
        "Medical knowledge base",
      ],
      price: "Free",
    },
    {
      title: "Doctor Consultations",
      description: "Connect with qualified healthcare professionals",
      features: [
        "Video consultations",
        "Scheduled appointments",
        "Medical prescriptions",
        "Professional advice",
      ],
      price: "Free",
    },
    {
      title: "Health Tracking",
      description: "Monitor your health metrics and wellness",
      features: [
        "Vital signs tracking",
        "Health history",
        "Progress reports",
        "Trend analysis",
      ],
      price: "Free",
    },
    {
      title: "Medical Records",
      description: "Secure storage for all your medical documents",
      features: [
        "Secure cloud storage",
        "Easy sharing",
        "Digital records",
        "Always accessible",
      ],
      price: "Free",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Header */}
      <div className="bg-brand text-white py-12 px-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-4">Our Services</h1>
            <p className="text-lg text-blue-100">
              Comprehensive healthcare solutions designed for your wellness
            </p>
          </div>
          <a href="/" className="px-6 py-2 bg-white text-brand font-semibold rounded-lg hover:bg-blue-50 transition whitespace-nowrap">
            ← Back
          </a>
        </div>
      </div>

      {/* Services Grid */}
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
          {services.map((service) => (
            <div key={service.title} className="bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-lg transition overflow-hidden">
              <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-6">
                <h3 className="text-2xl font-bold">{service.title}</h3>
                <p className="text-blue-100 mt-2">{service.description}</p>
              </div>
              <div className="p-6">
                <ul className="space-y-3 mb-6">
                  {service.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3">
                      <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700">{feature}</span>
                    </li>
                  ))}
                </ul>
                <div className="text-2xl font-bold text-brand">{service.price}</div>
              </div>
            </div>
          ))}
        </div>

        {/* How It Works */}
        <section className="bg-gray-50 rounded-lg p-8 mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[
              { step: 1, title: "Sign Up", desc: "Create your account in minutes" },
              { step: 2, title: "Complete Profile", desc: "Share your health information" },
              { step: 3, title: "Get Started", desc: "Access all our services immediately" },
              { step: 4, title: "Manage Health", desc: "Track and improve your wellness" },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="bg-brand text-white rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-4 text-lg font-bold">
                  {item.step}
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">{item.title}</h3>
                <p className="text-gray-600 text-sm">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ Section */}
        <section>
          <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">Frequently Asked Questions</h2>
          <div className="space-y-4 max-w-2xl mx-auto">
            {[
              {
                q: "Is my health information safe?",
                a: "Yes, we use enterprise-grade encryption and comply with all healthcare privacy regulations.",
              },
              {
                q: "How do I schedule a doctor consultation?",
                a: "Simply use our booking system to select a doctor and schedule your appointment.",
              },
              {
                q: "Is the AI assistant available 24/7?",
                a: "Yes, our AI health assistant is always available for your health queries.",
              },
            ].map((faq, idx) => (
              <details key={idx} className="bg-white border border-gray-200 rounded-lg p-4 cursor-pointer hover:bg-gray-50">
                <summary className="font-semibold text-gray-900">{faq.q}</summary>
                <p className="text-gray-600 mt-3">{faq.a}</p>
              </details>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
