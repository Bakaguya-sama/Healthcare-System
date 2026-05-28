export function AboutUs() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Header */}
      <div className="bg-brand text-white py-12 px-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-4">About Healthcare System</h1>
            <p className="text-lg text-blue-100">
              Revolutionizing healthcare with AI-powered consultations and patient management
            </p>
          </div>
          <a href="/" className="px-6 py-2 bg-white text-brand font-semibold rounded-lg hover:bg-blue-50 transition whitespace-nowrap">
            ← Back
          </a>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 py-12">
        {/* Mission */}
        <section className="mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Our Mission</h2>
          <p className="text-gray-700 text-lg leading-relaxed">
            We are committed to making healthcare accessible to everyone by combining modern technology 
            with medical expertise. Our platform connects patients with qualified doctors and provides 
            AI-powered health insights to improve wellness outcomes.
          </p>
        </section>

        {/* Vision */}
        <section className="mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Our Vision</h2>
          <p className="text-gray-700 text-lg leading-relaxed">
            To create a world where quality healthcare is accessible, affordable, and convenient for everyone, 
            powered by artificial intelligence and human expertise working together.
          </p>
        </section>

        {/* Features */}
        <section className="mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-8">What We Offer</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              {
                title: "AI Health Insights",
                desc: "Get personalized health recommendations powered by advanced AI technology"
              },
              {
                title: "Doctor Consultations",
                desc: "Connect with verified healthcare professionals for expert medical advice"
              },
              {
                title: "Health Tracking",
                desc: "Monitor your vital signs and health metrics over time"
              },
              {
                title: "Secure Records",
                desc: "Keep all your medical records safely stored in one place"
              },
              {
                title: "24/7 Support",
                desc: "Access healthcare services anytime, anywhere"
              },
              {
                title: "Doctor Network",
                desc: "Choose from a network of qualified healthcare providers"
              },
            ].map((feature) => (
              <div key={feature.title} className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm hover:shadow-md transition">
                <h3 className="text-xl font-semibold text-brand mb-2">{feature.title}</h3>
                <p className="text-gray-600">{feature.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Stats */}
        <section className="bg-brand text-white rounded-lg p-8 mb-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            <div>
              <div className="text-4xl font-bold mb-2">1000+</div>
              <p className="text-blue-100">Registered Patients</p>
            </div>
            <div>
              <div className="text-4xl font-bold mb-2">500+</div>
              <p className="text-blue-100">Verified Doctors</p>
            </div>
            <div>
              <div className="text-4xl font-bold mb-2">10K+</div>
              <p className="text-blue-100">Consultations</p>
            </div>
          </div>
        </section>

        {/* Contact CTA */}
        <section className="text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Ready to Get Started?</h2>
          <p className="text-gray-700 mb-6 max-w-2xl mx-auto">
            Join thousands of patients who trust our platform for their healthcare needs
          </p>
          <a href="/profile" className="inline-block bg-brand text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-700 transition">
            Explore Our Services
          </a>
        </section>
      </div>
    </div>
  );
}
