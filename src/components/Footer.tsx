import { Monitor, HelpCircle, Briefcase, Headphones, MessageSquare, User, FileText, GraduationCap, Book, ShoppingCart } from "lucide-react";
import loggiLogo from "@/assets/correios.png"; 

const Footer = () => {
  return (
    <footer className="w-full relative overflow-hidden text-[#002d6b]" style={{ backgroundColor: "#FFD400" }}>
      {/* Background geométrico sutil no canto direito para não ficar "100% amarelo chapado" */}
      <div 
        className="absolute inset-0 z-0 pointer-events-none" 
        style={{
          background: `
            linear-gradient(105deg, transparent 65%, rgba(255, 180, 0, 0.45) 65%, rgba(255, 180, 0, 0.45) 85%, transparent 85%),
            linear-gradient(135deg, transparent 75%, rgba(255, 140, 0, 0.6) 75%)
          `
        }} 
      />

      <div className="relative z-10 mx-auto max-w-6xl px-4 py-8 flex flex-col items-center">
        <div className="flex items-center justify-center gap-6 mb-5">
          <img src={loggiLogo} alt="Correios" className="h-[22px] w-auto" />
          
          {/* Reprodução do logo do Governo em puro CSS/Texto para maior similaridade */}
          <div className="font-black text-[#002d6b] text-xl leading-none tracking-tighter flex flex-col items-start border-l-2 border-[#002d6b] pl-5">
             <span className="text-[9px] tracking-widest font-bold">GOVERNO DO</span>
             <span className="flex items-center">BR<span className="text-[#00a859]">A</span>S<span className="text-[#ffcc29]">I</span>L</span>
          </div>
        </div>
        
        <div className="text-center text-[11px] opacity-80 space-y-1 font-medium text-[#002d6b]">
          <p>© Copyright 2026 Correios</p>
          <p>Nacional Construtora LTDA • CNPJ 11.075.076/0001-00</p>
          <p className="text-[9px] opacity-70">Sala 506 Bloco Torre 1 Cond Hc Plaza - Natal - RN</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
