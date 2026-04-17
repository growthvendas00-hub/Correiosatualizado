import { Shield, Lock, Eye, Server } from "lucide-react";
import { motion } from "framer-motion";

const features = [
  { icon: Lock, title: "Criptografia SSL", desc: "Todas as informações são transmitidas com criptografia de ponta a ponta." },
  { icon: Eye, title: "Privacidade garantida", desc: "Seus dados pessoais não são compartilhados com terceiros." },
  { icon: Server, title: "Servidores seguros", desc: "Infraestrutura protegida com os mais altos padrões de segurança." },
];

const SecuritySection = () => {
  return (
    <section className="py-20" style={{ background: "#f0f3f7" }}>
      <div className="container mx-auto px-4">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full" style={{ background: "linear-gradient(135deg, #2e7d5b, #236b4a)" }}>
            <Shield className="h-6 w-6" style={{ color: "#1a1a1a" }} />
          </div>
          <h2 className="text-2xl font-bold md:text-3xl font-['Plus_Jakarta_Sans']" style={{ color: "#1b2a4a" }}>Segurança dos seus dados</h2>
          <p className="mx-auto mt-3 max-w-lg" style={{ color: "#6b7c93" }}>Sua privacidade e segurança são nossa prioridade absoluta</p>
        </motion.div>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {features.map((f, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="flex gap-4 rounded-xl p-5"
              style={{ background: "#ffffff", borderLeft: "4px solid #FFD400", boxShadow: "0 2px 8px rgba(27,42,74,0.06)" }}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg" style={{ background: "linear-gradient(135deg, #2e7d5b, #236b4a)" }}>
                <f.icon className="h-5 w-5" style={{ color: "#1a1a1a" }} />
              </div>
              <div>
                <h3 className="font-semibold" style={{ color: "#1b2a4a" }}>{f.title}</h3>
                <p className="mt-1 text-sm" style={{ color: "#6b7c93" }}>{f.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default SecuritySection;
