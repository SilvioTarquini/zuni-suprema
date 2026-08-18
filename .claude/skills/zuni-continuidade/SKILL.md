---
name: zuni-continuidade
description: Mantém o STATUS_ZUNI.md como fonte de verdade sobre o progresso do projeto ZUNI Suprema entre sessões de trabalho, independente de qual interface está sendo usada (chat, Claude Code, Cowork). Use SEMPRE no início de qualquer sessão de trabalho no projeto ZUNI Suprema — leia o arquivo antes de perguntar ao usuário "o que fizemos até agora" ou assumir que a memória de conversa tem todo o contexto. Use também ao final de qualquer sessão em que algo relevante mudou de estado (tarefa concluída, decisão tomada, bug encontrado/corrigido, pendência nova identificada) para atualizar o arquivo antes de encerrar. Dispare este skill quando o usuário mencionar "continuar de onde paramos", "status do projeto", "o que falta fazer", ou iniciar uma sessão fazendo referência a trabalho anterior no projeto ZUNI.
---

# Continuidade de projeto — ZUNI Suprema

O projeto ZUNI Suprema é trabalhado em múltiplas interfaces (chat web, Claude Code,
Cowork) e por sessões separadas no tempo. A memória automática de conversa é útil mas
é resumida progressivamente — detalhes finos de decisões antigas podem se perder ou
ficar genéricos. O `STATUS_ZUNI.md`, salvo na raiz do repositório do projeto, existe
para ser a fonte de verdade explícita, versionada no git, e igualmente acessível
independente da interface usada.

## No início de uma sessão de trabalho

1. Leia `STATUS_ZUNI.md` (raiz do projeto) antes de fazer qualquer suposição sobre o
   que já foi feito. Se o arquivo não existir ainda, ofereça para criá-lo.
2. Se o usuário pedir "o que falta fazer" ou "onde paramos", responda a partir do
   conteúdo real desse arquivo — não da memória de conversa, que pode estar
   desatualizada ou ter perdido granularidade. Se houver conflito entre a memória de
   conversa e o `STATUS_ZUNI.md`, o arquivo vence, porque foi escrito deliberadamente
   como registro de estado, enquanto a memória de conversa é um resumo automático.
3. Se o usuário começar mencionando algo que não está no arquivo (ex.: uma decisão
   tomada em uma sessão que não gerou atualização), incorpore essa informação nova ao
   arquivo assim que fizer sentido, não deixe acumular só na conversa atual.

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

## Relação com outras skills do projeto

Este skill trata do **estado geral** do projeto. Para o processo específico de
curadoria e indexação de uma nova base RAG por tema, use a skill `zuni-rag-tema` — e,
ao concluir esse processo, registre o resultado aqui no `STATUS_ZUNI.md` (não deixe a
informação só dentro do fluxo de trabalho daquela skill).
