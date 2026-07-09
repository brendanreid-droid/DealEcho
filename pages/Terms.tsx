import React from "react";
import { Link } from "react-router-dom";
import Icon from "../src/components/Icon";

const Terms: React.FC = () => {
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
            Terms of Use
          </h1>
          <p className="text-slate-400 text-sm font-medium">
            Last Updated: <span className="text-indigo-400 font-bold">May 22, 2026</span>
          </p>
        </div>

        {/* Terms Container */}
        <div className="bg-white/5 border border-white/10 backdrop-blur-3xl rounded-[32px] p-8 md:p-12 shadow-2xl space-y-10 leading-relaxed text-sm md:text-base font-normal">
          
          {/* Welcome Message */}
          <p className="text-slate-300 italic border-l-4 border-indigo-500 pl-4 py-1">
            Welcome to Dealecho.io (the "Services"). These Terms of Use ("Terms") constitute a legally binding agreement between you and Dealecho (ABN 92 122 197 793) trading as Dealecho.io ("Dealecho", "we", "us", or "our") governing your access to and use of our website, mobile application, database, and any related intelligence tools.
          </p>

          <hr className="border-white/10" />

          {/* Section 1 */}
          <section className="space-y-4">
            <h2 className="text-xl font-black text-white uppercase tracking-wider flex items-center space-x-3">
              <span className="text-indigo-400 font-black">1.</span>
              <span>Eligibility, Account Safeguards and Commercial Scope</span>
            </h2>
            <div className="space-y-4 text-slate-400">
              <div>
                <h3 className="font-bold text-slate-200 mb-1">1.1 Eligibility and Authorized Use</h3>
                <p>
                  To access or use the Services, you must be at least 18 years of age and not prohibited from doing so by applicable law. The Services are provided for your personal use or for your internal business intelligence purposes (such as researching employers, market rates, or workplace metrics). You may not use the Services for external commercial exploitation, resale, or if we have previously terminated your account for a material breach of these Terms.
                </p>
              </div>
              <div>
                <h3 className="font-bold text-slate-200 mb-1">1.2 Account Registration and Personal Data</h3>
                <p>
                  You must create an account and provide certain accurate personal data to access most of our Services. You agree to keep this information accurate and up-to-date at all times. All personal data provided to us will be handled in accordance with our Privacy Policy and the Privacy Act 1988 (Cth).
                </p>
              </div>
              <div>
                <h3 className="font-bold text-slate-200 mb-1">1.3 Safeguarding and Responsibility</h3>
                <p>
                  You are responsible for maintaining the confidentiality of your account details (including your password) and for taking reasonable steps to prevent unauthorized access. You must notify us immediately at <a href="mailto:security@dealecho.io" className="text-indigo-400 hover:underline">security@dealecho.io</a> if you suspect or become aware of any unauthorized use of your account.
                </p>
              </div>
            </div>
          </section>

          <hr className="border-white/10" />

          {/* Section 2 */}
          <section className="space-y-4">
            <h2 className="text-xl font-black text-white uppercase tracking-wider flex items-center space-x-3">
              <span className="text-indigo-400 font-black">2.</span>
              <span>Communications</span>
            </h2>
            <div className="space-y-4 text-slate-400">
              <div>
                <h3 className="font-bold text-slate-200 mb-1">2.1 Agreement to Receive Communications</h3>
                <p>
                  By creating an account, you agree to receive communications from Dealecho. These communications may include service-related notifications, security updates, and marketing or educational insights.
                </p>
              </div>
              <div>
                <h3 className="font-bold text-slate-200 mb-1">2.2 Unsubscribing and Preferences</h3>
                <p>
                  To unsubscribe from marketing or non-service-related emails, please use the "unsubscribe" link provided in the communication or update your account preferences panel. If you unsubscribe from a specific communication channel (e.g., a specific company alert), you will continue to receive other categories of operational communications.
                </p>
              </div>
              <div>
                <h3 className="font-bold text-slate-200 mb-1">2.3 Mandatory Service Communications</h3>
                <p>
                  Unless you choose to delete your account entirely, you cannot unsubscribe from operational communications that are essential to your administration of the account or are required by law (e.g., security alerts, billing notices, or updates to these Terms). All communications will be conducted strictly in accordance with the Spam Act 2003 (Cth) and our Privacy Policy.
                </p>
              </div>
            </div>
          </section>

          <hr className="border-white/10" />

          {/* Section 3 */}
          <section className="space-y-4">
            <h2 className="text-xl font-black text-white uppercase tracking-wider flex items-center space-x-3">
              <span className="text-indigo-400 font-black">3.</span>
              <span>Intellectual Property and Content Rights</span>
            </h2>
            <div className="space-y-4 text-slate-400">
              <div>
                <h3 className="font-bold text-slate-200 mb-1">3.1 Rights to Your Content</h3>
                <p>
                  You retain ownership of any content, text, data, ratings, or reviews you submit or authorize for use on the Services (“Your Content”).
                </p>
                <p className="mt-2">
                  By submitting Your Content, you grant Dealecho a worldwide, irrevocable, perpetual, non-exclusive, royalty-free license to use, reproduce, copy, process, modify, publish, translate, transmit, display, and distribute Your Content in connection with the operation, promotion, development, and improvement of the Services. This includes the right to display your profile name or avatar associated with the content.
                </p>
                <p className="mt-2">
                  To the extent permitted under Part IX of the Copyright Act 1968 (Cth), you genuinely consent to Dealecho performing any acts or omissions in relation to Your Content that might otherwise infringe your moral rights, provided such acts are reasonably necessary for the operational integrity, formatting, or presentation of the platform.
                </p>
              </div>
              <div>
                <h3 className="font-bold text-slate-200 mb-1">3.2 Feedback and Submissions</h3>
                <p>
                  If you submit ideas, suggestions, or proposals (“Submissions”) to Dealecho, you agree that we may use, disclose, and exploit these Submissions to improve our platform without any obligation of confidentiality or financial compensation to you.
                </p>
              </div>
              <div>
                <h3 className="font-bold text-slate-200 mb-1">3.3 Your Limited Rights to Content</h3>
                <p>
                  Excluding Your Content, Dealecho and its licensors retain all proprietary and intellectual property rights in the platform, design, data aggregation models, and platform content. Subject to your compliance with these Terms, we grant you a limited, revocable, non-transferable, non-sublicensable license to access and use the platform content solely for your personal or internal business use.
                </p>
                <p className="mt-2">
                  You must not systematically scrape, mine, reproduce, redistribute, or sell access to the platform content without our express prior written consent.
                </p>
              </div>
              <div>
                <h3 className="font-bold text-slate-200 mb-1">3.4 Content Accuracy Disclaimer</h3>
                <p>
                  The platform displays crowdsourced reviews, ratings, and third-party sponsored content. While we implement moderation guidelines, Dealecho does not independently verify, endorse, or guarantee the absolute accuracy, currency, or suitability of user-generated content or analytical scores. You should exercise independent judgment when relying on platform data for career or commercial decisions.
                </p>
              </div>
            </div>
          </section>

          <hr className="border-white/10" />

          {/* Section 4 */}
          <section className="space-y-4">
            <h2 className="text-xl font-black text-white uppercase tracking-wider flex items-center space-x-3">
              <span className="text-indigo-400 font-black">4.</span>
              <span>House Rules and Account Management Actions</span>
            </h2>
            <div className="space-y-4 text-slate-400">
              <div>
                <h3 className="font-bold text-slate-200 mb-1">4.1 House Rules and Community Guidelines</h3>
                <p>
                  You warrant that your use of the Services will be lawful and compliant with our Community Guidelines. If you post reviews regarding an employer, company, or staffing firm, you warrant that your content reflects your honest, authentic experience as a full-time, part-time, casual employee, contractor, or freelancer.
                </p>
                <p className="mt-2">
                  If you use the platform to run a promotion or competition, you are solely responsible for ensuring compliance with all state-based trade promotion lottery laws in Australia and must explicitly state that the promotion is not sponsored by Dealecho.
                </p>
              </div>
              <div>
                <h3 className="font-bold text-slate-200 mb-1">4.2 Prohibited Activities</h3>
                <p>You agree that you will not:</p>
                <ul className="list-disc pl-5 mt-2 space-y-2">
                  <li>Impersonate any person or misrepresent your current or former professional affiliations.</li>
                  <li>Submit content that is defamatory, intentionally misleading, fraudulent, or breaches a legally binding non-disclosure agreement (NDA) or confidentiality duty owed to a third party.</li>
                  <li>Engage in harassing, abusive, or discriminatory behavior within platform communities.</li>
                  <li>Engage in anticompetitive conduct or violate Australian competition laws by sharing commercially sensitive pricing information in restraint of trade.</li>
                  <li>Introduce automated scrapers, bots, viruses, trojans, or malicious software to the platform.</li>
                  <li>Engage in illegal pyramidal scheme promotion in violation of the Australian Consumer Law.</li>
                </ul>
              </div>
              <div>
                <h3 className="font-bold text-slate-200 mb-1">4.3 Account Management and Suspension</h3>
                <p>
                  <strong>For Material Breach or Security Risks:</strong> Dealecho may immediately and without notice suspend or restrict your account if we reasonably believe you have materially breached these Terms, violated our Community Guidelines (such as fraudulent review manipulation), introduced a security threat, or if we are required to do so by law.
                </p>
                <p className="mt-2">
                  <strong>For Convenience / Non-Urgent Actions:</strong> If we wish to discontinue a feature or terminate your account for administrative convenience, we will provide you with at least 30 days' written notice prior to taking action, allowing you a reasonable opportunity to extract Your Content.
                </p>
              </div>
            </div>
          </section>

          <hr className="border-white/10" />

          {/* Section 5 */}
          <section className="space-y-4">
            <h2 className="text-xl font-black text-white uppercase tracking-wider flex items-center space-x-3">
              <span className="text-indigo-400 font-black">5.</span>
              <span>Consumer Guarantees, Warranties, and Limitation of Liability</span>
            </h2>
            <div className="space-y-4 text-slate-400">
              <div>
                <h3 className="font-bold text-slate-200 mb-1">5.1 Australian Consumer Law (ACL) Safeguards</h3>
                <p className="text-slate-200 bg-white/5 border border-white/5 rounded-2xl p-4 italic">
                  Our services come with statutory guarantees that cannot be excluded, restricted, or modified under Schedule 2 of the Competition and Consumer Act 2010 (Cth) ("Australian Consumer Law"). These include guarantees that our services will be provided with due care and skill, be fit for purpose, and be supplied within a reasonable time. Nothing in these Terms operates to exclude, restrict, or modify those non-excludable consumer protections.
                </p>
              </div>
              <div>
                <h3 className="font-bold text-slate-200 mb-1">5.2 Limitation of Liability</h3>
                <p>Subject always to Section 5.1 (ACL Safeguards) and to the maximum extent permitted by law:</p>
                <ul className="list-disc pl-5 mt-2 space-y-2">
                  <li>
                    <strong>Exclusion of Consequential Loss:</strong> Neither party will be liable to the other for any indirect, consequential, special, exemplary, or punitive damages, including loss of profits, lost revenue, or loss of commercial business opportunities arising out of or in connection with these Terms.
                  </li>
                  <li>
                    <strong>Cap on General Liability:</strong> To the extent permitted by law, each party's maximum aggregate liability to the other for all claims arising under or in connection with these Terms (whether in contract, tort including negligence, or under indemnity) is strictly limited to the greater of: (a) the total fees paid by you to Dealecho in the 12 months preceding the event giving rise to liability, or (b) $100 AUD.
                  </li>
                  <li>
                    <strong>Statutory Remedy Limitations:</strong> Where Dealecho breaches a statutory guarantee under the ACL which can legally be limited under Section 64A of the ACL, our liability is strictly limited (at our option) to supplying the services again, or paying the reasonable cost of having the services supplied again.
                  </li>
                  <li>
                    <strong>Carve-outs:</strong> The limitations and exclusions of liability in this Section 5.2 do not apply to a party's liability for fraud, willful misconduct, gross negligence, personal injury, or a breach of third-party intellectual property rights.
                  </li>
                </ul>
              </div>
            </div>
          </section>

          <hr className="border-white/10" />

          {/* Section 6 */}
          <section className="space-y-4">
            <h2 className="text-xl font-black text-white uppercase tracking-wider flex items-center space-x-3">
              <span className="text-indigo-400 font-black">6.</span>
              <span>Indemnity</span>
            </h2>
            <div className="space-y-2 text-slate-400">
              <p>
                You agree to indemnify and hold harmless Dealecho, its directors, and employees from and against any direct loss, damage, liability, or reasonable legal expense arising out of a third-party claim against us resulting from:
              </p>
              <ul className="list-disc pl-5 my-2 space-y-1">
                <li>Your Content infringing the intellectual property, privacy, or moral rights of a third party; or</li>
                <li>Your material breach of the Prohibited Activities outlined in Section 4.2.</li>
              </ul>
              <p>
                Your liability under this indemnity will be proportionally reduced to the extent that Dealecho’s own negligent acts, omissions, or platform vulnerabilities contributed to the loss.
              </p>
            </div>
          </section>

          <hr className="border-white/10" />

          {/* Section 7 */}
          <section className="space-y-4">
            <h2 className="text-xl font-black text-white uppercase tracking-wider flex items-center space-x-3">
              <span className="text-indigo-400 font-black">7.</span>
              <span>Miscellaneous</span>
            </h2>
            <div className="space-y-4 text-slate-400">
              <div>
                <h3 className="font-bold text-slate-200 mb-1">7.1 Dispute Resolution</h3>
                <p>
                  In the event of any dispute arising out of or relating to these Terms, the parties agree to first attempt to resolve the issue informally. You must notify us of the dispute in writing. Within 14 days of the notice, authorized representatives from both sides must meet (virtually or in person) in good faith to seek a resolution before commencing formal tribunal or court proceedings.
                </p>
              </div>
              <div>
                <h3 className="font-bold text-slate-200 mb-1">7.2 Governing Law and Jurisdiction</h3>
                <p>
                  These Terms are governed by and construed in accordance with the laws of the State of New South Wales, Australia. Both parties irrevocably submit to the non-exclusive jurisdiction of the courts of New South Wales and any courts competent to hear appeals from them.
                </p>
              </div>
              <div>
                <h3 className="font-bold text-slate-200 mb-1">7.3 Severability</h3>
                <p>
                  If any provision of these Terms is held to be invalid, illegal, or unenforceable by a court of competent jurisdiction, that provision will be severed or modified to the minimum extent necessary to make it valid and enforceable, and the remaining provisions will continue in full force and effect.
                </p>
              </div>
            </div>
          </section>

        </div>

        {/* Footer info link */}
        <div className="mt-12 text-center text-slate-500 text-xs font-semibold">
          <p>If you have any questions regarding these Terms, contact us at <a href="mailto:terms@dealecho.io" className="text-indigo-400 hover:underline font-bold">terms@dealecho.io</a></p>
        </div>
      </div>
    </div>
  );
};

export default Terms;
