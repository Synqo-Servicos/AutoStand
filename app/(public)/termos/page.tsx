import { LegalDoc } from "@/components/legal/LegalDoc";

export const metadata = { title: "Termos de Uso — AutoStand" };

/**
 * Termos de Uso do AutoStand (contrato com a concessionária contratante).
 * PLACEHOLDERS a preencher antes do deploy: [RAZÃO SOCIAL], [CNPJ],
 * [CIDADE/UF], [E-MAIL DO ENCARREGADO].
 */
export default function TermosPage() {
  return (
    <LegalDoc title="Termos de Uso" updatedAt="20 de julho de 2026">
      <section className="space-y-3">
        <h2>1. Aceitação dos termos</h2>
        <p>
          Ao criar uma conta e contratar um plano do AutoStand, você — a
          concessionária contratante, doravante &ldquo;Contratante&rdquo; —
          declara ter lido, compreendido e aceito integralmente estes Termos de
          Uso e a nossa{" "}
          <a href="/privacidade">Política de Privacidade</a>. Caso não concorde
          com qualquer condição, não conclua a contratação.
        </p>
      </section>

      <section className="space-y-3">
        <h2>2. Descrição do serviço</h2>
        <p>
          O AutoStand é uma plataforma de software como serviço (SaaS) que
          fornece à Contratante um site próprio (whitelabel) para exposição de
          veículos, um painel administrativo, presença em marketplace, funil de
          leads e ferramentas de atendimento por WhatsApp assistido. O serviço é
          fornecido por <strong>[RAZÃO SOCIAL]</strong> (&ldquo;Synqo&rdquo;),
          inscrita no CNPJ sob o nº <strong>[CNPJ]</strong>, titular da marca
          AutoStand.
        </p>
        <p>
          Podemos evoluir, adicionar ou descontinuar funcionalidades ao longo do
          tempo, buscando sempre preservar o valor essencial do serviço
          contratado.
        </p>
      </section>

      <section className="space-y-3">
        <h2>3. Cadastro e conta</h2>
        <p>
          A Contratante compromete-se a fornecer informações verídicas, completas
          e atualizadas no cadastro, incluindo seu CPF ou CNPJ. As credenciais de
          acesso são pessoais e intransferíveis; a Contratante é responsável por
          mantê-las em sigilo e por toda atividade realizada em sua conta. Na
          versão atual, cada loja possui um usuário administrador.
        </p>
      </section>

      <section className="space-y-3">
        <h2>4. Planos, pagamento e renovação</h2>
        <ul>
          <li>
            A contratação se dá por <strong>assinatura mensal recorrente</strong>,
            nos valores do plano escolhido (Básico, Pro ou Premium), exibidos no
            momento da contratação.
          </li>
          <li>
            Os pagamentos são processados pelo <strong>Mercado Pago</strong>. A
            cobrança é automática a cada ciclo mensal, no meio de pagamento
            informado.
          </li>
          <li>
            O site da Contratante entra no ar após a{" "}
            <strong>confirmação do primeiro pagamento</strong>.
          </li>
          <li>
            Em caso de falha ou atraso no pagamento, o acesso e o site poderão ser
            <strong> suspensos</strong> até a regularização.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2>5. Cancelamento</h2>
        <p>
          A Contratante pode cancelar a assinatura a qualquer momento pelo painel
          ou solicitando ao suporte. Com o cancelamento, o acesso ao painel é
          encerrado e o site sai do ar ao fim do ciclo já pago. Salvo disposição
          legal em contrário, não há reembolso proporcional do período mensal em
          curso.
        </p>
      </section>

      <section className="space-y-3">
        <h2>6. Responsabilidades da Contratante</h2>
        <ul>
          <li>
            Garantir a veracidade e a legalidade dos anúncios de veículos e demais
            conteúdos que publicar.
          </li>
          <li>
            Cumprir a legislação aplicável às suas vendas, incluindo o Código de
            Defesa do Consumidor.
          </li>
          <li>
            Em relação aos dados dos compradores/interessados (leads) que capta por
            meio da plataforma, a Contratante é a <strong>controladora</strong> desses
            dados, atuando o AutoStand como <strong>operador</strong> nos termos da
            Lei Geral de Proteção de Dados (LGPD).
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2>7. Propriedade intelectual</h2>
        <p>
          A plataforma AutoStand, seu código, design e as marcas AutoStand e Synqo
          são de titularidade da <strong>[RAZÃO SOCIAL]</strong> e não são
          licenciados à Contratante além do necessário para o uso do serviço. O
          conteúdo inserido pela Contratante (fotos, textos, dados da loja)
          permanece de sua propriedade.
        </p>
      </section>

      <section className="space-y-3">
        <h2>8. Limitação de responsabilidade</h2>
        <p>
          O serviço é fornecido no estado em que se encontra. Não garantimos
          resultados comerciais específicos, como volume de vendas ou de leads. Não
          nos responsabilizamos por indisponibilidades ou falhas decorrentes de
          serviços de terceiros (por exemplo, Mercado Pago, provedores de
          hospedagem e de infraestrutura), respondendo, nos limites da lei, apenas
          por danos diretos comprovadamente causados por nós.
        </p>
      </section>

      <section className="space-y-3">
        <h2>9. Alterações destes termos</h2>
        <p>
          Estes Termos podem ser atualizados. Alterações relevantes serão
          comunicadas por e-mail e/ou aviso na plataforma. O uso continuado do
          serviço após a vigência das mudanças representa concordância com a versão
          atualizada.
        </p>
      </section>

      <section className="space-y-3">
        <h2>10. Legislação e foro</h2>
        <p>
          Estes Termos são regidos pela legislação brasileira. Fica eleito o foro
          da comarca de <strong>[CIDADE/UF]</strong> para dirimir questões
          decorrentes deste contrato, com renúncia a qualquer outro, por mais
          privilegiado que seja.
        </p>
      </section>

      <section className="space-y-3">
        <h2>11. Contato</h2>
        <p>
          Dúvidas sobre estes Termos podem ser encaminhadas para{" "}
          <a href="mailto:[E-MAIL DO ENCARREGADO]">[E-MAIL DO ENCARREGADO]</a>.
        </p>
      </section>
    </LegalDoc>
  );
}
