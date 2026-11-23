# Roteiro da apresentação (5 minutos)

**Antes da reunião (na véspera):**
- Rodar `supabase/seed.sql` de novo, para a agenda de demonstração ficar cheia nos próximos dias.
- Abrir o painel no seu celular e deixar logado.
- Ter o link do site à mão para mandar no WhatsApp dele.

## 1. O problema dele (1 min)
"Em dezembro o WhatsApp não para. Quanto tempo por dia você gasta respondendo 'tem horário amanhã?'"

## 2. Ele mesmo marca um horário (2 min)
- Mande o link no WhatsApp **dele** e peça para ele abrir.
- Ele escolhe o serviço, o barbeiro, o dia e o horário, e informa o nome dele.
- Na tela final, ele toca em "Enviar confirmação no WhatsApp" e a mensagem chega pronta no número da barbearia.
- Ponto a destacar: **o cliente só vê horário livre, e dois clientes nunca pegam o mesmo horário.**

## 3. O painel (1,5 min)
- No seu celular, abra o painel: o horário que ele acabou de marcar já está lá.
- Toque no horário: aparecem o telefone e o botão para chamar o cliente no WhatsApp.
- Mostre **Bloquear horário → Barbearia inteira → véspera de Natal, 14h às 19h**. Volte ao site do cliente: esses horários sumiram.
- Mostre **Novo agendamento**, para cliente que ligou ou chegou na hora.

## 4. Fechamento (30 s)
- "Eu deixo tudo com o nome, os preços e os horários de vocês, e cuido para ficar no ar."
- Implantação + mensalidade (seu valor).

---

# Checklist de implantação (após a venda)

1. **Configurações → Barbearia:** nome, WhatsApp e endereço reais.
2. **Configurações → Serviços:** serviços, durações e preços reais. Desative os que não existem.
3. **Barbeiros:** ajustar nomes direto na tabela `barbers` do Supabase (Table Editor).
4. **Configurações → Horário de trabalho:** horários de cada barbeiro.
5. Apagar os agendamentos de demonstração: no SQL Editor do Supabase, `delete from appointments;`.
6. Criar o acesso do dono: `npm run staff -- email-do-dono@... owner` e passar a senha para ele pessoalmente.
7. Apagar o usuário de demonstração `dono@barbearia.example.com` (Supabase → Authentication → Users).
8. Bloquear feriados de dezembro (Natal, Ano-Novo) pelo painel.
9. Divulgar o link: bio do Instagram, mensagem fixada e resposta automática do WhatsApp Business.
