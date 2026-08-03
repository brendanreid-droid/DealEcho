import React from "react";
import { useSEO } from "../src/hooks/useSEO";
import Button from "../src/components/ui/Button";

/**
 * About us.
 *
 * PLACEHOLDER COPY - Brendan is drafting the real thing. Everything below is
 * deliberately true and dull rather than lorem ipsum, because this page is
 * linked from the footer of a live site: if the draft lands later than the
 * deploy, a visitor should find an honest short answer, not filler.
 *
 * Replace the three sections; the layout can stay.
 */
const About: React.FC = () => {
  useSEO({
    title: "About us - Dealecho",
    description:
      "Dealecho is buyer intelligence built from real enterprise sales cycles, shared by the sellers who ran them.",
    keywords: "about Dealecho, buyer intelligence, B2B sales intelligence, seller community",
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
            Sellers deserve the same
            <br className="hidden sm:block" /> intelligence buyers have
          </h1>
          <p className="text-lg text-slate-300 leading-relaxed">
            Dealecho turns hard-won experience of enterprise sales cycles into intelligence every
            seller can use before the first call.
          </p>
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-6 py-16 space-y-10">
        <div>
          <h2 className="font-bold text-2xl text-slate-900 mb-3">Why we built it</h2>
          <p className="text-slate-600 leading-relaxed">
            Every enterprise deal teaches a seller something about how that account really buys: who
            holds the budget, how procurement behaves, how long it actually takes. That knowledge
            has always died with the deal. Dealecho collects it, verifies it, and gives it back to
            the people who need it next.
          </p>
        </div>

        <div>
          <h2 className="font-bold text-2xl text-slate-900 mb-3">How it works</h2>
          <p className="text-slate-600 leading-relaxed">
            Sellers submit reviews of the accounts they have sold into. Every review is moderated
            and anonymised before it appears, and reported back as ratings, patterns and deal
            mechanics rather than as anyone's private account of a deal.
          </p>
        </div>

        <div>
          <h2 className="font-bold text-2xl text-slate-900 mb-3">Who we are</h2>
          <p className="text-slate-600 leading-relaxed">
            Dealecho is built and run in Australia by Dealecho Pty Ltd (ACN 700 682 346, ABN 39 700
            682 346).
          </p>
        </div>

        <div className="pt-2">
          <Button variant="primary" to="/search">Search an account</Button>
        </div>
      </section>
    </div>
  );
};

export default About;
