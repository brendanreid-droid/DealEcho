import React from "react";
import { Link } from "react-router-dom";
import Icon from "../src/components/Icon";

const Privacy: React.FC = () => {
  return (
    <div className="bg-[#0f172a] min-h-screen py-16 px-6 relative overflow-hidden text-slate-300">
      {/* Premium ambient light filters */}
      <div className="absolute top-0 right-0 w-1/2 h-full bg-indigo-500/5 blur-[120px] rounded-full pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 w-1/3 h-1/2 bg-indigo-600/5 blur-[100px] rounded-full pointer-events-none"></div>

      <div className="max-w-4xl mx-auto relative z-10">
        {/* Navigation / Header */}
        <div className="flex items-center justify-between mb-12 border-b border-white/10 pb-6">
          <Link
            to="/"
            className="flex items-center text-indigo-400 hover:text-indigo-300 text-sm font-bold uppercase tracking-widest transition-colors space-x-2"
          >
            <Icon name="fa-arrow-left" size={14} />
            <span>Back to Home</span>
          </Link>
          <div className="text-right">
            <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">
              Legal Documents
            </span>
          </div>
        </div>

        {/* Title Block */}
        <div className="space-y-4 mb-12">
          <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight uppercase tracking-wide">
            Privacy Policy
          </h1>
          <p className="text-slate-400 text-sm font-medium">
            Last Updated: <span className="text-indigo-400 font-bold">May 22, 2026</span>
          </p>
        </div>

        {/* Privacy Policy Container */}
        <div className="bg-white/5 border border-white/10 backdrop-blur-3xl rounded-[32px] p-8 md:p-12 shadow-2xl space-y-10 leading-relaxed text-sm md:text-base font-normal">
          
          {/* Welcome/Agreement */}
          <p className="text-slate-300 italic border-l-4 border-indigo-500 pl-4 py-1">
            DealEcho Pty Ltd (ACN [Insert ACN]) ("DealEcho", "we", "us", or "our") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your personal information in accordance with the <em>Privacy Act 1988</em> (Cth) and the Australian Privacy Principles (APPs). By accessing or using DealEcho.io (the "Services"), you consent to the collection, use, and disclosure of your personal information as described in this policy.
          </p>

          <hr className="border-white/10" />

          {/* Section 1 */}
          <section className="space-y-4">
            <h2 className="text-xl font-black text-white uppercase tracking-wider flex items-center space-x-3">
              <span className="text-indigo-400 font-black">1.</span>
              <span>Personal Information We Collect</span>
            </h2>
            <div className="space-y-3 text-slate-400">
              <p>
                We only collect personal information that is reasonably necessary for one or more of our functions or activities. This includes:
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li>
                  <strong className="text-slate-200">Account and Profile Information:</strong> When you register an account via Firebase Authentication (email/password or Google Single Sign-On), we collect your name, email address, profile photo/avatar, and unique user ID.
                </li>
                <li>
                  <strong className="text-slate-200">User-Submitted Sales Intelligence (Your Content):</strong> When you submit ratings, company reviews, or buyer report cards, we collect the content of your review, the company rated, transaction metrics, and the timestamp.
                </li>
                <li>
                  <strong className="text-slate-200">Subscription and Billing Information:</strong> Subscriptions are securely processed through our payment gateway, Stripe. We collect transactional metadata such as your Stripe Customer ID, Subscription ID, billing status, and plan details. <em className="text-slate-400">Note: DealEcho does not store or process your raw credit card numbers or financial passwords; this information is captured directly and securely by Stripe under their privacy standards.</em>
                </li>
                <li>
                  <strong className="text-slate-200">Notification Preferences and Tracking:</strong> We collect details of the companies you track and your notification settings (e.g., opting in/out of Real-time Buyer Alerts or Weekly Insights Digests) to deliver tailored insights.
                </li>
                <li>
                  <strong className="text-slate-200">Technical and Usage Data:</strong> We automatically collect network, server, and browser diagnostic information (IP addresses, device type, logs) to ensure system security and optimise platform performance.
                </li>
              </ul>
            </div>
          </section>

          <hr className="border-white/10" />

          {/* Section 2 */}
          <section className="space-y-4">
            <h2 className="text-xl font-black text-white uppercase tracking-wider flex items-center space-x-3">
              <span className="text-indigo-400 font-black">2.</span>
              <span>How We Use Your Personal Information</span>
            </h2>
            <div className="space-y-3 text-slate-400">
              <p>
                We collect, hold, and use your personal information for the following primary purposes:
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li>
                  <strong className="text-slate-200">To Provide the Services:</strong> Administering your account, displaying crowdsourced company profiles, tracking company lists, and calculating analytical scores.
                </li>
                <li>
                  <strong className="text-slate-200">To Process Payments:</strong> Facilitating premium Pro Membership billing and renewals through Stripe.
                </li>
                <li>
                  <strong className="text-slate-200">To Manage Identity and Review Integrity:</strong> 
                  <ul className="list-disc pl-5 mt-2 space-y-1">
                    <li>Under our Terms of Use, if you are a Free Member, we automatically anonymise your submissions, displaying your reviews under the name "Anonymous" to protect your workplace identity.</li>
                    <li>If you upgrade to a Pro Member, we display your registered profile name and avatar alongside your reviews to establish professional credibility.</li>
                  </ul>
                </li>
                <li>
                  <strong className="text-slate-200">To Communicate with You:</strong> Sending necessary operational communications (security alerts, transactional receipts, system updates) and marketing updates (weekly digests, insights digests) strictly in accordance with your preferences and the <em>Spam Act 2003</em> (Cth).
                </li>
                <li>
                  <strong className="text-slate-200">Security and Abuse Prevention:</strong> Monitoring accounts to prevent automated scraping, spam reviews, or security threats.
                </li>
              </ul>
            </div>
          </section>

          <hr className="border-white/10" />

          {/* Section 3 */}
          <section className="space-y-4">
            <h2 className="text-xl font-black text-white uppercase tracking-wider flex items-center space-x-3">
              <span className="text-indigo-400 font-black">3.</span>
              <span>Disclosure of Personal Information</span>
            </h2>
            <div className="space-y-3 text-slate-400">
              <p>
                We do not sell, rent, or trade your personal information. We may disclose your information to third-party service providers (data processors) who assist us in operating our Services, including:
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong className="text-slate-200">Firebase (Google Cloud Platform):</strong> For hosting our database (Firestore), user authentication (Firebase Auth), and serverless functions.</li>
                <li><strong className="text-slate-200">Stripe:</strong> For payment processing and subscription billing management.</li>
                <li><strong className="text-slate-200">Professional Advisors:</strong> Our legal, accounting, and security auditors if required.</li>
                <li><strong className="text-slate-200">As Required by Law:</strong> To regulatory bodies, courts, or law enforcement agencies if we are legally obligated to do so.</li>
              </ul>
              
              <h3 className="font-bold text-slate-200 mt-6 mb-1">Cross-Border Disclosure of Data</h3>
              <p>
                Because we use secure cloud hosting infrastructure provided by Firebase (Google) and Stripe, some of your personal information may be transferred to, stored in, or processed on cloud infrastructure located outside of Australia (predominantly in the United States). By using our Services, you consent to this cross-border transfer. We take reasonable steps to ensure that these overseas providers handle your data in accordance with standards comparable to the APPs.
              </p>
            </div>
          </section>

          <hr className="border-white/10" />

          {/* Section 4 */}
          <section className="space-y-4">
            <h2 className="text-xl font-black text-white uppercase tracking-wider flex items-center space-x-3">
              <span className="text-indigo-400 font-black">4.</span>
              <span>Direct Marketing & Communications</span>
            </h2>
            <div className="space-y-3 text-slate-400">
              <p>
                We will only use your personal information to send you promotional material or marketing alerts (such as weekly intelligence briefs) if you have consented to receive them.
              </p>
              <p>
                You can easily opt out of marketing communications at any time by:
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Clicking the <strong className="text-slate-200">"unsubscribe"</strong> link at the bottom of any email we send you.</li>
                <li>Navigating to your Email Preferences page inside DealEcho.io.</li>
                <li>Contacting us directly at <a href="mailto:privacy@dealecho.io" className="text-indigo-400 hover:underline">privacy@dealecho.io</a>.</li>
              </ul>
              <p className="mt-2">
                We will not charge you for opting out, and we will process your request promptly. You cannot opt out of administrative or security emails that are essential for the management of your active account.
              </p>
            </div>
          </section>

          <hr className="border-white/10" />

          {/* Section 5 */}
          <section className="space-y-4">
            <h2 className="text-xl font-black text-white uppercase tracking-wider flex items-center space-x-3">
              <span className="text-indigo-400 font-black">5.</span>
              <span>Data Security and Retention</span>
            </h2>
            <div className="space-y-3 text-slate-400">
              <p>
                We take all reasonable steps to protect your personal information from misuse, interference, loss, unauthorised access, modification, or disclosure. These safeguards include:
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Using secure HTTPS connections for all database interactions.</li>
                <li>Utilising Firebase Custom Claims and strict Firestore Security Rules to restrict database access.</li>
                <li>Encrypting billing and identity tokens.</li>
              </ul>
              <p className="mt-2">
                We retain your personal information for as long as your account is active, or as long as necessary to provide the Services and comply with our legal and accounting obligations.
              </p>
            </div>
          </section>

          <hr className="border-white/10" />

          {/* Section 6 */}
          <section className="space-y-4">
            <h2 className="text-xl font-black text-white uppercase tracking-wider flex items-center space-x-3">
              <span className="text-indigo-400 font-black">6.</span>
              <span>Anonymity and Pseudonymity</span>
            </h2>
            <div className="space-y-2 text-slate-400">
              <p>
                In accordance with APP 2, wherever it is lawful and practicable, you have the option of not identifying yourself or using a pseudonym. DealEcho.io supports this principle by allowing you to sign up with a pseudonymous display name and automatically anonymising the names attached to review submissions for all non-paying members.
              </p>
            </div>
          </section>

          <hr className="border-white/10" />

          {/* Section 7 */}
          <section className="space-y-4">
            <h2 className="text-xl font-black text-white uppercase tracking-wider flex items-center space-x-3">
              <span className="text-indigo-400 font-black">7.</span>
              <span>Accessing, Correcting, or Deleting Your Information</span>
            </h2>
            <div className="space-y-2 text-slate-400">
              <p>
                You have a right to access the personal information we hold about you, request corrections if it is inaccurate or out of date, or request the deletion of your account and personal data.
              </p>
              <p>
                To make a request, please email us at <a href="mailto:privacy@dealecho.io" className="text-indigo-400 hover:underline font-bold">privacy@dealecho.io</a>. We will respond to your request within 30 days. We may need to verify your identity before processing access or deletion requests.
              </p>
            </div>
          </section>

          <hr className="border-white/10" />

          {/* Section 8 */}
          <section className="space-y-4">
            <h2 className="text-xl font-black text-white uppercase tracking-wider flex items-center space-x-3">
              <span className="text-indigo-400 font-black">8.</span>
              <span>Privacy Complaints and Contact Information</span>
            </h2>
            <div className="space-y-2 text-slate-400">
              <p>
                If you have any questions about this Privacy Policy, or if you wish to make a complaint about a breach of the Australian Privacy Principles, please contact our Privacy Officer at:
              </p>
              <ul className="list-disc pl-5 my-2 space-y-1">
                <li><strong className="text-slate-200">Email:</strong> <a href="mailto:privacy@dealecho.io" className="text-indigo-400 hover:underline">privacy@dealecho.io</a></li>
                <li><strong className="text-slate-200">Address:</strong> Privacy Officer, DealEcho Pty Ltd, Sydney, NSW, Australia</li>
              </ul>
              <p>
                We take all complaints seriously and will investigate your concerns in a fair and timely manner. If you are not satisfied with our response, you have the right to contact the <strong className="text-slate-200">Office of the Australian Information Commissioner (OAIC)</strong> at <a href="https://www.oaic.gov.au" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline font-bold">www.oaic.gov.au</a>.
              </p>
            </div>
          </section>

        </div>

        {/* Footer info link */}
        <div className="mt-12 text-center text-slate-500 text-xs font-semibold">
          <p>If you have any questions regarding these Policies, contact us at <a href="mailto:privacy@dealecho.io" className="text-indigo-400 hover:underline font-bold">privacy@dealecho.io</a></p>
        </div>
      </div>
    </div>
  );
};

export default Privacy;
