import { Search } from "lucide-react";

const Header = () => {
  return (
    <header className="sticky top-0 z-50" style={{ background: "#1b2a4a", borderBottom: "3px solid #2c3e6b" }}>
      <div className="container mx-auto flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded" style={{ background: "#FFD400" }}>
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="#ffffff" strokeWidth="2.5">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <span className="text-sm font-bold" style={{ color: "#1a1a1a" }}>Receita Federal</span>
        </div>
        <div className="text-right">
          <div className="text-xs font-semibold" style={{ color: "#1a1a1a" }}>Sistema Integrado</div>
          <div className="flex items-center justify-end gap-1.5 text-xs" style={{ color: "rgba(0,0,0,0.7)" }}>
            <span className="dot-online" />
            <span>Online • Seguro</span>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
