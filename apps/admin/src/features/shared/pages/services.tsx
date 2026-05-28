export function Services() {
  const services = [
    {
      title: "Doctor Management",
      description: "Verify credentials and manage healthcare providers",
      features: [
        "Credential verification system",
        "Doctor performance tracking",
        "License management",
        "Review moderation",
      ],
    },
    {
      title: "Patient Management",
      description: "Oversee patient accounts and health compliance",
      features: [
        "User account management",
        "Health metrics monitoring",
        "Violation reporting",
        "Account status control",
      ],
    },
    {
      title: "System Analytics",
      description: "Monitor platform performance and usage",
      features: [
        "Real-time dashboard",
        "Session tracking",
        "User statistics",
        "System health monitoring",
      ],
    },
    {
      title: "Compliance & Safety",
      description: "Ensure healthcare standards and data security",
      features: [
        "Violation detection",
        "Content moderation",
        "Compliance reporting",
        "Data security management",
      ],
    },
  ];

  return (
    <main className="flex-1 overflow-auto p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900 mb-2">Admin Services</h1>
            <p className="text-gray-600">Comprehensive tools for healthcare platform management</p>
          </div>
          <a href="/" className="px-6 py-2 bg-brand text-white font-semibold rounded-lg hover:bg-blue-700 transition whitespace-nowrap">
            ← Back
          </a>
        </div>        {/* Services Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {services.map((service) => (
            <div key={service.title} className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition">
              <h3 className="text-xl font-bold text-gray-900 mb-2">{service.title}</h3>
              <p className="text-gray-600 mb-4">{service.description}</p>
              <ul className="space-y-2">
                {service.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2 text-gray-700">
                    <span className="text-blue-500 font-bold">•</span>
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* How to Use */}
        <section className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">📖 How to Use Admin Dashboard</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">1. User Management</h3>
              <p className="text-gray-700">Manage doctors and patient accounts. Verify credentials and handle account issues.</p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">2. Document Verification</h3>
              <p className="text-gray-700">Review and verify doctor credentials, licenses, and certifications.</p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">3. Violation Reports</h3>
              <p className="text-gray-700">Monitor and handle user violations and compliance issues.</p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">4. Overview Dashboard</h3>
              <p className="text-gray-700">View real-time statistics and platform health metrics.</p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
