import type { ReactNode } from "react";

export default function PoliticaDePrivacidade() {
  return (
    <main className="mx-auto min-h-screen max-w-2xl bg-paper px-6 py-16 text-ink md:py-24">
      <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">
        Política de Privacidade
      </h1>
      <p className="mt-1 text-[13px] text-muted">Gatilho</p>

      <p className="mt-8 text-[13px] font-semibold text-ink-soft">
        Última atualização: 8 de setembro de 2026
      </p>

      <div className="mt-6 space-y-4 text-[15px] leading-relaxed text-ink-soft">
        <p>
          Esta Política de Privacidade descreve como o Gatilho coleta,
          utiliza, armazena e protege informações relacionadas aos usuários
          e às contas de redes sociais conectadas ao serviço.
        </p>

        <p>
          O Gatilho é uma plataforma de automação para contas profissionais
          do Instagram, permitindo configurar fluxos de interação
          relacionados a comentários e mensagens.
        </p>
      </div>

      <Section title="1. Dados que podemos coletar">
        <p>
          Dependendo das funcionalidades utilizadas, o Gatilho poderá
          receber e processar dados disponibilizados pelas plataformas da
          Meta, incluindo:
        </p>
        <List
          items={[
            "Informações básicas da conta profissional do Instagram conectada.",
            "Nome de usuário e identificadores da conta.",
            "Informações relacionadas a comentários recebidos.",
            "Conteúdo de mensagens enviadas à conta conectada.",
            "Identificadores necessários para associar eventos à conta.",
            "Informações relacionadas às automações configuradas.",
            "Registros técnicos necessários para funcionamento e segurança.",
          ]}
        />
        <p>
          O Gatilho não solicita nem armazena senhas do Instagram ou do
          Facebook.
        </p>
      </Section>

      <Section title="2. Como utilizamos os dados">
        <p>
          Os dados recebidos são utilizados para fornecer as
          funcionalidades do Gatilho, incluindo:
        </p>
        <List
          items={[
            "Conectar e identificar uma conta profissional do Instagram.",
            "Receber e processar eventos de comentários.",
            "Identificar palavras-chave configuradas pelo usuário.",
            "Processar mensagens recebidas pela conta conectada.",
            "Executar automações configuradas pelo proprietário da conta.",
            "Apresentar eventos e informações no painel do serviço.",
            "Manter a segurança e estabilidade da plataforma.",
            "Diagnosticar erros e melhorar a confiabilidade do serviço.",
          ]}
        />
        <p>O Gatilho não vende dados pessoais dos usuários.</p>
      </Section>

      <Section title="3. Dados do Instagram e da Meta">
        <p>
          Quando o usuário conecta uma conta profissional do Instagram, o
          Gatilho poderá receber dados disponibilizados pela Meta por meio
          das APIs e permissões autorizadas pelo usuário.
        </p>
        <p>
          Esses dados são utilizados somente para as finalidades
          necessárias para fornecer as funcionalidades solicitadas.
        </p>
      </Section>

      <Section title="4. Armazenamento e segurança">
        <p>
          Os dados podem ser armazenados em serviços de infraestrutura,
          hospedagem, banco de dados e outros provedores tecnológicos
          utilizados para operar o Gatilho.
        </p>
        <p>
          Adotamos medidas técnicas e organizacionais razoáveis para
          proteger os dados contra acesso não autorizado, alteração,
          divulgação ou destruição.
        </p>
      </Section>

      <Section title="5. Compartilhamento de dados">
        <p>
          O Gatilho poderá utilizar provedores de infraestrutura,
          hospedagem, banco de dados e outros serviços técnicos necessários
          para disponibilizar a plataforma.
        </p>
        <p>
          Esses provedores somente terão acesso aos dados necessários para
          prestar os serviços correspondentes.
        </p>
        <p>
          Não vendemos ou comercializamos dados pessoais recebidos através
          do Instagram ou de outras plataformas da Meta.
        </p>
      </Section>

      <Section title="6. Retenção de dados">
        <p>
          Os dados são mantidos pelo período necessário para fornecer as
          funcionalidades do Gatilho, cumprir obrigações legais, resolver
          disputas, prevenir abusos e manter a segurança da plataforma.
        </p>
      </Section>

      <Section title="7. Exclusão dos dados">
        <p>
          O usuário pode solicitar a exclusão dos dados associados à sua
          conta e à utilização do Gatilho.
        </p>
        <p>
          Para solicitar a exclusão, entre em contato pelo endereço de
          e-mail disponibilizado na seção de contato desta política.
        </p>
        <p>
          Após receber uma solicitação válida, analisaremos o pedido e
          excluiremos os dados que não precisem ser mantidos por obrigação
          legal ou outra finalidade legítima aplicável.
        </p>
        <p>
          A desconexão da conta do Instagram também poderá interromper o
          recebimento de novos dados através da integração.
        </p>
      </Section>

      <Section title="8. Direitos dos usuários">
        <p>
          Dependendo da legislação aplicável, os usuários poderão solicitar
          informações sobre os dados tratados, correção de informações
          incorretas, exclusão de dados e outras medidas relacionadas à
          proteção de seus dados pessoais.
        </p>
      </Section>

      <Section title="9. Cookies e tecnologias semelhantes">
        <p>
          O Gatilho poderá utilizar cookies, armazenamento local e
          tecnologias semelhantes para manter sessões, autenticar usuários,
          garantir o funcionamento da plataforma e melhorar a segurança do
          serviço.
        </p>
      </Section>

      <Section title="10. Alterações nesta Política">
        <p>
          Esta Política de Privacidade poderá ser atualizada periodicamente
          para refletir alterações no Gatilho, nas funcionalidades
          oferecidas ou nas exigências legais.
        </p>
      </Section>

      <Section title="11. Contato">
        <p>
          Para dúvidas, solicitações relacionadas à privacidade ou pedidos
          de exclusão de dados, entre em contato:
        </p>
        <p>
          <strong className="font-semibold text-ink">E-mail:</strong>{" "}
          SEU_EMAIL_AQUI
        </p>
        <p>
          <strong className="font-semibold text-ink">Aplicativo:</strong>{" "}
          Gatilho
          <br />
          <strong className="font-semibold text-ink">Website:</strong>{" "}
          https://gatilhobacon.vercel.app/
        </p>
      </Section>

      <div className="mt-12 border-t border-line pt-6 text-[13px] text-muted">
        Esta Política de Privacidade entra em vigor em 8 de setembro de
        2026.
      </div>
    </main>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="mt-10 border-t border-line pt-8">
      <h2 className="text-lg font-bold tracking-tight">{title}</h2>
      <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-ink-soft">
        {children}
      </div>
    </section>
  );
}

function List({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2 border-l border-line pl-4">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}
