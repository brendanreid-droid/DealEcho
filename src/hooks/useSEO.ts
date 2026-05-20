import { useEffect } from "react";

interface OpenGraphMetadata {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  type?: string;
}

interface SEOMetadata {
  title: string;
  description?: string;
  keywords?: string;
  openGraph?: OpenGraphMetadata;
  schema?: Record<string, any>;
}

export const useSEO = ({
  title,
  description,
  keywords,
  openGraph,
  schema,
}: SEOMetadata) => {
  useEffect(() => {
    // 1. Update document title
    if (title) {
      document.title = title;
    }

    // Helper to get or create a meta tag in document head
    const setMetaTag = (attrName: string, attrVal: string, content: string) => {
      let element = document.querySelector(`meta[${attrName}="${attrVal}"]`);
      if (!element) {
        element = document.createElement("meta");
        element.setAttribute(attrName, attrVal);
        document.head.appendChild(element);
      }
      element.setAttribute("content", content);
    };

    // 2. Set description
    if (description) {
      setMetaTag("name", "description", description);
    }

    // 3. Set keywords
    if (keywords) {
      setMetaTag("name", "keywords", keywords);
    }

    // 4. Set Open Graph tags for social/professional networking previews
    if (openGraph) {
      if (openGraph.title || title) {
        setMetaTag("property", "og:title", openGraph.title || title);
      }
      if (openGraph.description || description) {
        setMetaTag("property", "og:description", openGraph.description || description);
      }
      if (openGraph.image) {
        setMetaTag("property", "og:image", openGraph.image);
      }
      if (openGraph.url) {
        setMetaTag("property", "og:url", openGraph.url);
      }
      setMetaTag("property", "og:type", openGraph.type || "website");
    } else {
      setMetaTag("property", "og:title", title);
      if (description) {
        setMetaTag("property", "og:description", description);
      }
    }

    // 5. Inject Structured JSON-LD Schema (Organization, Reviews, etc.)
    const SCHEMA_SCRIPT_ID = "dealecho-ld-json-schema";
    
    // Remove existing schema script to prevent duplicates
    const existingSchema = document.getElementById(SCHEMA_SCRIPT_ID);
    if (existingSchema) {
      existingSchema.remove();
    }

    if (schema) {
      const script = document.createElement("script");
      script.id = SCHEMA_SCRIPT_ID;
      script.type = "application/ld+json";
      script.innerHTML = JSON.stringify(schema);
      document.head.appendChild(script);
    }

    // Cleanup script on unmount to keep head element clean
    return () => {
      const activeSchema = document.getElementById(SCHEMA_SCRIPT_ID);
      if (activeSchema) {
        activeSchema.remove();
      }
    };
  }, [title, description, keywords, JSON.stringify(openGraph), JSON.stringify(schema)]);
};
