ZUNI ENGINEERING INTELLIGENCE BRIEF  
Registro inicial do protótipo técnico local — v0.1

Decisão  
Criar um copiloto de governança de engenharia em modo somente leitura. O protótipo converte sinais do repositório em visão arquitetural, riscos, impactos de produto e decisões rastreáveis.

Objetivo  
Apoiar a Governança ZUNI, a Engenharia e a Curadoria com respostas fundamentadas sobre estrutura do código, módulos, dependências, mudanças, riscos e prioridades do ecossistema.

Escopo inicial  
• Ler estrutura, arquivos, histórico, issues, pull requests e diffs dentro de repositório e branch explicitamente autorizados.  
• Produzir inventário técnico, mapa de arquitetura, dossiê de riscos, resumo executivo de mudanças e respostas técnicas com referências.  
• Registrar fonte, escopo, incerteza, responsável e decisão associada.

Limites de autoridade  
O protótipo não cria issues, comentários, branches, commits, pull requests, merges, releases, deploys, exclusões, permissões ou alterações de credenciais. Qualquer ação externa exige aprovação humana explícita e registro no Livro das Decisões.

Princípios operacionais  
Privilégio mínimo; reversibilidade; separação entre geração, aprovação e execução; auditoria; kill switch; dados sintéticos ou anonimizados no desenvolvimento local; nenhuma inferência apresentada como fato sem evidência.

Fluxo do MVP  
1\. Definir repositório, branch e perguntas autorizadas.  
2\. Executar inventário somente leitura.  
3\. Gerar Brief técnico com evidências, riscos e lacunas.  
4\. Avaliar respostas contra 10 perguntas técnicas reais.  
5\. Revisar humanamente antes de ampliar escopo.

Critérios de sucesso  
• Respostas rastreáveis a arquivos, refs ou documentação.  
• Identificação útil de dependências, riscos e impactos.  
• Nenhuma ação de escrita ou exposição de segredo.  
• Registro suficiente para auditoria e reversão.  
• Decisão humana preservada em toda ação de impacto.

Relações institucionais  
Subordinado à Constituição, Manifesto, AI Charter, ZUNI-A021 Platform Blueprint e Ficha Canônica ZUNI-A022. Atua em apoio ao Hub ZUNI, Engenharia, Administração, segurança, documentação e ZHKE técnico.

Próximo passo  
Definir o repositório e a branch do primeiro experimento, criar a matriz de permissões read-only e montar o conjunto de 10 perguntas de avaliação.

Status  
Especificação aprovada para protótipo local; integração efetiva depende de chave API isolada, permissões confirmadas e validação humana.