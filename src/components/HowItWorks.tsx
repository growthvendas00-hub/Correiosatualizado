import { Search, ShieldCheck, FileCheck } from "lucide-react";
import { motion } from "framer-motion";

const steps = [
  { icon: Search, title: "Rastreamento", description: "Consulte o status da sua encomenda em tempo real" },
  { icon: ShieldCheck, title: "Segurança", description: "Dados protegidos pela Receita Federal" },
  { icon: FileCheck, title: "Regularização", description: "Pendências devem ser regularizadas para liberação" },
];

const HowItWorks = () => {
  return (
    <section className="py-20" style={{ background: "#e8edf2" }}>
      <div className="container mx-auto px-4">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center">
          <h2 className="text-2xl font-bold md:text-3xl font-['Plus_Jakarta_Sans']" style={{ color: "#1b2a4a" }}>Como funciona o atendimento</h2>
          <p className="mx-auto mt-3 max-w-lg" style={{ color: "#6b7c93" }}>Processo simples e rápido em apenas 3 etapas</p>
        </motion.div>

        <div className="mt-14 grid grid-cols-3 gap-4 md:gap-8">
          {steps.map((step, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.15 }}
              className="rounded-xl p-6 text-center transition-all duration-300 hover:-translate-y-1"
              style={{ background: "#ffffff", borderTop: "3px solid #FFD400", boxShadow: "0 2px 8px rgba(27,42,74,0.06)" }}
            >
              <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-xl" style={{ background: "linear-gradient(135deg, #2e7d5b, #236b4a)" }}>
                <step.icon className="h-6 w-6" style={{ color: "#1a1a1a" }} />
              </div>
              <h3 className="text-lg font-bold" style={{ color: "#1b2a4a" }}>{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed" style={{ color: "#6b7c93" }}>{step.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
