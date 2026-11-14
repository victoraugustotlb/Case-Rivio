# VITA — Gerador Figma
- [x] Entregar SVG geral e 200 telas SVG separadas para importar no Figma Web; renderização e integridade verificadas.
- [x] Criar plugin local com biblioteca visual, mobile, paciente web e clínico desktop/tablet.
- [x] Incluir estados, consentimento granular, origem, correlação e ligações do protótipo.
- [x] Validar geração simulada com testes e inspecionar as 200 telas renderizadas.
- [x] Preparar pacote com instalação, limites e especificação.
- [ ] Confirmar execução no Figma real — depende de instalação e execução pelo usuário; não há sessão Figma disponível.
# VITA — Web app
- [x] Abrir questionário no primeiro acesso e permitir adiar; regras cobertas por testes.
- [x] Solicitar republicação do questionário e VITA Clínico; publicação agendada em 14/11/2026.
- [x] Perfil de saúde privado e editável e questionário inicial opcional; validações testadas.
- [ ] Confirmar questionário e salvamento pela tela com sessão autenticada — depende de login do usuário na prévia; sessão automática indisponível.
- [x] Design system, navegação responsiva e Início (dashboard).
- [x] Reorientar para histórico + código ao médico: Início, Documentos (escanear/conferir), Saúde, Compartilhar, Perfil, VITA Clínico.
- [x] Salvar dados de verdade (contas e armazenamento).

# VITA Clínico — acesso e perfil compartilhado
- [x] Renovar a entrada por código e a navegação da visão profissional.
- [x] Adicionar consentimento separado para compartilhar o questionário de saúde, sem ampliar códigos antigos.
- [x] Exibir perfil, medicamentos, histórico e hábitos autorizados no VITA Clínico.
- [x] Testar regras, código inválido e apresentação pública no computador e celular.
- [x] Confirmar painel, quatro etapas do questionário, geração de código com consentimento e leitura do perfil real no computador e celular; código temporário encerrado após o teste, sem alterar respostas.
- [ ] Confirmar entrada interativa pelo Google no site publicado — depende de o usuário concluir a autorização do Google; os testes usaram uma sessão segura da conta anteriormente indicada.

# VITA Web — documentos reais
- [x] Contas de paciente (e-mail/senha e Google), telas protegidas.
- [x] Envio de arquivo/foto, leitura por IA, conferência e salvamento no histórico.
- [x] Códigos de compartilhamento salvos; médico abre só o autorizado.
- [ ] Teste completo logado — precisa de uma conta criada pelo usuário no preview.
- [x] Contas profissionais (CRM informado), histórico de pacientes e código de 6 dígitos pedido pelo médico.
- [ ] Validar CRM junto ao conselho — depende de uma fonte oficial de consulta.
- [ ] Integração real com wearables.
- [x] Visão clínica técnica no acesso por código (faixa, origem, resumo, referência, linha do tempo, documento técnico, encerramento, registro de acessos)

# Entrada, plano e assinatura
- [x] Entrar com três caminhos (plano, assinatura individual, profissional) e tipos de conta com redirecionamento
- [x] Vínculo com plano (carteirinha, titular/dependente, limite de tentativas) e textos de privacidade
- [x] Laboratório ou clínica (CNPJ informado) no painel profissional
- [x] Envio e novos códigos pausados quando o acesso não está em dia; leitura sempre liberada
- [ ] Cobrança da assinatura individual (cartão e Pix), portal do cliente, cancelamento e webhook — aguardando o usuário ativar os pagamentos (a ativação foi recusada)
- [ ] Aprovação do dependente pelo titular — Prompt 3

## Minha família
- [x] Menu, troca de perfil, faixa somente leitura, pedidos de conexão e de acesso, privacidade, responsável legal, código para menor; regras com testes
- [ ] Teste completo com titular + dependente reais — precisa de duas contas de plano na mesma família
- [ ] Encerrar pelo app um código gerado para um menor — hoje só expira sozinho

## Agendamento de consultas
- [x] Navegação com Consultas e menu Mais; busca com filtros, lista/mapa, detalhe, resumo, agendar, cancelar/remarcar, lembrete na véspera; regras com testes; testado com sessão real
- [ ] Rede credenciada real das operadoras — depende de acesso às APIs das operadoras
- [ ] Novos horários de demonstração após 30 dias — hoje cobrem só os próximos 30 dias
