import React from "react";
import { useSEO } from "../src/hooks/useSEO";
import Button from "../src/components/ui/Button";

const NotFound: React.FC = () => {
  useSEO({
    title: "Page not found - Dealecho",
    description: "The page you were looking for does not exist.",
  });
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-6 text-center bg-slate-50">
      <p className="font-mono text-2xs uppercase tracking-[0.16em] text-slate-400 mb-3">404</p>
      <h1 className="font-extrabold text-3xl text-slate-900 mb-2">Page not found</h1>
      <p className="text-slate-500 text-sm mb-8 max-w-sm">
        The page you were looking for does not exist or may have moved.
      </p>
      <div className="flex gap-3">
        <Button variant="primary" to="/">Back to home</Button>
        <Button variant="outline" to="/search">Search accounts</Button>
      </div>
    </div>
  );
};

export default NotFound;
