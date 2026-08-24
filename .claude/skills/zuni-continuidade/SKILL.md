---
name: zuni-continuidade
description: Mantém dois arquivos como fonte de verdade sobre o projeto ZUNI Suprema entre sessões de trabalho, independente de qual interface está sendo usada (chat, Claude Code, Cowork): STATUS_ZUNI.md (estado — o que está feito e o que está pendente) e RADAR_OPORTUNIDADES.md (horizonte — o que pode ser feito). Use SEMPRE no início de qualquer sessão de trabalho no projeto ZUNI Suprema — leia os arquivos antes de perguntar ao usuário "o que fizemos até agora" ou assumir que a memória de conversa tem todo o contexto. Use também ao final de qualquer sessão em que algo relevante mudou de estado (tarefa concluída, decisão tomada, bug encontrado/corrigido, pendência nova identificada) para atualizar os arquivos antes de encerrar. Dispare este skill quando o usuário mencionar "continuar de onde paramos", "status do projeto", "o que falta fazer", "radar de oportunidades", "o que podemos fazer a seguir", ou iniciar uma sessão fazendo referência a trabalho anterior no projeto ZUNI.
---

# Continuidade de projeto — ZUNI Suprema

O projeto ZUNI Suprema é trabalhado em múltiplas interfaces (chat web, Claude Code,
Cowork) e por sessões separadas no tempo. A memória automática de conversa é útil mas
é resumida progressivamente — detalhes finos de decisões antigas podem se perder ou
ficar genéricos. O `STATUS_ZUNI.md`, salvo na raiz do repositório do projeto, existe
para ser a fonte de verdade explícita, versionada no git, e igualmente acessível
independente da interface usada.

## No início de uma sessão de trabalho

1. Leia `STATUS_ZUNI.md` e `RADAR_OPORTUNIDADES.md` (ambos na raiz do projeto) antes de
   fazer qualquer suposição sobre o que já foi feito ou o que pode vir a seguir. Se
   algum dos arquivos não existir ainda, ofereça para criá-lo.
2. Regra de precedência entre os dois: para perguntas sobre **estado atual** (o que já
   foi feito, o que está pendente), vale o `STATUS_ZUNI.md`. Para perguntas sobre
   **próximos passos ou possibilidades** (o que podemos fazer a seguir, novas
   oportunidades), consulte também o `RADAR_OPORTUNIDADES.md`.
3. Se o usuário pedir "o que falta fazer" ou "onde paramos", responda a partir do
   conteúdo real do `STATUS_ZUNI.md` — não da memória de conversa, que pode estar
   desatualizada ou ter perdido granularidade. Se houver conflito entre a memória de
   conversa e o `STATUS_ZUNI.md`, o arquivo vence, porque foi escrito deliberadamente
   como registro de estado, enquanto a memória de conversa é um resumo automático.
4. Se o usuário começar mencionando algo que não está registrado (ex.: uma decisão
   tomada em uma sessão que não gerou atualização), incorpore essa informação nova ao
   arquivo correto assim que fizer sentido, não deixe acumular só na conversa atual.
   Informação sobre estado (tarefa concluída, bug, pendência) vai para o
   `STATUS_ZUNI.md`; informação sobre horizonte (nova oportunidade, referência de
   mercado, produto cogitado) vai para o `RADAR_OPORTUNIDADES.md`. Uma decisão
   estratégica que muda o rumo do projeto vai para o `STATUS_ZUNI.md`, na seção
   "Decisões estratégicas".

## Ao final de uma sessão de trabalho

Sempre que algo relevante mudou de estado durante a sessão, proponha uma atualização
do `STATUS_ZUNI.md` antes de encerrar. "Relevante" inclui:

- Uma tarefa da seção "Em andamento" ou "Pendências" foi concluída → mover para
  "Em produção, funcionando" com uma linha curta de contexto (o quê, quando, como foi
  validado).
- Uma decisão de produto ou arquitetura foi tomada → registrar na seção apropriada,
  com a data e, se o usuário usou palavras específicas importantes, preservá-las.
- Um bug foi encontrado e corrigido → vale registrar mesmo que pareça pequeno, porque
  bugs recorrentes do mesmo tipo (ex.: variável de ambiente faltando em produção) são
  mais fáceis de reconhecer se há histórico.
- Uma nova pendência ou próximo passo surgiu → adicionar à seção correspondente, com
  prioridade relativa se o usuário indicou uma.
- Um item do radar entrou em execução → mover para a seção correspondente do
  `STATUS_ZUNI.md` e marcar como migrado no `RADAR_OPORTUNIDADES.md`, para que os dois
  não divirjam.

**Não precisa esperar o usuário pedir.** Ao perceber que a sessão está terminando
(despedida, "obrigado", "até a próxima"), ofereça a atualização proativamente: "Antes
de encerrar, quer que eu atualize o STATUS_ZUNI.md com o que fizemos hoje?" — e, se
sim, mostre o diff específico (o que está sendo adicionado/movido) antes de gravar,
seguindo a mesma regra de aprovação explícita que rege o resto do projeto.

## Formato de atualização

Edite o arquivo diretamente (via Code/Cowork) preservando a estrutura de seções
existente. Não reescreva o arquivo inteiro do zero a cada sessão — edições pontuais
(mover uma linha de seção, adicionar uma linha nova, atualizar uma tabela) preservam o
histórico de git de forma mais legível do que substituições completas.

Sempre atualize a linha "Última atualização" no topo do arquivo.

O `RADAR_OPORTUNIDADES.md` segue a mesma regra de edição pontual — não reescrever o
arquivo inteiro do zero a cada sessão.

## Relação com outras skills do projeto

Este skill trata do **estado geral** do projeto. Para o processo específico de
curadoria e indexação de uma nova base RAG por tema, use a skill `zuni-rag-tema` — e,
ao concluir esse processo, registre o resultado aqui no `STATUS_ZUNI.md` (não deixe a
informação só dentro do fluxo de trabalho daquela skill).
