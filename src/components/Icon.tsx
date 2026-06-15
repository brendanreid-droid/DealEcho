import React from "react";
import {
  ArrowLeft, ArrowRight, Ban, Menu, Bookmark, Building2, Target, Calendar,
  LineChart, PieChart, Check, CheckCircle2, ChevronDown, ChevronRight, Clock,
  MessageSquare, MessagesSquare, Crown, Database, DollarSign, Pencil,
  MailOpen, AlertCircle, AlertTriangle, Eye, EyeOff, Filter, Fingerprint,
  Ghost, Gift, Globe, Handshake, History, Info, Link2, Lock, Sparkles, Map,
  Send, PenLine, Plus, PlusCircle, Save, Search, SearchX, Shield, LogOut,
  Star, Tag, X, XCircle, Trash2, Trophy, Unlock, User, UserCheck, UserCircle,
  UserPlus, UserCog, Users, LucideIcon,
} from "lucide-react";

/**
 * Icon shim — maps the Font Awesome class names the app already uses to
 * lucide-react components. This lets us delete the Font Awesome CDN <link>
 * without rewriting all 200+ icon usages by hand. Existing markup like:
 *     <i className="fas fa-search"></i>
 * becomes:
 *     <Icon name="fa-search" />
 * (a mechanical find/replace) and keeps working.
 *
 * Unmapped names render nothing (and warn in dev) rather than crash.
 */
const MAP: Record<string, LucideIcon> = {
  "fa-arrow-left": ArrowLeft,
  "fa-arrow-right": ArrowRight,
  "fa-ban": Ban,
  "fa-bars": Menu,
  "fa-bookmark": Bookmark,
  "fa-building": Building2,
  "fa-bullseye": Target,
  "fa-calendar": Calendar,
  "fa-chart-line": LineChart,
  "fa-chart-pie": PieChart,
  "fa-check": Check,
  "fa-check-circle": CheckCircle2,
  "fa-chevron-down": ChevronDown,
  "fa-chevron-right": ChevronRight,
  "fa-clock": Clock,
  "fa-comment-alt": MessageSquare,
  "fa-comments": MessagesSquare,
  "fa-crown": Crown,
  "fa-database": Database,
  "fa-dollar-sign": DollarSign,
  "fa-edit": Pencil,
  "fa-pen": Pencil,
  "fa-pen-nib": PenLine,
  "fa-envelope-open-text": MailOpen,
  "fa-exclamation-circle": AlertCircle,
  "fa-exclamation-triangle": AlertTriangle,
  "fa-eye": Eye,
  "fa-eye-slash": EyeOff,
  "fa-filter": Filter,
  "fa-fingerprint": Fingerprint,
  "fa-ghost": Ghost,
  "fa-gift": Gift,
  "fa-globe": Globe,
  "fa-handshake": Handshake,
  "fa-handshake-simple": Handshake,
  "fa-history": History,
  "fa-info-circle": Info,
  "fa-link": Link2,
  "fa-lock": Lock,
  "fa-magic": Sparkles,
  "fa-map": Map,
  "fa-paper-plane": Send,
  "fa-plus": Plus,
  "fa-plus-circle": PlusCircle,
  "fa-save": Save,
  "fa-search": Search,
  "fa-search-minus": SearchX,
  "fa-shield-alt": Shield,
  "fa-sign-out-alt": LogOut,
  "fa-star": Star,
  "fa-tags": Tag,
  "fa-times": X,
  "fa-times-circle": XCircle,
  "fa-trash": Trash2,
  "fa-trash-alt": Trash2,
  "fa-trophy": Trophy,
  "fa-unlock": Unlock,
  "fa-user": User,
  "fa-user-check": UserCheck,
  "fa-user-circle": UserCircle,
  "fa-user-plus": UserPlus,
  "fa-user-shield": UserCog,
  "fa-users": Users,
};

interface IconProps {
  name: string; // e.g. "fa-search" (the "fas"/"far" prefix is ignored)
  className?: string;
  size?: number;
  strokeWidth?: number;
}

const Icon: React.FC<IconProps> = ({
  name,
  className = "",
  size = 16,
  strokeWidth = 2,
}) => {
  // Tolerate "fas fa-search" or "fa-search"
  const key = name.split(/\s+/).find((p) => p.startsWith("fa-")) ?? name;
  const Cmp = MAP[key];
  if (!Cmp) {
    if (typeof process !== "undefined" && process.env?.NODE_ENV !== "production") {
      console.warn(`[Icon] No lucide mapping for "${key}"`);
    }
    return null;
  }
  return <Cmp className={className} size={size} strokeWidth={strokeWidth} aria-hidden />;
};

export default Icon;
