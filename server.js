import bcrypt from 'bcrypt';
import express from 'express';
import session from 'express-session';
import methodOverride from 'method-override';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { MongoClient } from 'mongodb';
import path from 'path';
import { fileURLToPath } from 'url';

const API_KEY = "AIzaSyDclaiuUXoTh912s8SBYzOon0B2FB70plg";
const app = express();
const porta = 3000;

// Obter o __dirname usando fileURLToPath
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware para processar dados JSON e formulários
app.use(methodOverride('_method'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
  secret: 'segredo-super-seguro',
  resave: false,
  saveUninitialized: true,
}));

// Diretório público para arquivos estáticos
app.use(express.static('public'));

// Configuração da URL de conexão com o MongoDB
const url = 'mongodb://127.0.0.1:27017';
const dbName = 'Cursos';
const collectionName = 'inscricoes';
const logCollectionName = 'logs'; // Nova coleção para logs de login

// Função para garantir que a resposta está no tema de economia criativa
function verificarTema(responseText) {
  const palavrasChave = [
    "economia criativa", "criação", "inovação", "cultura", "negócios criativos", "arte",
    "design", "indústria criativa", "empreendedorismo criativo", "produção cultural"
  ];
  const textoLower = responseText.toLowerCase();
  for (let palavra of palavrasChave) {
    if (textoLower.includes(palavra)) {
      return true;
    }
  }
  return false;
}

// Função para retornar a descrição do projeto
function descricaoProjeto() {
  return `O objetivo do nosso site é divulgar e fortalecer o conceito de economia criativa como um motor de inovação, cultura e desenvolvimento sustentável. 
  Nosso site busca educar e capacitar profissionais por meio de cursos especializados que atendem a diversas áreas dentro da economia criativa, 
  além de oferecer mentoria e orientação prática para ajudar criadores a transformar suas ideias em negócios viáveis. 
  Também visamos criar uma comunidade ativa e colaborativa, onde profissionais podem compartilhar experiências, buscar oportunidades e crescer juntos, 
  facilitando o networking e a troca de conhecimentos. Conectamos pessoas com os recursos certos, como cursos, mentores e redes de contato, 
  promovendo o sucesso em um mercado criativo cada vez mais competitivo.`;
}


// Rotas
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/cursos', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'cursos.html'));
});

app.get('/sobre', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'sobre.html'));
});

app.get('/crud', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'crud.html'));
});

app.get('/cadastro', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'cadastro.html'));
});

app.get('/adicionar', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'adicionar.html'));
});

// Rota para exibir a página de contato
app.get('/contato', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'contato.html'));
});

// Rota para exibir a página de login
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'views', 'login.html'));
});

// Rota para exibir a página de sucesso
app.get('/sucesso', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'sucesso.html'));
});

// Rota para lidar com a submissão do formulário de inscrição de cursos
app.post('/cursos', async (req, res) => {
  const novaInscricao = req.body; // Dados da inscrição enviados pelo formulário
  const cliente = new MongoClient(url);

  try {
    await cliente.connect();
    const db = cliente.db(dbName);
    const collection = db.collection(collectionName);

    const result = await collection.insertOne(novaInscricao);
    console.log(`Inscrição cadastrada com sucesso. ID: ${result.insertedId}`);

    // Redirecionar para a página de sucesso após a inscrição
    res.redirect('/sucesso');
  } catch (err) {
    console.error('Erro ao cadastrar a inscrição:', err);
    res.status(500).send('Erro ao cadastrar a inscrição. Por favor, tente novamente mais tarde.');
  } finally {
    await cliente.close();
  }
});

// Rota para lidar com a autenticação de login
app.post('/login', async (req, res) => {
  const cliente = new MongoClient(url);

  try {
    await cliente.connect();
    const banco = cliente.db(dbName);
    const colecaoUsuarios = banco.collection('usuarios');

    const usuarioUsuarios = await colecaoUsuarios.findOne({ usuario: req.body.usuario });

    if (usuarioUsuarios && await bcrypt.compare(req.body.senha, usuarioUsuarios.senha)) {
      req.session.usuario = req.body.usuario;

      // Logando os dados de login
      const loginLog = {
        usuario: req.body.usuario,
        ip: req.ip,
        dataHora: new Date(),
      };

      await banco.collection(logCollectionName).insertOne(loginLog); // Armazena o log no MongoDB
      res.redirect('/');
    } else {
      res.send('Usuário ou senha inválidos.');
    }
  } catch (erro) {
    res.send('Erro ao realizar login: ' + erro.message);
  } finally {
    await cliente.close();
  }
});

// Protegendo a rota meusCursos
app.get('/', protegerRota, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Função para proteger rotas
function protegerRota(req, res, proximo) {
  if (req.session.usuario) {
    proximo();
  } else {
    res.redirect('/login');
  }
}

// Rota de registro
app.get('/registro', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'views', 'registro.html'));
});

app.post('/registro', async (req, res) => {
  const cliente = new MongoClient(url);
  try {
    await cliente.connect();
    const banco = cliente.db(dbName);
    const colecaoUsuarios = banco.collection('usuarios');

    const usuarioExistente = await colecaoUsuarios.findOne({ usuario: req.body.usuario });

    if (usuarioExistente) {
      res.send('Usuário já existe! Tente outro nome de usuário');
    } else {
      const senhaCriptografada = await bcrypt.hash(req.body.senha, 10);
      await colecaoUsuarios.insertOne({
        usuario: req.body.usuario,
        senha: senhaCriptografada
      });
      res.redirect('/login');
    }
  } catch (erro) {
    res.send('Erro ao registrar usuário: ' + erro.message);
  } finally {
    cliente.close();
  }
});

// Rota para exibir a página de erro
app.get('/erro', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'views', 'erro.html'));
});

// Rota para exibir a página de bem-vindo
app.get('/bemvindo', protegerRota, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'views', 'bemvindo.html'));
});

// Rota para sair
app.get('/sair', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.send('Erro ao sair!');
    }
    res.redirect('/login');
  });
});

//Cadastrar

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride('_method'));


app.get('/cadastro', (req, res) => {
    res.sendFile(__dirname + '/cadastro.html');
});

app.post('/cadastro', async (req, res) => {
    const novoCurso = req.body;

    const client = new MongoClient(url);

    try {
        await client.connect();

        const db = client.db(dbName);
        const collection = db.collection(collectionName);

        const result = await collection.insertOne(novoCurso);
        console.log(`Curso cadastrado com sucesso. ID: ${result.insertedId}`);

        res.redirect('/');
    } catch (err) {
        console.error('Erro ao cadastrar o curso:', err);
        res.status(500).send('Erro ao cadastrar o curso. Por favor, tente novamente mais tarde.');
    } finally {
        client.close();
    }
});

app.get('/atualizar', (req, res) => {
    res.sendFile(__dirname + '/atualizar.html');
});

app.post('/atualizar', async (req, res) => {
    const { id, titulo, disponivel, urlimg } = req.body;

    const client = new MongoClient(url);

    try {
        await client.connect();

        const db = client.db(dbName);
        const collection = db.collection(collectionName);

        const result = await collection.updateOne(
            { _id: new ObjectId(id) },
            {
                $set: {titulo, disponivel: disponivel === "true", urlimg
                }
            }
        );

        if (result.modifiedCount > 0) {
            console.log(`Curso com ID: ${id} atualizado com sucesso.`);
            res.redirect('/');
        } else {
            res.status(404).send('Curso não encontrado.');
        }
    } catch (err) {
        console.error('Erro ao atualizar o curso:', err);
        res.status(500).send('Erro ao atualizar o curso. Por favor, tente novamente mais tarde.');
    } finally {
        client.close();
    }
});

app.get('/curso/:id', async (req,res) => {
    const { id } = req.params;

    const client = new MongoClient(url);

    try{
        await client.connect();
        const db = client.db(dbName);
        const colection = db.collection(collectionName);

        const curso = await colection.findOne({ _id: new ObjectId(id) });

        if (!curso) {
            return res.status(404).send('Curso não encontrado');
        }

        res.json(curso);
    } catch (err) {
        console.error(`Erro ao buscar o curso`, err);
        res.status(500).send('Erro ao buscar o curso. Por favor, tente novamente mais tarde.');
    } finally {
        client.close();
    }
});

app.post('/deletar', async (req, res) => {
    const { id } = req.body;

    const client = new MongoClient(url);

    try {
        await client.connect();

        const db = client.db(dbName);
        const collection = db.collection(collectionName);

        const result = await collection.deleteOne({ _id: new ObjectId(id) });

        if (result.deletedCount > 0) {
            console.log(`Curso com ID: ${id} deletado com sucesso.`);
            res.redirect('/');
        } else {
            res.status(404).send('Curso não encontrado:');
        }
    } catch (err) {
        console.error('Erro ao deletar o curso:', err);
        res.status(500).send('Erro ao deletar o curso. Por Favor, tente novamente mais tarde.');
    } finally {
        client.close();
    }
});

app.get('/cursos', async (req, res) => {
    const client = new MongoClient(url);

    try{
        await client.connect();
        const db = client.db(dbName);
        const collection = db.collection(collectionName);

        const cursos = await collection.find({}, {projection: { _id: 1, titulo: 1, urlimg: 1 } }).toArray();

        res.json(cursos);
    } catch (err) {
        console.error(`Erro ao buscar curso:`, err);
        res.status(500).send('Erro ao buscar cursos. Por favor, tente novamente mais tarde.');
    } finally {
        client.close();
    }
});

//Chat
// Configuração do modelo de IA (Google Generative AI)
const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.0-pro" });
const GENERATION_CONFIG = {
  temperature: 0.9,
  topK: 1,
  topP: 1,
  maxOutputTokens: 2048,
};

const SAFETY_SETTING = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];

// Rota para exibir a página de chat
app.get('/chat', protegerRota, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'chat.html'));
});

app.post('/chat', async (req, res) => {
  const userInput = req.body.userInput.toLowerCase();  // Tornar a entrada do usuário em minúsculas para facilitar a comparação
  console.log('Input do usuário:', userInput);

  try {
    // Palavras-chave sobre o projeto
    const palavrasChaveProjeto = [
      "sobre o projeto", "qual é o objetivo do projeto", "o que é o projeto", "fale sobre o projeto", 
      "projeto", "objetivo do site", "o que o site faz"
    ];

    // Palavras-chave sobre Economia Criativa
    const palavrasChaveEconomiaCriativa = [
      "economia criativa", "o que é economia criativa", "definição de economia criativa", "fale sobre economia criativa"
    ];

    // Palavras-chave sobre Uso da IA
    const palavrasChaveUsoIA = [
      "uso da ia", "como a ia é aplicada", "inteligência artificial no site", "como a ia ajuda", "ia no site"
    ];

    // Verificar se a entrada é sobre o projeto
    const isPerguntaSobreProjeto = palavrasChaveProjeto.some(palavra => userInput.includes(palavra));
    if (isPerguntaSobreProjeto) {
      return res.json({
        response: `O objetivo do site é divulgar e fortalecer o conceito de economia criativa como um motor de inovação, cultura e desenvolvimento sustentável. 
        Ele busca educar e capacitar profissionais por meio de cursos especializados que atendem a diversas áreas dentro da economia criativa, 
        além de oferecer mentoria e orientação prática para ajudar criadores a transformar suas ideias em negócios viáveis. 
        O site também visa criar uma comunidade ativa e colaborativa onde profissionais podem compartilhar experiências, buscar oportunidades e crescer juntos, 
        facilitando o networking e a troca de conhecimentos. Por fim, o site conecta pessoas com os recursos certos, como cursos, mentores e redes de contato, 
        promovendo o sucesso em um mercado criativo cada vez mais competitivo.`
      });
    }

    // Verificar se a entrada é sobre Economia Criativa
    const isPerguntaSobreEconomiaCriativa = palavrasChaveEconomiaCriativa.some(palavra => userInput.includes(palavra));
    if (isPerguntaSobreEconomiaCriativa) {
      return res.json({
        response: `Economia criativa é um setor econômico que envolve atividades que têm origem em talentos individuais e criatividade. 
        A economia criativa abrange áreas como arte, design, música, moda, gastronomia, publicidade, software, jogos digitais e muitas outras, 
        impulsionando a inovação, a geração de empregos e o desenvolvimento sustentável. As indústrias criativas são fundamentais para o crescimento de uma sociedade 
        ao transformar ideias criativas em valor econômico, melhorando a qualidade de vida e estimulando a cultura e a inovação em diferentes setores.`
      });
    }

    // Verificar se a entrada é sobre o uso da IA no site
    const isPerguntaSobreUsoIA = palavrasChaveUsoIA.some(palavra => userInput.includes(palavra));
    if (isPerguntaSobreUsoIA) {
      return res.json({
        response: `A IA será aplicada em nosso site de Economia Criativa de várias maneiras. Primeiramente, utilizaremos algoritmos para personalizar o conteúdo com base 
        nos padrões de uso e comportamento dos usuários, recomendando cursos e recursos relevantes para cada visitante. Além disso, configuraremos um chatbot 
        que utilizará a IA para responder a perguntas frequentes e ajudar os visitantes a navegar pelo site, oferecendo atendimento imediato e eficiente. 
        A IA também será utilizada para analisar os dados de interação, permitindo-nos identificar padrões e tendências, o que ajudará na co-criação de conteúdos 
        sobre economia criativa, otimizando a experiência do usuário e os recursos oferecidos pelo site.`
      });
    }

    // Caso a entrada não seja relacionada a nenhum dos tópicos acima, interagir com o modelo de IA sobre economia criativa
    const chat = await model.startChat({
      generationConfig: GENERATION_CONFIG,
      safetySettings: SAFETY_SETTING,
      history: [],
    });

    console.log('Chat iniciado com sucesso.');

    // Envia a primeira mensagem (sobre o tópico de economia criativa)
    const firstMessageResult = await chat.sendMessage("Vamos falar exclusivamente sobre economia criativa.");
    console.log('Resultado após primeira mensagem:', firstMessageResult);

    if (firstMessageResult.error) {
      console.error('Erro ao iniciar conversa:', firstMessageResult.error);
      return res.status(500).json({ error: firstMessageResult.error.message });
    }

    // Envia a mensagem do usuário
    const result = await chat.sendMessage(userInput);
    console.log('Resultado após enviar mensagem do usuário:', result);

    if (result.error) {
      console.error('Erro ao enviar a mensagem do usuário:', result.error);
      return res.status(500).json({ error: result.error.message });
    }

    console.log('Resposta completa do modelo:', JSON.stringify(result, null, 2));

    if (result && result.response && result.response.candidates && result.response.candidates.length > 0) {
      let responseText = result.response.candidates[0].content.parts[0].text;

      if (!verificarTema(responseText)) {
        responseText = "Por favor, fale sobre economia criativa.";
      }

      console.log('Resposta final do modelo:', responseText);
      return res.json({ response: responseText });
    } else {
      console.error('A resposta do modelo não contém a estrutura esperada:', result);
      return res.status(500).json({ error: 'Resposta do modelo não foi recebida corretamente.' });
    }

  } catch (error) {
    console.error('Erro no chat:', error.message);
    return res.status(500).json({ error: 'Erro ao processar a mensagem do chat.' });
  }
});




app.listen(porta, () => {
  console.log(`Servidor Node.js em execução em http://localhost:${porta}`);
});