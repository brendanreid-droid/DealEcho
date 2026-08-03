import React from "react";
import { useSEO } from "../src/hooks/useSEO";
import Button from "../src/components/ui/Button";

/**
 * About us.
 *
 * Copy source: content/website/about-us.md in the marketing repo, rewritten
 * against the shipped product: structured deal-mechanics reports rather than
 * free-text reviews, and the aggregate account brief that replaced the old
 * qualification-framework playbook. Every claim here should stay traceable to
 * what CreateReview collects and what CompanyProfile renders - check both before
 * changing this copy.
 */

const VALUES = [
  {
    heading: "Know how an account buys before your first call",
    body: "Every account page opens with how that buyer actually behaves: the typical cycle length, when procurement enters, how long verbal yes takes to become signature, the payment terms they push for, and how many stakeholders end up in the room. Each number carries the sample it came from, so you can see whether it is a pattern or a single bad quarter.",
  },
  {
    heading: "Reports from sellers who were actually there",
    body: "Reviews come from verified sellers reporting on deals they ran themselves, against a company we have resolved to a real entity rather than a name someone typed. Reporting is anonymous, and each seller can report on the same account once every six months, so a page reflects many deals over time rather than one loud voice.",
  },
  {
    heading: "Strengths and risks, with the evidence attached",
    body: "Patterns across those reports surface as flags: the strengths worth leaning on and the risks worth pricing in, each rated for severity. A health score and its recent trend tell you which way an account is moving, and the evidence behind every read stays one click away, so you can judge the source rather than trust a summary.",
  },
  {
    heading: "Protect the one thing you cannot get back: your time",
    body: "Enterprise cycles are long and unforgiving. Dealecho surfaces the accounts that go quiet, slip their close dates, or run a process with no named budget owner, early enough to matter. Built for fast consumption, so you get the read without adding to your research load, right when you need it: before you commit.",
  },
];

const About: React.FC = () => {
  useSEO({
    title: "About us - Dealecho",
    description:
      "Dealecho is the accountability layer enterprise selling has never had, built by verified sellers, for verified sellers.",
    keywords:
      "about Dealecho, buyer intelligence, sales intelligence, buying team accountability, seller community",
  });

  return (
    <div className="bg-slate-50 min-h-screen">
      <section className="bg-navy text-white pt-20 pb-16 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 font-mono text-2xs uppercase tracking-[0.16em] text-signal-healthy-bright mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-signal-healthy-bright animate-pulse-soft" />
            About us
          </div>
          <h1 className="font-extrabold text-4xl md:text-5xl leading-[1.06] tracking-tight mb-5">
            Buyers check vendors. Employees check employers.
            <br className="hidden sm:block" /> Renters check landlords. Sellers check nothing.
          </h1>
          <p className="text-lg text-slate-300 leading-relaxed">
            Dealecho is the accountability layer enterprise selling has never had, built by verified
            sellers, for verified sellers.
          </p>
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-6 py-16 space-y-12">
        <div className="space-y-4">
          <h2 className="font-bold text-2xl text-slate-900">Who we are</h2>
          <p className="text-slate-600 leading-relaxed">
            Dealecho is a platform where verified sellers report on the buying teams they have sold
            to, and read what other sellers found before them. Think Glassdoor, but for the accounts
            on the other side of your pipeline.
          </p>
          <p className="text-slate-600 leading-relaxed">
            After a deal closes or dies, you file a short structured report: how long the cycle ran,
            when procurement appeared, how the negotiation went, whether the buyer went quiet. It is
            anonymous, and it takes minutes rather than an essay. Those reports are aggregated into a
            picture of how that account actually buys.
          </p>
        </div>

        <div className="space-y-4">
          <h2 className="font-bold text-2xl text-slate-900">Why we exist</h2>
          <p className="text-slate-600 leading-relaxed">
            Every other side of a commercial relationship has grown an accountability layer. Buy
            software and you check G2, Capterra, or TrustRadius before you sign. Take a job and you
            check Glassdoor before you accept. Every relationship where one party holds power over
            another has ended up with a way to check them first, except one.
          </p>
          <p className="text-slate-600 leading-relaxed">
            Sellers walk into buying processes with nothing. A buying team can run an Account
            Executive through six months of demos and a security review, then go quiet with no
            explanation and no consequence. The next vendor walks in exactly as blind as the last
            one.
          </p>
          <p className="text-slate-600 leading-relaxed">
            The cost of that gap does not show up as "lost to a competitor." It shows up as deals
            that die to no decision at all. It shows up as discovery calls that never surface whether
            the person in the room can actually approve spend. It shows up as procurement processes
            that request a full proposal and then disappear. These read like sales execution
            problems. They are buying-team problems wearing a sales-execution costume.
          </p>
          <p className="text-slate-600 leading-relaxed">
            Vendors have had an accountability layer for years. Dealecho exists because it is time
            buying teams had one too.
          </p>
        </div>

        <div className="space-y-4">
          <h2 className="font-bold text-2xl text-slate-900">What we stand for</h2>
          <p className="text-slate-600 leading-relaxed">
            We are not here to say buying teams are the problem. Plenty of them run a fair, diligent
            process, and that is exactly the standard we want the rest held to. Our position is
            symmetry, not attack: if every other side of a commercial relationship gets checked, the
            side making the buying decision should too.
          </p>
          <p className="text-slate-600 leading-relaxed">
            A good buying team looks like this: a named budget owner who can confirm the spend
            actually exists, a real reason given when a deal goes quiet rather than silence, and a
            decision timeline it is willing to state and stick to. That is the bar. We built Dealecho
            to measure it, not to punish anyone for falling short of it.
          </p>
          <p className="text-slate-600 leading-relaxed">
            That cuts both ways. An account that answers quickly, keeps its close date, and pays on
            the terms it agreed shows up on Dealecho as a strength, not just an absence of
            complaints. The same reports that expose a process going nowhere are what let a good
            buying team prove it runs a clean one.
          </p>
        </div>

        <div className="space-y-6">
          <h2 className="font-bold text-2xl text-slate-900">What you get</h2>
          {VALUES.map((value) => (
            <div key={value.heading}>
              <h3 className="font-bold text-lg text-slate-900 mb-2">{value.heading}</h3>
              <p className="text-slate-600 leading-relaxed">{value.body}</p>
            </div>
          ))}
        </div>

        <div className="border-t border-slate-200 pt-10 space-y-4">
          <h2 className="font-bold text-2xl text-slate-900">
            Vendors have had a way to check buyers for years. Now sellers have one too.
          </h2>
          <p className="text-slate-600 leading-relaxed">
            See how your next account actually buys before you commit a quarter to it. Sign up and
            see what is already there before your next first meeting.
          </p>
          <div className="pt-2">
            <Button variant="primary" to="/search">Search an account</Button>
          </div>
        </div>

        <p className="text-sm text-slate-500 leading-relaxed">
          Dealecho is built and run in Australia by Dealecho Pty Ltd (ACN 700 682 346, ABN 39 700 682
          346).
        </p>
      </section>
    </div>
  );
};

export default About;
