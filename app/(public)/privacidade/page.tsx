import { LegalDoc } from "@/components/legal/LegalDoc";

export const metadata = { title: "Política de Privacidade — AutoStand" };

/**
 * Política de Privacidade do AutoStand (LGPD).
 * Controladora: SYNQO SERVIÇOS LTDA, CNPJ 67.106.653/0001-20. DPO: contato.synqo@gmail.com.
 * Minuta ainda sujeita a revisão jurídica (aviso na base da página).
 */
export default function PrivacidadePage() {
  return (
    <LegalDoc title="Política de Privacidade" updatedAt="20 de julho de 2026">
      <section className="space-y-3">
        <h2>1. Quem somos (controlador)</h2>
        <p>
          A <strong>SYNQO SERVIÇOS LTDA</strong> (&ldquo;Synqo&rdquo;), CNPJ{" "}
          <strong>67.106.653/0001-20</strong>, titular da plataforma AutoStand, é a
          controladora dos dados pessoais tratados na relação com as
          concessionárias contratantes. Encarregado pelo tratamento de dados
          (DPO):{" "}
          <a href="mailto:contato.synqo@gmail.com">contato.synqo@gmail.com</a>.
        </p>
      </section>

      <section className="space-y-3">
        <h2>2. Dados que coletamos</h2>
        <ul>
          <li>
            <strong>Cadastro da loja:</strong> nome da concessionária, CPF ou CNPJ
            e o endereço do site (slug).
          </li>
          <li>
            <strong>Do administrador:</strong> nome, e-mail e senha (armazenada de
            forma cifrada, com hash).
          </li>
          <li>
            <strong>Pagamento:</strong> processado pelo Mercado Pago.{" "}
            <strong>Não armazenamos os dados do cartão</strong> — ele é tokenizado
            no seu navegador e enviado diretamente ao Mercado Pago.
          </li>
          <li>
            <strong>Uso e segurança:</strong> endereço IP e registros de acesso,
            para segurança e prevenção a abusos.
          </li>
          <li>
            <strong>Leads dos compradores:</strong> nome, telefone, e-mail e
            mensagem enviados pelos visitantes das vitrines. Nesse tratamento, o
            AutoStand atua como <strong>operador</strong>; a{" "}
            <strong>controladora</strong> é a concessionária que recebe o lead.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2>3. Finalidades e base legal</h2>
        <ul>
          <li>
            <strong>Execução do contrato</strong> (art. 7º, V, LGPD): prestar o
            serviço, criar e manter a conta e efetuar as cobranças.
          </li>
          <li>
            <strong>Consentimento</strong> (art. 7º, I): envio de comunicações não
            essenciais, quando aplicável.
          </li>
          <li>
            <strong>Legítimo interesse</strong> (art. 7º, IX): segurança da
            plataforma e prevenção a fraudes e abusos.
          </li>
          <li>
            <strong>Cumprimento de obrigação legal</strong> (art. 7º, II):
            obrigações fiscais e regulatórias.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2>4. Compartilhamento</h2>
        <p>
          Compartilhamos dados apenas com operadores essenciais à prestação do
          serviço, quais sejam: <strong>Mercado Pago</strong> (processamento de
          pagamentos), <strong>Vercel</strong> (hospedagem da aplicação),{" "}
          <strong>Neon</strong> (banco de dados), <strong>Amazon Web Services</strong>{" "}
          (armazenamento de imagens e CDN), <strong>Google</strong> (recursos de
          inteligência artificial) e o nosso provedor de e-mail. Não vendemos dados
          pessoais.
        </p>
      </section>

      <section className="space-y-3">
        <h2>5. Transferência internacional</h2>
        <p>
          Alguns dos provedores acima podem tratar dados em servidores localizados
          fora do Brasil. Nesses casos, adotamos salvaguardas contratuais para
          assegurar um nível de proteção compatível com a LGPD.
        </p>
      </section>

      <section className="space-y-3">
        <h2>6. Retenção</h2>
        <p>
          Mantemos os dados pelo tempo necessário à prestação do serviço e,
          após o encerramento da conta, pelos prazos exigidos pela legislação
          (por exemplo, fiscal), quando aplicável.
        </p>
      </section>

      <section className="space-y-3">
        <h2>7. Direitos do titular</h2>
        <p>
          Nos termos do art. 18 da LGPD, o titular pode solicitar: confirmação da
          existência de tratamento, acesso, correção, anonimização, portabilidade,
          eliminação e informação sobre compartilhamentos, além de revogar o
          consentimento. Os pedidos podem ser feitos por{" "}
          <a href="mailto:contato.synqo@gmail.com">contato.synqo@gmail.com</a>.
        </p>
      </section>

      <section className="space-y-3">
        <h2>8. Segurança</h2>
        <p>
          Adotamos medidas técnicas e organizacionais para proteger os dados,
          incluindo criptografia em trânsito (TLS), armazenamento de senhas com
          hash, controle de acesso segregado por loja (multi-tenant) e tokenização
          dos dados de cartão.
        </p>
      </section>

      <section className="space-y-3">
        <h2>9. Cookies</h2>
        <p>
          Utilizamos <strong>apenas cookies essenciais</strong> ao funcionamento da
          plataforma (por exemplo, de sessão e autenticação). Não empregamos cookies
          de rastreamento ou de publicidade de terceiros. Um aviso é exibido no seu
          primeiro acesso.
        </p>
      </section>

      <section className="space-y-3">
        <h2>10. Alterações desta política</h2>
        <p>
          Esta Política pode ser atualizada. Mudanças relevantes serão comunicadas
          por e-mail e/ou aviso na plataforma.
        </p>
      </section>

      <section className="space-y-3">
        <h2>11. Contato do encarregado</h2>
        <p>
          Para exercer direitos ou esclarecer dúvidas sobre o tratamento de dados,
          contate o nosso encarregado em{" "}
          <a href="mailto:contato.synqo@gmail.com">contato.synqo@gmail.com</a>.
        </p>
      </section>
    </LegalDoc>
  );
}
