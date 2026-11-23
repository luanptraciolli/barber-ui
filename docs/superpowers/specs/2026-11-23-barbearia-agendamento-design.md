# Sistema de Agendamento para Barbearia — Design

Data: 2026-11-23
Status: aguardando aprovação

## 1. Intenção e porquê

Uma barbearia pequena (2 barbeiros) não tem hoje nenhum processo para organizar clientes e horários. O objetivo é apresentar ao dono um sistema de agendamento online, pronto para a alta demanda de dezembro, e vendê-lo.

Modelo de negócio: o sistema fica hospedado e é mantido pelo desenvolvedor (você). O dono paga uma **implantação** e uma **mensalidade** e só acessa o sistema pelo navegador. O dono não instala nada.

Sucesso significa:
1. Uma demo bonita e funcional, que roda no celular, para a reunião de apresentação, o quanto antes.
2. O dono fecha a compra.
3. Em dezembro, os clientes marcam sozinhos e não acontece nenhum horário duplicado.

## 2. Objetivos, não-objetivos, anti-objetivos

**Objetivos (v1)**
- O cliente marca o horário sozinho por um link público (WhatsApp/Instagram), sem criar conta.
- Mostrar apenas horários realmente livres, por barbeiro.
- Painel do dono: ver a agenda, cancelar, marcar manualmente (cliente que ligou ou chegou na hora) e bloquear períodos.
- Cadastro de serviços (nome, duração, preço) e do horário de trabalho de cada barbeiro.

**Não-objetivos (ficam para depois da venda)**
- Pagamento online / sinal.
- Envio automático de mensagens no WhatsApp ou SMS, e lembretes.
- Várias barbearias no mesmo sistema (multi-tenant).
- Financeiro, comissão, estoque, fidelidade.
- Cancelamento pelo próprio cliente via link (na v1 ele cancela falando com a barbearia).

**Anti-objetivos (seria fracasso mesmo funcionando)**
- Dois clientes no mesmo horário com o mesmo barbeiro.
- Exigir que o cliente baixe app ou crie conta.
- Lento ou feio no celular, que é onde 90% dos clientes vão abrir.
- O dono precisar de treinamento para usar o painel.

## 3. Restrições

- **Prazo:** demo apresentável em ~1–2 semanas, para estar em uso antes da correria de dezembro.
- **Custo:** caber nos planos gratuitos (Vercel Hobby + Supabase Free).
  - Atenção: o Supabase Free pausa projetos após 7 dias sem uso. Com a barbearia usando todo dia isso não acontece. Para produção paga, avaliar o plano Pro.
  - Atenção: o plano Hobby da Vercel é para uso não comercial. Na entrada em produção paga, avaliar o Vercel Pro ou outra hospedagem.
- **Idioma e fuso:** tudo em português do Brasil, fuso `America/Sao_Paulo`.
- **LGPD:** coletar só nome e telefone do cliente, com aviso curto de privacidade na tela de agendamento. Os dados dos agendamentos nunca são legíveis publicamente.

## 4. Abordagens consideradas

| Abordagem | Prós | Contras |
|---|---|---|
| **1. Sistema próprio: Next.js + Supabase + Vercel** (escolhida) | Produto seu, com sua marca; banco garante zero duplicidade; login pronto; grátis; reaproveitável para outras barbearias | Mais trabalho que as outras |
| 2. Ferramenta pronta (Google Agenda, Calendly) | Pronto em um dia | Não é produto seu, o dono pode assinar sozinho e dispensar você |
| 3. Página + planilha Google | Barato | Frágil, risco de horário duplicado sob carga |

Escolhida a **1**, pelo usuário.

## 5. Decisões já tomadas (pelo usuário)

- Uma única barbearia, 2 barbeiros.
- O cliente agenda sozinho, vendo os horários disponíveis.
- O desenvolvedor hospeda e é responsável pelo sistema (implantação + mensalidade).
- Stack: Next.js + Supabase + Vercel.

## 6. Design

### 6.1 Stack
- **Next.js (App Router, TypeScript)** + **Tailwind CSS**. Mobile-first.
- **Supabase**: Postgres, Auth (e-mail + senha para o painel) e Row Level Security.
- **Vercel** para hospedagem. Demo num subdomínio `*.vercel.app`; domínio próprio é opcional depois.

### 6.2 Modelo de dados
- `barbers`: id, nome, foto (opcional), ativo.
- `services`: id, nome, duração_min, preço, ativo, ordem.
- `working_hours`: barber_id, dia_da_semana (0–6), início, fim. Permite vários intervalos por dia (ex.: 9–12 e 13–19, com almoço).
- `time_blocks`: barber_id (ou nulo = barbearia inteira), início, fim, motivo. Usado para folga, feriado, véspera de Natal.
- `appointments`: id, barber_id, service_id, cliente_nome, cliente_telefone, período (`tstzrange`), status (`confirmado` | `cancelado`), origem (`online` | `manual`), criado_em.
  - **Garantia anti-duplicidade no banco:** constraint `EXCLUDE USING gist (barber_id WITH =, período WITH &&) WHERE (status = 'confirmado')` (extensão `btree_gist`). Mesmo com dois cliques simultâneos, só um agendamento entra.
- `settings` (linha única): nome da barbearia, telefone do WhatsApp, endereço, logo, antecedência mínima, janela de agendamento.
- `profiles`: user_id, papel (`admin` = desenvolvedor, `owner` = dono).

### 6.3 Fluxo do cliente (público, sem login)
1. **Início:** nome/logo da barbearia, endereço, botão "Agendar horário".
2. **Serviço:** lista com duração e preço.
3. **Barbeiro:** os 2 barbeiros ou "Sem preferência".
4. **Dia e horário:** seletor dos próximos dias, depois a grade de horários livres.
5. **Seus dados:** nome e telefone (WhatsApp) + aviso de privacidade.
6. **Confirmado:** resumo e botão "Enviar confirmação no WhatsApp", que abre um link `wa.me` para o número da barbearia com a mensagem pronta.

Regras de horários:
- Os horários começam em intervalos de **15 min**.
- Um horário aparece se o serviço inteiro cabe dentro do expediente do barbeiro, sem cruzar bloqueio nem outro agendamento.
- Antecedência mínima de **1 h** e janela de **30 dias**, ambas configuráveis em `settings`.
- "Sem preferência": mostra a união dos horários dos barbeiros. Ao confirmar, atribui ao barbeiro livre naquele horário; se os dois estiverem livres, ao que tem menos agendamentos no dia.
- O cálculo de horários e a criação do agendamento acontecem **no servidor**, com uma função Postgres/RPC ou server action usando service role. O cliente nunca lê a tabela de agendamentos.
- Se o horário for tomado entre a escolha e a confirmação, a constraint barra e a tela mostra "Esse horário acabou de ser reservado, escolha outro" com a grade atualizada.

### 6.4 Painel do dono (`/painel`, com login)
- **Agenda:** visão do dia em duas colunas (uma por barbeiro), navegação entre dias e uma visão de semana simples. Cada card mostra horário, cliente, serviço e um botão para abrir o WhatsApp do cliente.
- **Ações:** cancelar agendamento; **novo agendamento manual** (mesmas regras de disponibilidade); **bloquear período**.
- **Configurações:** serviços (CRUD), horário de trabalho por barbeiro, dados da barbearia (nome, WhatsApp, endereço, logo).
- Papéis: `owner` e `admin` acessam tudo no painel. Contas são criadas pelo admin (seed ou dashboard do Supabase); não há cadastro público.

### 6.5 Segurança
- RLS ligado em todas as tabelas.
- Leitura pública apenas de `services`, `barbers` e `settings` ativos.
- `appointments`, `time_blocks` e `working_hours` só são lidos e editados por usuários autenticados com papel `owner` ou `admin`.
- Criação pública de agendamento só pela função do servidor, com validação: serviço ativo, horário dentro das regras e telefone em formato válido.
- Proteção básica contra spam: limitar agendamentos futuros por telefone (ex.: máx. 3).

### 6.6 Demo para a apresentação
- Seed com barbearia fictícia ("Barbearia Exemplo"), 2 barbeiros, ~5 serviços e agendamentos espalhados na semana, para a agenda parecer viva.
- Na reunião: você mostra no seu celular o link do cliente, marca um horário ao vivo e em seguida abre o painel e mostra o horário aparecendo.
- Depois da venda: trocar nome, logo, serviços, preços e horários pelos reais (é a "implantação").

## 7. Calls feitos pelo designer (revisar)

- Agendamento é **confirmado automaticamente**, sem aprovação do dono.
- Intervalo de 15 min, antecedência de 1 h, janela de 30 dias.
- Regra de atribuição do "sem preferência" (menos agendamentos no dia).
- Cliente não cancela pelo site na v1.
- Limite de 3 agendamentos futuros por telefone.
- Confirmação por botão `wa.me` (manual), não por envio automático.

## 8. Deixado para quem for implementar

- Estrutura de pastas, componentes e biblioteca de UI.
- Identidade visual da demo: escura e masculina, estilo barbearia, a definir na implementação.
- Testes: lógica de disponibilidade e anti-duplicidade **obrigatoriamente** cobertas; o resto a critério.
- Fluxo de deploy (Vercel conectado ao GitHub).
