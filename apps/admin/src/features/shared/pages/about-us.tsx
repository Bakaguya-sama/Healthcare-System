export function AboutUs() {
  return (
    <main className="flex-1 overflow-auto p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-semibold text-gray-900">About Healthcare System</h1>
          <a href="/" className="px-6 py-2 bg-brand text-white font-semibold rounded-lg hover:bg-blue-700 transition">
            ← Back
          </a>
        </div>

        {/* Mission */}
        <section className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">🎯 Our Mission</h2>
          <p className="text-gray-700 leading-relaxed">
            We empower healthcare administrators with tools to manage doctor networks, verify credentials, 
            monitor patient health metrics, and ensure compliance with healthcare standards. Our platform 
            bridges the gap between doctors, patients, and administrators.
          </p>
        </section>

        {/* Core Values */}
        <section className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">💎 Core Values</h2>
          <div className="space-y-4">
            {[
              { title: "Integrity", desc: "Upholding the highest standards of healthcare management" },
              { title: "Innovation", desc: "Leveraging technology to improve healthcare delivery" },
              { title: "Transparency", desc: "Clear communication and data accessibility" },
              { title: "Excellence", desc: "Consistent quality in all operations" },
            ].map((value) => (
              <div key={value.title} className="flex gap-3">
                <div className="text-brand font-bold text-lg">•</div>
                <div>
                  <h3 className="font-semibold text-gray-900">{value.title}</h3>
                  <p className="text-gray-600">{value.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Platform Stats */}
        <section className="bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg p-6 mb-6">
          <h2 className="text-2xl font-bold mb-6">📊 Platform Statistics</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Total Users", value: "10K+" },
              { label: "Active Doctors", value: "500+" },
              { label: "Patients", value: "1000+" },
              { label: "Consultations", value: "10K+" },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-3xl font-bold mb-2">{stat.value}</div>
                <p className="text-blue-100 text-sm">{stat.label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Admin Features */}
        <section className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">🛠️ Admin Capabilities</h2>
          <div className="space-y-3">
            {[
              "Verify and manage doctor credentials",
              "Monitor healthcare provider performance",
              "Track patient health metrics and compliance",
              "Generate system analytics and reports",
              "Manage user accounts and permissions",
              "Enforce healthcare compliance standards",
            ].map((feature) => (
              <div key={feature} className="flex items-center gap-3 text-gray-700">
                <span className="text-green-500 font-bold">✓</span>
                {feature}
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
