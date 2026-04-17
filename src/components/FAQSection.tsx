import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { motion } from "framer-motion";

const faqs = [
  { q: "Como rastrear meu pedido?", a: "Insira seu CPF ou código de rastreio no campo de consulta na parte superior da página. O sistema exibirá o status atualizado do seu envio." },
  { q: "O que fazer se meu pedido está atrasado?", a: "Verifique o status da entrega pelo código de rastreio. Caso haja pendências, o sistema indicará as ações necessárias para regularização." },
  { q: "Posso alterar o endereço de entrega?", a: "Sim, dependendo do status atual do envio. Acesse a consulta do pedido e verifique se a opção de alteração de endereço está disponível." },
  { q: "Quanto tempo leva para atualizar o rastreamento?", a: "As informações de rastreamento são atualizadas em tempo real conforme o envio passa pelos centros de distribuição." },
  { q: "Como entro em contato com o suporte?", a: "Utilize o formulário de contato ou envie um e-mail para atendimento@sistema.gov.br." },
];

const FAQSection = () => {
  return (
    <section className="py-20" style={{ background: "#e8edf2" }}>
      <div className="container mx-auto px-4">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center">
          <h2 className="text-2xl font-bold md:text-3xl font-['Plus_Jakarta_Sans']" style={{ color: "#1b2a4a" }}>Perguntas Frequentes</h2>
          <p className="mx-auto mt-3 max-w-lg" style={{ color: "#6b7c93" }}>Tire suas dúvidas sobre nossos serviços</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.15 }} className="mx-auto mt-12 max-w-2xl">
          <Accordion type="single" collapsible className="space-y-3">
            {faqs.map((faq, i) => (
              <AccordionItem
                key={i}
                value={`item-${i}`}
                className="rounded-xl overflow-hidden border-0"
                style={{ background: "#ffffff", boxShadow: "0 2px 8px rgba(27,42,74,0.06)" }}
              >
                <AccordionTrigger className="px-5 py-4 text-left font-semibold hover:no-underline" style={{ color: "#1b2a4a" }}>
                  {faq.q}
                </AccordionTrigger>
                <AccordionContent className="px-5 pb-4" style={{ color: "#6b7c93" }}>
                  {faq.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </motion.div>
      </div>
    </section>
  );
};

export default FAQSection;
