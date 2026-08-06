module.exports = {
  categorias: [
    { slug: 'juventude', titulo: 'Juventude' },
    { slug: 'empresarios', titulo: 'Empresários' },
    { slug: 'relacionamentos', titulo: 'Relacionamentos' },
    { slug: 'familia', titulo: 'Família' },
    { slug: 'saude_emocional', titulo: 'Saúde Emocional' },
    { slug: 'saude_fisica', titulo: 'Saúde Física' },
    { slug: 'mente_e_proposito', titulo: 'Mente e Propósito' },
    { slug: 'geral', titulo: 'Comunicação e Timidez' }
  ],

  cabecalhosComSobreposicao: [
    { cabecalho: 'Depressão', apontaParaTema: 'depressao', categoriaOrigem: 'saude_emocional' },
    { cabecalho: 'Luto', apontaParaTema: 'luto', categoriaOrigem: 'saude_emocional' },
    { cabecalho: 'Estresse', apontaParaTema: 'estresse', categoriaOrigem: 'saude_emocional' },
    { cabecalho: 'Namoro', apontaParaTema: 'primeiro_amor', categoriaOrigem: 'juventude' },
    { cabecalho: 'Educação de Filhos', apontaParaTema: 'educar_filhos', categoriaOrigem: 'familia' }
  ],

  questionarios: [
    {
      tema: 'timidez_comunicacao',
      categoria: 'geral',
      titulo: 'Timidez e Comunicação',
      ragIndexado: true,
      perguntas: [
        { id: 'q1', texto: 'O que mais te incomoda hoje?', opcoes: ['Falar em público/apresentações', 'Puxar conversa ou me aproximar de pessoas novas', 'Expressar minha opinião mesmo com quem já conheço', 'Situações sociais em grupo', 'Outro'] },
        { id: 'q2', texto: 'Há quanto tempo isso te acompanha?', opcoes: ['Sempre foi assim', 'Começou na adolescência', 'Começou na vida adulta', 'É recente (últimos meses)'] },
        { id: 'q3', texto: 'O que você sente fisicamente nessas horas?', opcoes: ['Nó na garganta/trava a fala', 'Coração acelerado, mãos suando', 'Vontade de sumir/evitar', 'Não sinto nada físico, é mais mental'] },
        { id: 'q4', texto: 'O que você já tentou para lidar com isso?', opcoes: ['Nada ainda', 'Já tentei sozinho(a)', 'Já fiz terapia/acompanhamento antes', 'Evito completamente'] },
        { id: 'q5', texto: 'O que você espera encontrar aqui hoje?', opcoes: ['Entender por que sou assim', 'Ferramentas práticas', 'Só desabafar e ser ouvido(a)', 'Ainda não sei, quero explorar'] }
      ]
    },
    {
      tema: 'bullying',
      categoria: 'juventude',
      titulo: 'Bullying',
      perguntas: [
        { id: 'q1', texto: 'O que mais te incomoda hoje?', opcoes: ['Ser alvo de piadas ou apelidos', 'Ser excluído(a) do grupo', 'Ameaças ou agressões', 'Ver isso acontecer com alguém e não saber o que fazer', 'Outro'] },
        { id: 'q2', texto: 'Há quanto tempo isso acontece?', opcoes: ['Começou recentemente', 'Já dura meses', 'Já dura mais de um ano', 'Aconteceu no passado, mas ainda mexe comigo'] },
        { id: 'q3', texto: 'O que você sente quando pensa nisso?', opcoes: ['Vontade de sumir/evitar', 'Raiva', 'Medo', 'Tristeza que não passa'] },
        { id: 'q4', texto: 'O que você já tentou para lidar com isso?', opcoes: ['Nada ainda', 'Já contei para alguém', 'Já tentei enfrentar sozinho(a)', 'Evito pensar nisso'] },
        { id: 'q5', texto: 'O que você espera encontrar aqui hoje?', opcoes: ['Entender por que isso acontece comigo', 'Ferramentas práticas', 'Só desabafar e ser ouvido(a)', 'Ainda não sei, quero explorar'] }
      ]
    },
    {
      tema: 'vestibular_pressao_escolar',
      categoria: 'juventude',
      titulo: 'Vestibular / Pressão Escolar',
      perguntas: [
        { id: 'q1', texto: 'O que mais pesa agora?', opcoes: ['Medo de não passar', 'Comparação com outras pessoas', 'Cobrança da família', 'Não saber o que escolher', 'Outro'] },
        { id: 'q2', texto: 'Há quanto tempo essa pressão está presente?', opcoes: ['Começou recentemente', 'Já dura meses', 'Já dura mais de um ano', 'Sempre senti isso com estudos'] },
        { id: 'q3', texto: 'O que você sente nos dias mais difíceis?', opcoes: ['Ansiedade antes de estudar/provas', 'Cansaço mental constante', 'Vontade de desistir', 'Bloqueio, não consigo me concentrar'] },
        { id: 'q4', texto: 'O que você já tentou para lidar com isso?', opcoes: ['Nada ainda', 'Já tentei organizar rotina sozinho(a)', 'Já busquei ajuda (psicólogo, orientador)', 'Evito pensar no assunto'] },
        { id: 'q5', texto: 'O que você espera encontrar aqui hoje?', opcoes: ['Entender por que sinto essa pressão', 'Ferramentas práticas para lidar com ela', 'Só desabafar e ser ouvido(a)', 'Ainda não sei, quero explorar'] }
      ]
    },
    {
      tema: 'primeiro_amor',
      categoria: 'juventude',
      titulo: 'Primeiro Amor',
      perguntas: [
        { id: 'q1', texto: 'O que mais te incomoda hoje?', opcoes: ['Medo de me expor/ser rejeitado(a)', 'Não sei se é amizade ou algo mais', 'Estou magoado(a) com alguém', 'Não sei como lidar com esse sentimento novo', 'Outro'] },
        { id: 'q2', texto: 'Há quanto tempo isso está acontecendo?', opcoes: ['É recente (últimas semanas)', 'Já dura meses', 'Já dura mais de um ano', 'Voltou a mexer comigo agora'] },
        { id: 'q3', texto: 'O que você sente quando pensa nisso?', opcoes: ['Borboletas no estômago, ansiedade boa', 'Insegurança', 'Tristeza', 'Confusão, não sei o que sinto'] },
        { id: 'q4', texto: 'O que você já tentou para lidar com isso?', opcoes: ['Nada ainda', 'Já conversei com amigos sobre isso', 'Já tentei conversar com a pessoa', 'Evito pensar/falar sobre isso'] },
        { id: 'q5', texto: 'O que você espera encontrar aqui hoje?', opcoes: ['Entender o que estou sentindo', 'Conselhos práticos', 'Só desabafar e ser ouvido(a)', 'Ainda não sei, quero explorar'] }
      ]
    },
    {
      tema: 'redes_sociais',
      categoria: 'juventude',
      titulo: 'Redes Sociais',
      perguntas: [
        { id: 'q1', texto: 'O que mais te incomoda hoje?', opcoes: ['Comparação constante com outras pessoas', 'Medo de ser julgado(a) pelo que posto', 'Sinto que não consigo parar de usar', 'Já fui alvo de comentários maldosos', 'Outro'] },
        { id: 'q2', texto: 'Há quanto tempo isso te incomoda?', opcoes: ['É recente', 'Já dura meses', 'Já dura mais de um ano', 'Sempre foi assim para mim'] },
        { id: 'q3', texto: 'O que você sente depois de passar tempo nas redes?', opcoes: ['Ansiedade ou inquietação', 'Vazio ou insatisfação', 'Comparação e autocrítica', 'Não sinto nada de diferente'] },
        { id: 'q4', texto: 'O que você já tentou para lidar com isso?', opcoes: ['Nada ainda', 'Já tentei reduzir o tempo de tela sozinho(a)', 'Já conversei sobre isso com alguém', 'Evito pensar no assunto'] },
        { id: 'q5', texto: 'O que você espera encontrar aqui hoje?', opcoes: ['Entender por que me sinto assim', 'Ferramentas práticas', 'Só desabafar e ser ouvido(a)', 'Ainda não sei, quero explorar'] }
      ]
    },
    {
      tema: 'autoestima',
      categoria: 'juventude',
      titulo: 'Autoestima',
      perguntas: [
        { id: 'q1', texto: 'O que mais te incomoda hoje?', opcoes: ['Minha aparência', 'Sinto que não sou bom(boa) o suficiente', 'Comparação com outras pessoas', 'Dificuldade em me aceitar', 'Outro'] },
        { id: 'q2', texto: 'Há quanto tempo isso te acompanha?', opcoes: ['Sempre foi assim', 'Começou na adolescência', 'É recente (últimos meses)', 'Piorou depois de algo específico'] },
        { id: 'q3', texto: 'O que você sente quando pensa em si mesmo(a)?', opcoes: ['Autocrítica forte', 'Vergonha', 'Tristeza', 'Insegurança nas decisões'] },
        { id: 'q4', texto: 'O que você já tentou para lidar com isso?', opcoes: ['Nada ainda', 'Já tentei sozinho(a)', 'Já fiz terapia/acompanhamento antes', 'Evito pensar nisso'] },
        { id: 'q5', texto: 'O que você espera encontrar aqui hoje?', opcoes: ['Entender por que sou assim', 'Ferramentas práticas', 'Só desabafar e ser ouvido(a)', 'Ainda não sei, quero explorar'] }
      ]
    },
    {
      tema: 'amizades',
      categoria: 'juventude',
      titulo: 'Amizades',
      perguntas: [
        { id: 'q1', texto: 'O que mais te incomoda hoje?', opcoes: ['Sinto que não me encaixo em nenhum grupo', 'Uma amizade importante está distante ou acabou', 'Dificuldade em confiar nas pessoas', 'Medo de ser deixado(a) de lado', 'Outro'] },
        { id: 'q2', texto: 'Há quanto tempo isso te acompanha?', opcoes: ['Sempre foi assim', 'Começou recentemente', 'Já dura meses', 'Piorou depois de uma mudança (escola, cidade, fase)'] },
        { id: 'q3', texto: 'O que você sente quando pensa nisso?', opcoes: ['Solidão', 'Tristeza', 'Insegurança', 'Raiva ou frustração'] },
        { id: 'q4', texto: 'O que você já tentou para lidar com isso?', opcoes: ['Nada ainda', 'Já tentei se aproximar de novas pessoas', 'Já conversei sobre isso com alguém', 'Evito o assunto'] },
        { id: 'q5', texto: 'O que você espera encontrar aqui hoje?', opcoes: ['Entender por que me sinto assim', 'Ferramentas práticas', 'Só desabafar e ser ouvido(a)', 'Ainda não sei, quero explorar'] }
      ]
    },
    {
      tema: 'burnout',
      categoria: 'empresarios',
      titulo: 'Burnout',
      perguntas: [
        { id: 'q1', texto: 'O que mais pesa agora?', opcoes: ['Exaustão que não passa com descanso', 'Perdi o entusiasmo pelo trabalho', 'Não consigo desligar, nem fora do expediente', 'Sinto que estou no limite', 'Outro'] },
        { id: 'q2', texto: 'Há quanto tempo você sente isso?', opcoes: ['É recente (últimas semanas)', 'Já dura meses', 'Já dura mais de um ano', 'Vai e volta há tempos'] },
        { id: 'q3', texto: 'O que você sente fisicamente nesses dias?', opcoes: ['Cansaço constante, mesmo dormindo', 'Tensão no corpo, dores frequentes', 'Insônia ou sono ruim', 'Falta de energia para quase tudo'] },
        { id: 'q4', texto: 'O que você já tentou para lidar com isso?', opcoes: ['Nada ainda', 'Já tentei organizar melhor a rotina sozinho(a)', 'Já busquei ajuda profissional antes', 'Continuo empurrando, sem parar para lidar'] },
        { id: 'q5', texto: 'O que você espera encontrar aqui hoje?', opcoes: ['Entender por que cheguei nesse ponto', 'Ferramentas práticas para recuperar energia', 'Só desabafar e ser ouvido(a)', 'Ainda não sei, quero explorar'] }
      ]
    },
    {
      tema: 'administracao_empresarial_inteligente',
      categoria: 'empresarios',
      titulo: 'Administração Inteligente e Alta Performance',
      ragIndexado: true,
      perguntas: [
        { id: 'q1', texto: 'O que mais pesa na sua rotina como líder/executivo hoje?', opcoes: ['Decisões sob pressão de tempo', 'Solidão nas grandes decisões', 'Sensação de estar sempre "ligado", sem desligar', 'Resultado bom mas com custo pessoal alto', 'Outro'] },
        { id: 'q2', texto: 'Como você costuma reagir quando algo dá errado de repente no trabalho?', opcoes: ['Reajo na hora, depois me arrependo', 'Consigo pausar antes de responder', 'Fico paralisado(a)', 'Tento controlar tudo sozinho(a)'] },
        { id: 'q3', texto: 'Há quanto tempo você sente esse tipo de pressão?', opcoes: ['É recente (últimos meses)', 'Já dura anos', 'Sempre foi assim na minha carreira', 'Piorou desde uma mudança específica (promoção, novo cargo, etc.)'] },
        { id: 'q4', texto: 'O que mais te preocupa quando pensa no seu desempenho atual?', opcoes: ['Estou entregando resultado mas me sentindo esgotado(a)', 'Tenho medo de perder o controle numa decisão importante', 'Não sei se estou liderando bem ou só sobrevivendo ao cargo', 'Sinto que minha ambição não bate mais com meus valores'] },
        { id: 'q5', texto: 'O que você mais gostaria de mudar na forma como lida com a pressão?', opcoes: ['Decidir com mais clareza, menos no impulso', 'Ter mais espaço para pensar antes de agir', 'Encontrar equilíbrio entre exigência e bem-estar', 'Reconectar com o propósito por trás do trabalho'] }
      ]
    },
    {
      tema: 'lideranca',
      categoria: 'empresarios',
      titulo: 'Liderança',
      perguntas: [
        { id: 'q1', texto: 'O que mais pesa agora?', opcoes: ['Dificuldade em ser ouvido(a) pela equipe', 'Peso de tomar decisões sozinho(a)', 'Cobrança constante, minha e dos outros', 'Sensação de estar sempre apagando incêndio', 'Outro'] },
        { id: 'q2', texto: 'Há quanto tempo isso te acompanha?', opcoes: ['É recente', 'Já dura meses', 'Já dura mais de um ano', 'Desde que assumi a liderança'] },
        { id: 'q3', texto: 'O que você sente nos dias mais difíceis?', opcoes: ['Tensão e ansiedade', 'Solidão na decisão', 'Cansaço mental', 'Dúvida sobre minha própria capacidade'] },
        { id: 'q4', texto: 'O que você já tentou para lidar com isso?', opcoes: ['Nada ainda', 'Já tentei sozinho(a)', 'Já fiz coaching/mentoria antes', 'Evito pensar nisso, sigo em frente'] },
        { id: 'q5', texto: 'O que você espera encontrar aqui hoje?', opcoes: ['Entender melhor o que sinto', 'Ferramentas práticas de liderança', 'Só desabafar e ser ouvido(a)', 'Ainda não sei, quero explorar'] }
      ]
    },
    {
      tema: 'pressao_cobrancas',
      categoria: 'empresarios',
      titulo: 'Pressão e Cobranças',
      perguntas: [
        { id: 'q1', texto: 'O que mais pesa agora?', opcoes: ['Metas que parecem impossíveis', 'Cobrança de sócios, chefes ou clientes', 'Sensação de nunca ser suficiente', 'Medo de decepcionar', 'Outro'] },
        { id: 'q2', texto: 'Há quanto tempo isso te acompanha?', opcoes: ['É recente', 'Já dura meses', 'Já dura mais de um ano', 'Sempre foi assim no meu trabalho'] },
        { id: 'q3', texto: 'O que você sente nos momentos de mais pressão?', opcoes: ['Aperto no peito ou tensão', 'Irritabilidade', 'Vontade de fugir da situação', 'Paralisação, trava e não sei por onde começar'] },
        { id: 'q4', texto: 'O que você já tentou para lidar com isso?', opcoes: ['Nada ainda', 'Já tentei sozinho(a)', 'Já busquei ajuda profissional antes', 'Evito pensar nisso, sigo em frente'] },
        { id: 'q5', texto: 'O que você espera encontrar aqui hoje?', opcoes: ['Entender por que sinto essa pressão', 'Ferramentas práticas', 'Só desabafar e ser ouvido(a)', 'Ainda não sei, quero explorar'] }
      ]
    },
    {
      tema: 'decisoes_dificeis',
      categoria: 'empresarios',
      titulo: 'Decisões Difíceis',
      perguntas: [
        { id: 'q1', texto: 'O que mais pesa agora?', opcoes: ['Uma decisão de negócio que não sei como tomar', 'Medo de errar e perder o que construí', 'Falta de clareza sobre o próximo passo', 'Peso de decidir sozinho(a)', 'Outro'] },
        { id: 'q2', texto: 'Há quanto tempo essa decisão está em aberto?', opcoes: ['É recente', 'Já dura semanas', 'Já dura meses', 'Já dura mais de um ano'] },
        { id: 'q3', texto: 'O que você sente ao pensar nessa decisão?', opcoes: ['Ansiedade', 'Indecisão, dou voltas sem concluir', 'Medo do arrependimento', 'Cansaço só de pensar nisso'] },
        { id: 'q4', texto: 'O que você já tentou para lidar com isso?', opcoes: ['Nada ainda', 'Já conversei com alguém de confiança', 'Já busquei uma consultoria/mentoria', 'Evito decidir, vou adiando'] },
        { id: 'q5', texto: 'O que você espera encontrar aqui hoje?', opcoes: ['Clareza para decidir', 'Ferramentas práticas', 'Só desabafar e ser ouvido(a)', 'Ainda não sei, quero explorar'] }
      ]
    },
    {
      tema: 'crise_financeira',
      categoria: 'empresarios',
      titulo: 'Crise Financeira',
      perguntas: [
        { id: 'q1', texto: 'O que mais pesa agora?', opcoes: ['Caixa apertado ou negativo', 'Medo de não conseguir pagar contas do negócio', 'Sensação de estar perto de fechar', 'Vergonha de falar sobre a situação', 'Outro'] },
        { id: 'q2', texto: 'Há quanto tempo essa situação está presente?', opcoes: ['É recente (últimas semanas)', 'Já dura meses', 'Já dura mais de um ano', 'É recorrente, vai e volta'] },
        { id: 'q3', texto: 'O que você sente quando pensa na situação financeira?', opcoes: ['Ansiedade', 'Vergonha', 'Insônia', 'Paralisação, não sei por onde começar'] },
        { id: 'q4', texto: 'O que você já tentou para lidar com isso?', opcoes: ['Nada ainda', 'Já tentei reorganizar sozinho(a)', 'Já busquei ajuda profissional (contador, consultor)', 'Evito olhar para os números'] },
        { id: 'q5', texto: 'O que você espera encontrar aqui hoje?', opcoes: ['Entender melhor o que sinto sobre isso', 'Clareza para os próximos passos', 'Só desabafar e ser ouvido(a)', 'Ainda não sei, quero explorar'] }
      ]
    },
    {
      tema: 'crescimento_escala',
      categoria: 'empresarios',
      titulo: 'Crescimento e Escala',
      perguntas: [
        { id: 'q1', texto: 'O que mais pesa agora?', opcoes: ['Não sei se estou pronto(a) para crescer', 'Medo de perder qualidade ao expandir', 'Sobrecarga por fazer tudo sozinho(a)', 'Dificuldade em delegar', 'Outro'] },
        { id: 'q2', texto: 'Há quanto tempo isso te acompanha?', opcoes: ['É recente', 'Já dura meses', 'Já dura mais de um ano', 'Desde que comecei o negócio'] },
        { id: 'q3', texto: 'O que você sente ao pensar em crescer?', opcoes: ['Entusiasmo misturado com medo', 'Ansiedade', 'Cansaço, sinto que já não dou conta do tamanho atual', 'Insegurança sobre minha capacidade'] },
        { id: 'q4', texto: 'O que você já tentou para lidar com isso?', opcoes: ['Nada ainda', 'Já tentei planejar sozinho(a)', 'Já busquei mentoria ou consultoria', 'Evito pensar nisso por enquanto'] },
        { id: 'q5', texto: 'O que você espera encontrar aqui hoje?', opcoes: ['Clareza sobre o próximo passo', 'Ferramentas práticas', 'Só desabafar e ser ouvido(a)', 'Ainda não sei, quero explorar'] }
      ]
    },
    {
      tema: 'ciumes',
      categoria: 'relacionamentos',
      titulo: 'Ciúmes',
      perguntas: [
        { id: 'q1', texto: 'O que mais te incomoda hoje?', opcoes: ['Sinto ciúmes que não consigo controlar', 'Desconfio sem provas concretas', 'Meu parceiro(a) tem ciúmes de mim', 'O ciúme está afastando as pessoas de mim', 'Outro'] },
        { id: 'q2', texto: 'Há quanto tempo isso acontece?', opcoes: ['É recente', 'Já dura meses', 'Já dura mais de um ano', 'Sempre foi assim para mim'] },
        { id: 'q3', texto: 'O que você sente nesses momentos?', opcoes: ['Aperto no peito, ansiedade', 'Raiva', 'Medo de perder a pessoa', 'Vergonha do que sinto'] },
        { id: 'q4', texto: 'O que você já tentou para lidar com isso?', opcoes: ['Nada ainda', 'Já tentei conversar sobre isso', 'Já fiz terapia/acompanhamento antes', 'Evito o assunto'] },
        { id: 'q5', texto: 'O que você espera encontrar aqui hoje?', opcoes: ['Entender por que sinto isso', 'Ferramentas práticas', 'Só desabafar e ser ouvido(a)', 'Ainda não sei, quero explorar'] }
      ]
    },
    {
      tema: 'distanciamento',
      categoria: 'relacionamentos',
      titulo: 'Distanciamento',
      perguntas: [
        { id: 'q1', texto: 'O que mais te incomoda hoje?', opcoes: ['Sinto que nos afastamos aos poucos', 'Perdemos a conexão que tínhamos', 'Conversamos cada vez menos', 'Não sei se ainda queremos as mesmas coisas', 'Outro'] },
        { id: 'q2', texto: 'Há quanto tempo isso acontece?', opcoes: ['É recente', 'Já dura meses', 'Já dura mais de um ano', 'Vai e volta há tempos'] },
        { id: 'q3', texto: 'O que você sente quando pensa nisso?', opcoes: ['Tristeza', 'Solidão, mesmo estando junto(a)', 'Frustração', 'Confusão sobre o que fazer'] },
        { id: 'q4', texto: 'O que você já tentou para lidar com isso?', opcoes: ['Nada ainda', 'Já tentei conversar sobre isso', 'Já buscamos terapia de casal', 'Evito tocar no assunto'] },
        { id: 'q5', texto: 'O que você espera encontrar aqui hoje?', opcoes: ['Entender o que está acontecendo', 'Ferramentas práticas', 'Só desabafar e ser ouvido(a)', 'Ainda não sei, quero explorar'] }
      ]
    },
    {
      tema: 'separacao_divorcio',
      categoria: 'relacionamentos',
      titulo: 'Separação / Divórcio',
      perguntas: [
        { id: 'q1', texto: 'O que mais pesa agora?', opcoes: ['A decisão de separar ou não', 'A dor de já ter terminado', 'Medo do que vem depois', 'Questões práticas (filhos, casa, finanças)', 'Outro'] },
        { id: 'q2', texto: 'Há quanto tempo aconteceu ou está acontecendo essa separação?', opcoes: ['É muito recente (dias ou semanas)', 'Já faz alguns meses', 'Já faz mais de um ano', 'Ainda não aconteceu, estou decidindo'] },
        { id: 'q3', texto: 'O que você sente com mais frequência?', opcoes: ['Tristeza profunda', 'Raiva', 'Alívio misturado com culpa', 'Medo do futuro'] },
        { id: 'q4', texto: 'O que você já tentou para lidar com isso?', opcoes: ['Nada ainda', 'Já conversei com amigos ou família', 'Já fiz ou faço terapia', 'Evito pensar no assunto'] },
        { id: 'q5', texto: 'O que você espera encontrar aqui hoje?', opcoes: ['Entender o que estou sentindo', 'Ferramentas práticas para seguir em frente', 'Só desabafar e ser ouvido(a)', 'Ainda não sei, quero explorar'] }
      ]
    },
    {
      tema: 'reconciliacao',
      categoria: 'relacionamentos',
      titulo: 'Reconciliação',
      perguntas: [
        { id: 'q1', texto: 'O que mais te incomoda hoje?', opcoes: ['Não sei se devo tentar de novo', 'Tenho medo de repetir os mesmos erros', 'A outra pessoa quer voltar e eu tenho dúvidas', 'Eu quero voltar e não sei como reconstruir a confiança', 'Outro'] },
        { id: 'q2', texto: 'Há quanto tempo isso está em aberto?', opcoes: ['É recente', 'Já dura semanas', 'Já dura meses', 'Já dura mais de um ano'] },
        { id: 'q3', texto: 'O que você sente quando pensa nessa possibilidade?', opcoes: ['Esperança', 'Medo', 'Confusão', 'Ansiedade'] },
        { id: 'q4', texto: 'O que você já tentou para lidar com isso?', opcoes: ['Nada ainda', 'Já conversamos sobre isso', 'Já buscamos ajuda profissional', 'Evito o assunto'] },
        { id: 'q5', texto: 'O que você espera encontrar aqui hoje?', opcoes: ['Clareza sobre o que fazer', 'Ferramentas práticas', 'Só desabafar e ser ouvido(a)', 'Ainda não sei, quero explorar'] }
      ]
    },
    {
      tema: 'incompatibilidade',
      categoria: 'relacionamentos',
      titulo: 'Incompatibilidade',
      perguntas: [
        { id: 'q1', texto: 'O que mais te incomoda hoje?', opcoes: ['Sinto que queremos coisas diferentes da vida', 'Brigamos sempre pelos mesmos motivos', 'Nossos valores parecem não combinar', 'Não sei se essa relação ainda faz sentido', 'Outro'] },
        { id: 'q2', texto: 'Há quanto tempo isso te acompanha?', opcoes: ['É recente', 'Já dura meses', 'Já dura mais de um ano', 'Sempre foi assim, desde o início'] },
        { id: 'q3', texto: 'O que você sente quando pensa na relação?', opcoes: ['Cansaço', 'Confusão', 'Tristeza', 'Frustração'] },
        { id: 'q4', texto: 'O que você já tentou para lidar com isso?', opcoes: ['Nada ainda', 'Já tentei conversar sobre isso', 'Já buscamos terapia de casal', 'Evito o assunto'] },
        { id: 'q5', texto: 'O que você espera encontrar aqui hoje?', opcoes: ['Clareza sobre o que fazer', 'Ferramentas práticas', 'Só desabafar e ser ouvido(a)', 'Ainda não sei, quero explorar'] }
      ]
    },
    {
      tema: 'recomeco_amoroso',
      categoria: 'relacionamentos',
      titulo: 'Recomeço Amoroso',
      perguntas: [
        { id: 'q1', texto: 'O que mais te incomoda hoje?', opcoes: ['Medo de se abrir para alguém de novo', 'Comparação com relações passadas', 'Insegurança sobre estar pronto(a)', 'Solidão depois do fim de uma relação', 'Outro'] },
        { id: 'q2', texto: 'Há quanto tempo você está nessa fase?', opcoes: ['É recente (últimas semanas)', 'Já dura meses', 'Já dura mais de um ano', 'Já tentei recomeçar antes e não deu certo'] },
        { id: 'q3', texto: 'O que você sente quando pensa em recomeçar?', opcoes: ['Esperança', 'Medo', 'Ansiedade', 'Cansaço emocional'] },
        { id: 'q4', texto: 'O que você já tentou para lidar com isso?', opcoes: ['Nada ainda', 'Já tentei sozinho(a)', 'Já fiz terapia/acompanhamento antes', 'Evito pensar nisso'] },
        { id: 'q5', texto: 'O que você espera encontrar aqui hoje?', opcoes: ['Entender por que me sinto assim', 'Ferramentas práticas', 'Só desabafar e ser ouvido(a)', 'Ainda não sei, quero explorar'] }
      ]
    },
    {
      tema: 'namoro_conquista_romance',
      categoria: 'relacionamentos',
      titulo: 'Namoro, Conquista e Romance',
      ragIndexado: true,
      perguntas: [
        {
          id: 'q1',
          texto: 'O que mais te incomoda hoje?',
          opcoes: ['Não sei como me aproximar de quem me interessa', 'Dificuldade em manter o interesse depois do início', 'Insegurança sobre meu próprio valor no relacionamento', 'Medo de me abrir e sair machucado(a) de novo', 'Outro']
        },
        {
          id: 'q2',
          texto: 'Há quanto tempo isso te acompanha?',
          opcoes: ['Sempre foi assim para mim', 'Começou depois de um término ou decepção', 'É algo recente (últimos meses)', 'Varia bastante, não é constante']
        },
        {
          id: 'q3',
          texto: 'O que você sente quando pensa nisso?',
          opcoes: ['Ansiedade só de imaginar a situação', 'Frustração por já ter tentado e não ter dado certo', 'Dúvida se estou fazendo algo errado', 'Cansaço, como se já tivesse desistido um pouco']
        },
        {
          id: 'q4',
          texto: 'O que você já tentou para lidar com isso?',
          opcoes: ['Nada ainda, só observo e evito', 'Já tentei mudar minha postura sozinho(a)', 'Já conversei sobre isso com alguém próximo', 'Já fiz terapia/acompanhamento sobre o tema']
        },
        {
          id: 'q5',
          texto: 'O que você espera encontrar aqui hoje?',
          opcoes: ['Entender por que isso se repete comigo', 'Ferramentas práticas para agir diferente', 'Só desabafar e ser ouvido(a)', 'Ainda não sei, quero explorar']
        }
      ]
    },
    {
      tema: 'maternidade',
      categoria: 'familia',
      titulo: 'Maternidade',
      perguntas: [
        { id: 'q1', texto: 'O que mais pesa agora?', opcoes: ['Sensação de nunca fazer o suficiente', 'Perda da minha identidade fora do papel de mãe', 'Cansaço físico e mental constante', 'Cobrança externa sobre como devo ser mãe', 'Outro'] },
        { id: 'q2', texto: 'Há quanto tempo isso te acompanha?', opcoes: ['É recente', 'Já dura meses', 'Já dura mais de um ano', 'Desde que me tornei mãe'] },
        { id: 'q3', texto: 'O que você sente nos dias mais difíceis?', opcoes: ['Culpa', 'Exaustão', 'Solidão', 'Ansiedade'] },
        { id: 'q4', texto: 'O que você já tentou para lidar com isso?', opcoes: ['Nada ainda', 'Já tentei sozinha', 'Já fiz terapia/acompanhamento antes', 'Evito pensar nisso, sigo em frente'] },
        { id: 'q5', texto: 'O que você espera encontrar aqui hoje?', opcoes: ['Entender por que me sinto assim', 'Ferramentas práticas', 'Só desabafar e ser ouvida', 'Ainda não sei, quero explorar'] }
      ]
    },
    {
      tema: 'paternidade',
      categoria: 'familia',
      titulo: 'Paternidade',
      perguntas: [
        { id: 'q1', texto: 'O que mais pesa agora?', opcoes: ['Medo de não estar presente o suficiente', 'Insegurança sobre como educar', 'Pressão de ser o provedor', 'Dificuldade em equilibrar trabalho e família', 'Outro'] },
        { id: 'q2', texto: 'Há quanto tempo isso te acompanha?', opcoes: ['É recente', 'Já dura meses', 'Já dura mais de um ano', 'Desde que me tornei pai'] },
        { id: 'q3', texto: 'O que você sente nos dias mais difíceis?', opcoes: ['Culpa', 'Cansaço', 'Insegurança', 'Frustração'] },
        { id: 'q4', texto: 'O que você já tentou para lidar com isso?', opcoes: ['Nada ainda', 'Já tentei sozinho', 'Já fiz terapia/acompanhamento antes', 'Evito pensar nisso, sigo em frente'] },
        { id: 'q5', texto: 'O que você espera encontrar aqui hoje?', opcoes: ['Entender por que me sinto assim', 'Ferramentas práticas', 'Só desabafar e ser ouvido', 'Ainda não sei, quero explorar'] }
      ]
    },
    {
      tema: 'educar_filhos',
      categoria: 'familia',
      titulo: 'Adolescência dos Filhos',
      ragIndexado: true,
      perguntas: [
        { id: 'q1', texto: 'O que mais pesa agora?', opcoes: ['Não sei mais como me aproximar do meu filho(a)', 'Brigas frequentes em casa', 'Medo das escolhas que ele(a) está fazendo', 'Sinto que perdi a conexão que tínhamos', 'Outro'] },
        { id: 'q2', texto: 'Há quanto tempo isso acontece?', opcoes: ['É recente', 'Já dura meses', 'Já dura mais de um ano', 'Piorou depois de algo específico'] },
        { id: 'q3', texto: 'O que você sente quando pensa nisso?', opcoes: ['Preocupação', 'Tristeza', 'Impotência', 'Frustração'] },
        { id: 'q4', texto: 'O que você já tentou para lidar com isso?', opcoes: ['Nada ainda', 'Já tentei conversar sozinho(a)', 'Já buscamos ajuda profissional', 'Evito o assunto em casa'] },
        { id: 'q5', texto: 'O que você espera encontrar aqui hoje?', opcoes: ['Entender melhor essa fase', 'Ferramentas práticas', 'Só desabafar e ser ouvido(a)', 'Ainda não sei, quero explorar'] }
      ]
    },
    {
      tema: 'pais_idosos',
      categoria: 'familia',
      titulo: 'Pais Idosos',
      perguntas: [
        { id: 'q1', texto: 'O que mais pesa agora?', opcoes: ['Preocupação com a saúde deles', 'Peso de cuidar sozinho(a)', 'Culpa por não conseguir estar mais presente', 'Dificuldade em conversar sobre o envelhecimento', 'Outro'] },
        { id: 'q2', texto: 'Há quanto tempo essa situação está presente?', opcoes: ['É recente', 'Já dura meses', 'Já dura mais de um ano', 'Está piorando aos poucos'] },
        { id: 'q3', texto: 'O que você sente quando pensa nisso?', opcoes: ['Ansiedade', 'Culpa', 'Cansaço', 'Tristeza antecipada'] },
        { id: 'q4', texto: 'O que você já tentou para lidar com isso?', opcoes: ['Nada ainda', 'Já tentei organizar sozinho(a)', 'Já busquei apoio profissional ou de outros familiares', 'Evito pensar nisso'] },
        { id: 'q5', texto: 'O que você espera encontrar aqui hoje?', opcoes: ['Entender melhor o que sinto', 'Ferramentas práticas', 'Só desabafar e ser ouvido(a)', 'Ainda não sei, quero explorar'] }
      ]
    },
    {
      tema: 'conflitos_familiares',
      categoria: 'familia',
      titulo: 'Conflitos Familiares',
      perguntas: [
        { id: 'q1', texto: 'O que mais te incomoda hoje?', opcoes: ['Brigas frequentes em casa', 'Mágoas antigas que nunca foram resolvidas', 'Sinto que não sou compreendido(a) pela família', 'Diferenças de valores que geram conflito', 'Outro'] },
        { id: 'q2', texto: 'Há quanto tempo isso acontece?', opcoes: ['É recente', 'Já dura meses', 'Já dura mais de um ano', 'Vem de longa data'] },
        { id: 'q3', texto: 'O que você sente quando pensa nisso?', opcoes: ['Tristeza', 'Raiva', 'Cansaço', 'Culpa'] },
        { id: 'q4', texto: 'O que você já tentou para lidar com isso?', opcoes: ['Nada ainda', 'Já tentei conversar sozinho(a)', 'Já buscamos terapia familiar', 'Evito o assunto'] },
        { id: 'q5', texto: 'O que você espera encontrar aqui hoje?', opcoes: ['Entender melhor a situação', 'Ferramentas práticas', 'Só desabafar e ser ouvido(a)', 'Ainda não sei, quero explorar'] }
      ]
    },
    {
      tema: 'perdao_familiar',
      categoria: 'familia',
      titulo: 'Perdão Familiar',
      perguntas: [
        { id: 'q1', texto: 'O que mais te incomoda hoje?', opcoes: ['Uma mágoa antiga que não consigo superar', 'Dificuldade em perdoar alguém da família', 'Sinto que preciso ser perdoado(a) por algo', 'O afastamento que uma mágoa causou', 'Outro'] },
        { id: 'q2', texto: 'Há quanto tempo isso te acompanha?', opcoes: ['É recente', 'Já dura meses', 'Já dura mais de um ano', 'Vem de muitos anos'] },
        { id: 'q3', texto: 'O que você sente quando pensa nisso?', opcoes: ['Tristeza', 'Raiva', 'Culpa', 'Um misto de tudo isso'] },
        { id: 'q4', texto: 'O que você já tentou para lidar com isso?', opcoes: ['Nada ainda', 'Já tentei sozinho(a)', 'Já fiz terapia/acompanhamento antes', 'Evito pensar nisso'] },
        { id: 'q5', texto: 'O que você espera encontrar aqui hoje?', opcoes: ['Entender melhor o que sinto', 'Ferramentas práticas', 'Só desabafar e ser ouvido(a)', 'Ainda não sei, quero explorar'] }
      ]
    },
    {
      tema: 'ansiedade',
      categoria: 'saude_emocional',
      titulo: 'Ansiedade',
      perguntas: [
        { id: 'q1', texto: 'O que mais te incomoda hoje?', opcoes: ['Pensamentos acelerados que não param', 'Preocupação constante com o futuro', 'Tensão física frequente', 'Dificuldade em relaxar mesmo em momentos calmos', 'Outro'] },
        { id: 'q2', texto: 'Há quanto tempo isso te acompanha?', opcoes: ['Sempre foi assim', 'Começou há meses', 'É recente (últimas semanas)', 'Piorou depois de algo específico'] },
        { id: 'q3', texto: 'O que você sente fisicamente nesses momentos?', opcoes: ['Coração acelerado, respiração curta', 'Tensão muscular, aperto no peito', 'Inquietação, não paro no lugar', 'Não sinto nada físico, é mais mental'] },
        { id: 'q4', texto: 'O que você já tentou para lidar com isso?', opcoes: ['Nada ainda', 'Já tentei sozinho(a)', 'Já fiz terapia/acompanhamento antes', 'Evito pensar nisso'] },
        { id: 'q5', texto: 'O que você espera encontrar aqui hoje?', opcoes: ['Entender por que sinto isso', 'Ferramentas práticas', 'Só desabafar e ser ouvido(a)', 'Ainda não sei, quero explorar'] }
      ]
    },
    {
      tema: 'estresse',
      categoria: 'saude_emocional',
      titulo: 'Estresse',
      perguntas: [
        { id: 'q1', texto: 'O que mais te incomoda hoje?', opcoes: ['Sobrecarga de tarefas e responsabilidades', 'Sensação de nunca ter tempo suficiente', 'Irritabilidade com pequenas coisas', 'Corpo sempre tenso, sem conseguir relaxar', 'Outro'] },
        { id: 'q2', texto: 'Há quanto tempo isso te acompanha?', opcoes: ['É recente', 'Já dura meses', 'Já dura mais de um ano', 'Sempre foi assim para mim'] },
        { id: 'q3', texto: 'O que você sente fisicamente nesses momentos?', opcoes: ['Tensão no corpo, dores de cabeça', 'Cansaço constante', 'Insônia', 'Irritação fácil'] },
        { id: 'q4', texto: 'O que você já tentou para lidar com isso?', opcoes: ['Nada ainda', 'Já tentei sozinho(a)', 'Já busquei ajuda profissional antes', 'Evito pensar nisso, sigo em frente'] },
        { id: 'q5', texto: 'O que você espera encontrar aqui hoje?', opcoes: ['Entender por que sinto isso', 'Ferramentas práticas', 'Só desabafar e ser ouvido(a)', 'Ainda não sei, quero explorar'] }
      ]
    },
    {
      tema: 'luto',
      categoria: 'saude_emocional',
      titulo: 'Luto',
      perguntas: [
        { id: 'q1', texto: 'O que mais pesa agora?', opcoes: ['A saudade que não passa', 'Sentimentos que não sei como lidar', 'Solidão depois da perda', 'Coisas que ficaram sem resposta ou sem despedida', 'Outro'] },
        { id: 'q2', texto: 'Há quanto tempo aconteceu a perda?', opcoes: ['É muito recente (dias ou semanas)', 'Já faz alguns meses', 'Já faz mais de um ano', 'Prefiro não datar exatamente'] },
        { id: 'q3', texto: 'O que você sente com mais frequência?', opcoes: ['Tristeza profunda', 'Vazio', 'Raiva', 'Um misto de emoções que mudam o tempo todo'] },
        { id: 'q4', texto: 'O que você já tentou para lidar com isso?', opcoes: ['Nada ainda', 'Já conversei com amigos ou família', 'Já fiz ou faço terapia', 'Evito falar sobre o assunto'] },
        { id: 'q5', texto: 'O que você espera encontrar aqui hoje?', opcoes: ['Entender o que estou sentindo', 'Um espaço para elaborar essa perda', 'Só desabafar e ser ouvido(a)', 'Ainda não sei, quero explorar'] }
      ]
    },
    {
      tema: 'solidao',
      categoria: 'saude_emocional',
      titulo: 'Solidão',
      perguntas: [
        { id: 'q1', texto: 'O que mais te incomoda hoje?', opcoes: ['Sinto falta de companhia ou conexão', 'Mesmo cercado(a) de gente, me sinto sozinho(a)', 'Dificuldade em me aproximar das pessoas', 'Perdi pessoas importantes ao longo do tempo', 'Outro'] },
        { id: 'q2', texto: 'Há quanto tempo isso te acompanha?', opcoes: ['Sempre foi assim', 'É recente', 'Já dura meses', 'Piorou depois de uma mudança na minha vida'] },
        { id: 'q3', texto: 'O que você sente com mais frequência?', opcoes: ['Tristeza', 'Vazio', 'Ansiedade', 'Desânimo'] },
        { id: 'q4', texto: 'O que você já tentou para lidar com isso?', opcoes: ['Nada ainda', 'Já tentei me aproximar de pessoas novas', 'Já fiz terapia/acompanhamento antes', 'Evito pensar nisso'] },
        { id: 'q5', texto: 'O que você espera encontrar aqui hoje?', opcoes: ['Entender por que me sinto assim', 'Ferramentas práticas', 'Só desabafar e ser ouvido(a)', 'Ainda não sei, quero explorar'] }
      ]
    },
    {
      tema: 'panico',
      categoria: 'saude_emocional',
      titulo: 'Pânico',
      perguntas: [
        { id: 'q1', texto: 'O que mais te incomoda hoje?', opcoes: ['Crises repentinas de medo intenso', 'Medo de ter uma crise em público', 'Sensações físicas fortes e inesperadas', 'Evito lugares ou situações por causa disso', 'Outro'] },
        { id: 'q2', texto: 'Há quanto tempo isso te acompanha?', opcoes: ['É recente', 'Já dura meses', 'Já dura mais de um ano', 'Vai e volta há tempos'] },
        { id: 'q3', texto: 'O que você sente durante esses momentos?', opcoes: ['Coração acelerado, falta de ar', 'Sensação de estar fora de controle', 'Tontura ou sensação de irrealidade', 'Medo intenso sem motivo aparente'] },
        { id: 'q4', texto: 'O que você já tentou para lidar com isso?', opcoes: ['Nada ainda', 'Já tentei sozinho(a)', 'Já fiz terapia/acompanhamento antes', 'Evito situações que possam desencadear isso'] },
        { id: 'q5', texto: 'O que você espera encontrar aqui hoje?', opcoes: ['Entender por que isso acontece', 'Ferramentas práticas para os momentos difíceis', 'Só desabafar e ser ouvido(a)', 'Ainda não sei, quero explorar'] }
      ]
    },
    {
      tema: 'depressao',
      categoria: 'saude_emocional',
      titulo: 'Depressão',
      ragIndexado: true,
      perguntas: [
        { id: 'q1', texto: 'O que mais te incomoda hoje?', opcoes: ['Falta de energia para as coisas do dia a dia', 'Perda de interesse no que antes gostava', 'Tristeza que não parece ter motivo claro', 'Dificuldade em sair da cama ou começar o dia', 'Outro'] },
        { id: 'q2', texto: 'Há quanto tempo isso te acompanha?', opcoes: ['É recente (últimas semanas)', 'Já dura meses', 'Já dura mais de um ano', 'Vai e volta há tempos'] },
        { id: 'q3', texto: 'O que você sente com mais frequência?', opcoes: ['Vazio', 'Cansaço constante', 'Desânimo', 'Isolamento, vontade de me afastar de tudo'] },
        { id: 'q4', texto: 'O que você já tentou para lidar com isso?', opcoes: ['Nada ainda', 'Já tentei sozinho(a)', 'Já fiz ou faço terapia/acompanhamento', 'Evito pensar nisso, sigo em frente'] },
        { id: 'q5', texto: 'O que você espera encontrar aqui hoje?', opcoes: ['Entender por que me sinto assim', 'Um espaço para começar a lidar com isso', 'Só desabafar e ser ouvido(a)', 'Ainda não sei, quero explorar'] }
      ]
    },
    {
      tema: 'nutricao',
      categoria: 'saude_fisica',
      titulo: 'Nutrição',
      perguntas: [
        { id: 'q1', texto: 'O que mais te incomoda hoje em relação à alimentação?', opcoes: ['Dificuldade em manter uma rotina alimentar saudável', 'Compulsão ou descontrole ao comer', 'Não sei por onde começar uma reeducação alimentar', 'Restrições ou dietas que não funcionam', 'Outro'] },
        { id: 'q2', texto: 'Há quanto tempo isso te acompanha?', opcoes: ['É recente', 'Já dura meses', 'Já dura mais de um ano', 'Sempre foi assim para mim'] },
        { id: 'q3', texto: 'O que você sente em relação à comida no dia a dia?', opcoes: ['Culpa depois de comer', 'Ansiedade relacionada à comida', 'Falta de prazer, é só obrigação', 'Confusão sobre o que é certo comer'] },
        { id: 'q4', texto: 'O que você já tentou para lidar com isso?', opcoes: ['Nada ainda', 'Já tentei dietas por conta própria', 'Já busquei acompanhamento nutricional', 'Evito pensar no assunto'] },
        { id: 'q5', texto: 'O que você espera encontrar aqui hoje?', opcoes: ['Entender minha relação com a comida', 'Orientações práticas', 'Só desabafar e ser ouvido(a)', 'Ainda não sei, quero explorar'] }
      ]
    },
    {
      tema: 'obesidade',
      categoria: 'saude_fisica',
      titulo: 'Obesidade',
      ragIndexado: true,
      perguntas: [
        { id: 'q1', texto: 'O que mais te incomoda hoje?', opcoes: ['Dificuldade em perder peso mesmo tentando', 'Compulsão alimentar', 'Impacto do peso na minha saúde e disposição', 'Julgamento ou vergonha relacionados ao meu corpo', 'Outro'] },
        { id: 'q2', texto: 'Há quanto tempo isso te acompanha?', opcoes: ['Sempre foi assim', 'Começou há alguns anos', 'É mais recente (últimos meses)', 'Piorou depois de algo específico'] },
        { id: 'q3', texto: 'O que você sente em relação a isso no dia a dia?', opcoes: ['Frustração', 'Cansaço físico', 'Vergonha', 'Desânimo para tentar de novo'] },
        { id: 'q4', texto: 'O que você já tentou para lidar com isso?', opcoes: ['Nada ainda', 'Já tentei dietas ou exercícios por conta própria', 'Já busquei acompanhamento médico/nutricional', 'Evito o assunto'] },
        { id: 'q5', texto: 'O que você espera encontrar aqui hoje?', opcoes: ['Entender melhor o que sinto sobre isso', 'Orientações práticas', 'Só desabafar e ser ouvido(a)', 'Ainda não sei, quero explorar'] }
      ]
    },
    {
      tema: 'longevidade',
      categoria: 'saude_fisica',
      titulo: 'Longevidade',
      perguntas: [
        { id: 'q1', texto: 'O que mais te motiva a pensar nisso hoje?', opcoes: ['Quero envelhecer com mais qualidade de vida', 'Percebo mudanças no corpo que me preocupam', 'Quero manter energia e disposição por mais tempo', 'Curiosidade sobre hábitos de longevidade', 'Outro'] },
        { id: 'q2', texto: 'Há quanto tempo você pensa sobre isso?', opcoes: ['É recente', 'Já dura meses', 'Já dura anos', 'Aumentou depois de algo específico (idade, exame, evento)'] },
        { id: 'q3', texto: 'O que você sente em relação ao seu corpo hoje?', opcoes: ['Preocupação', 'Motivação para cuidar mais', 'Cansaço com tentativas anteriores', 'Curiosidade'] },
        { id: 'q4', texto: 'O que você já tentou nesse sentido?', opcoes: ['Nada ainda', 'Já tentei mudanças por conta própria', 'Já busquei acompanhamento profissional', 'Comecei e não mantive'] },
        { id: 'q5', texto: 'O que você espera encontrar aqui hoje?', opcoes: ['Orientações práticas', 'Entender melhor meu corpo e hábitos', 'Só trocar ideias sobre o tema', 'Ainda não sei, quero explorar'] }
      ]
    },
    {
      tema: 'menopausa',
      categoria: 'saude_fisica',
      titulo: 'Menopausa',
      perguntas: [
        { id: 'q1', texto: 'O que mais te incomoda hoje?', opcoes: ['Ondas de calor ou desconforto físico', 'Alterações de humor', 'Mudanças no corpo (peso, pele, disposição)', 'Falta de informação clara sobre o que está acontecendo', 'Outro'] },
        { id: 'q2', texto: 'Há quanto tempo você percebe essas mudanças?', opcoes: ['É recente (últimos meses)', 'Já dura mais de um ano', 'Começou há alguns anos', 'Ainda não comecei, mas me preocupo com isso'] },
        { id: 'q3', texto: 'O que você sente com mais frequência nessa fase?', opcoes: ['Irritabilidade', 'Cansaço', 'Insegurança sobre o próprio corpo', 'Tristeza ou instabilidade emocional'] },
        { id: 'q4', texto: 'O que você já tentou para lidar com isso?', opcoes: ['Nada ainda', 'Já busquei acompanhamento médico', 'Já tentei mudanças por conta própria', 'Evito falar sobre o assunto'] },
        { id: 'q5', texto: 'O que você espera encontrar aqui hoje?', opcoes: ['Entender melhor o que estou vivendo', 'Orientações práticas', 'Só desabafar e ser ouvida', 'Ainda não sei, quero explorar'] }
      ]
    },
    {
      tema: 'desempenho_fisico',
      categoria: 'saude_fisica',
      titulo: 'Desempenho Físico',
      perguntas: [
        { id: 'q1', texto: 'O que mais te incomoda hoje?', opcoes: ['Falta de energia para o dia a dia', 'Queda no desempenho físico ou disposição', 'Falta de vontade ou desejo, mesmo sem motivo aparente', 'Dificuldade em manter uma rotina de cuidado com o corpo', 'Outro'] },
        { id: 'q2', texto: 'Há quanto tempo isso te acompanha?', opcoes: ['É recente', 'Já dura meses', 'Já dura mais de um ano', 'Vem piorando aos poucos'] },
        { id: 'q3', texto: 'O que você sente com mais frequência?', opcoes: ['Cansaço', 'Desânimo', 'Frustração com o próprio corpo', 'Preocupação sobre o que pode estar causando isso'] },
        { id: 'q4', texto: 'O que você já tentou para lidar com isso?', opcoes: ['Nada ainda', 'Já tentei mudanças por conta própria', 'Já busquei acompanhamento profissional', 'Evito pensar nisso'] },
        { id: 'q5', texto: 'O que você espera encontrar aqui hoje?', opcoes: ['Entender o que pode estar acontecendo', 'Orientações práticas', 'Só desabafar e ser ouvido(a)', 'Ainda não sei, quero explorar'] }
      ]
    },
    {
      tema: 'saude_mental_cognitiva',
      categoria: 'mente_e_proposito',
      titulo: 'Saúde Mental (desempenho, memória, cognição)',
      perguntas: [
        { id: 'q1', texto: 'O que mais te incomoda hoje?', opcoes: ['Dificuldade de concentração', 'Esquecimentos frequentes', 'Sensação de que meu raciocínio está mais lento', 'Dificuldade em aprender coisas novas como antes', 'Outro'] },
        { id: 'q2', texto: 'Há quanto tempo isso te acompanha?', opcoes: ['É recente', 'Já dura meses', 'Já dura mais de um ano', 'Piorou aos poucos, ao longo do tempo'] },
        { id: 'q3', texto: 'O que você sente quando percebe isso?', opcoes: ['Frustração', 'Preocupação', 'Insegurança', 'Cansaço mental'] },
        { id: 'q4', texto: 'O que você já tentou para lidar com isso?', opcoes: ['Nada ainda', 'Já tentei estratégias por conta própria', 'Já busquei avaliação profissional', 'Evito pensar nisso'] },
        { id: 'q5', texto: 'O que você espera encontrar aqui hoje?', opcoes: ['Entender melhor o que está acontecendo', 'Orientações práticas', 'Só desabafar e ser ouvido(a)', 'Ainda não sei, quero explorar'] }
      ]
    },
    {
      tema: 'sentimentos_adolescencia',
      categoria: 'mente_e_proposito',
      titulo: 'Sentimentos Confusos',
      ragIndexado: true,
      perguntas: [
        { id: 'q1', texto: 'O que mais te incomoda hoje?', opcoes: ["Sinto várias coisas ao mesmo tempo e não sei nomear", 'Mudanças bruscas de humor', 'Reações que eu mesmo(a) não entendo', "Medo de estar 'exagerando' o que sinto", 'Outro'] },
        { id: 'q2', texto: 'Há quanto tempo isso te acompanha?', opcoes: ['É recente', 'Já dura meses', 'Já dura mais de um ano', 'Sempre foi assim comigo'] },
        { id: 'q3', texto: 'Qual sentimento aparece com mais força ultimamente?', opcoes: ['Ciúme', 'Medo', 'Tristeza', 'Uma mistura difícil de separar'] },
        { id: 'q4', texto: 'O que você já tentou para lidar com isso?', opcoes: ['Nada ainda', 'Já tentei entender sozinho(a)', 'Já fiz terapia/acompanhamento antes', 'Evito pensar nisso'] },
        { id: 'q5', texto: 'O que você espera encontrar aqui hoje?', opcoes: ['Colocar ordem no que sinto', 'Ferramentas práticas', 'Só desabafar e ser ouvido(a)', 'Ainda não sei, quero explorar'] }
      ]
    },
    {
      tema: 'desenvolvimento_humano',
      categoria: 'mente_e_proposito',
      titulo: 'Desenvolvimento Humano',
      perguntas: [
        { id: 'q1', texto: 'O que mais te move a buscar isso hoje?', opcoes: ['Sensação de estar vivendo no automático', 'Busca por mais propósito ou sentido', 'Vontade de me conhecer mais profundamente', 'Curiosidade sobre espiritualidade e consciência', 'Outro'] },
        { id: 'q2', texto: 'Há quanto tempo essa busca está presente?', opcoes: ['É recente', 'Já dura meses', 'Já dura anos', 'Sempre esteve comigo, de alguma forma'] },
        { id: 'q3', texto: 'O que você sente quando pensa nessa busca?', opcoes: ['Curiosidade', 'Inquietação', 'Esperança', 'Um misto de tudo isso'] },
        { id: 'q4', texto: 'O que você já tentou nesse caminho?', opcoes: ['Nada ainda, é o início', 'Já li ou estudei sobre o tema', 'Já pratiquei algo (meditação, terapia, etc.)', 'Já tentei e me afastei'] },
        { id: 'q5', texto: 'O que você espera encontrar aqui hoje?', opcoes: ['Mais clareza sobre mim mesmo(a)', 'Ferramentas práticas', 'Só refletir e ser ouvido(a)', 'Ainda não sei, quero explorar'] }
      ]
    },
    {
      tema: 'psicologia_financeira',
      categoria: 'mente_e_proposito',
      titulo: 'Psicologia Financeira',
      perguntas: [
        { id: 'q1', texto: 'O que mais te incomoda hoje sobre dinheiro?', opcoes: ['Dificuldade em administrar o que ganho', 'Sensação de que nunca é suficiente', 'Medo de arriscar ou investir', 'Padrões que se repetem (endividamento, gastos por impulso)', 'Outro'] },
        { id: 'q2', texto: 'Há quanto tempo isso te acompanha?', opcoes: ['Sempre foi assim', 'Começou há alguns anos', 'É recente (últimos meses)', 'Piorou depois de algo específico'] },
        { id: 'q3', texto: 'O que você sente quando pensa em dinheiro?', opcoes: ['Ansiedade', 'Vergonha', 'Frustração', 'Evito pensar, prefiro não olhar'] },
        { id: 'q4', texto: 'O que você já tentou para lidar com isso?', opcoes: ['Nada ainda', 'Já tentei organizar sozinho(a)', 'Já busquei orientação profissional', 'Evito o assunto'] },
        { id: 'q5', texto: 'O que você espera encontrar aqui hoje?', opcoes: ['Entender minha relação com dinheiro', 'Ferramentas práticas', 'Só desabafar e ser ouvido(a)', 'Ainda não sei, quero explorar'] }
      ]
    },
    {
      tema: 'produtividade',
      categoria: 'mente_e_proposito',
      titulo: 'Produtividade',
      perguntas: [
        { id: 'q1', texto: 'O que mais te incomoda hoje?', opcoes: ['Sensação de nunca dar conta de tudo', 'Dificuldade em focar no que importa', 'Procrastinação frequente', 'Excesso de tarefas manuais que poderiam ser otimizadas', 'Outro'] },
        { id: 'q2', texto: 'Há quanto tempo isso te acompanha?', opcoes: ['É recente', 'Já dura meses', 'Já dura mais de um ano', 'Sempre foi assim para mim'] },
        { id: 'q3', texto: 'O que você sente quando pensa na sua rotina?', opcoes: ['Sobrecarga', 'Frustração', 'Ansiedade com prazos', 'Desânimo, sinto que não avanço'] },
        { id: 'q4', texto: 'O que você já tentou para lidar com isso?', opcoes: ['Nada ainda', 'Já tentei métodos ou ferramentas por conta própria', 'Já busquei orientação profissional', 'Evito pensar nisso, sigo empurrando'] },
        { id: 'q5', texto: 'O que você espera encontrar aqui hoje?', opcoes: ['Clareza sobre o que priorizar', 'Ferramentas práticas', 'Só desabafar e ser ouvido(a)', 'Ainda não sei, quero explorar'] }
      ]
    }
  ]
};
