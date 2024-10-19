const express = require('express');
const path = require('path');
const pg = require('pg');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config(); 
const app = express();
app.use(cors());
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
const port = 3000;

const config = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    port: process.env.DB_PORT || 5432,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
};

const db = new pg.Client(config);

db.connect(err => {
    if (err) {
        console.error('Error connecting to the database:', err.stack);
        return;
    }
    console.log('Connected to the database');
   // queryDatabase();
});

function getTransacaoComIcone(transacao) {
    let icon;
    if (transacao.tipo === 'entrada') {
        icon = '<i class="fas fa-arrow-up"></i>';
    } else {
        icon = '<i class="fas fa-arrow-down"></i>';
    }
    return `${transacao.tipo} ${transacao.valor} ${transacao.data} ${icon} ${transacao.nome_do_item}`;
}

app.get('/', (req, res) => {
    // Consulta principal
    const query = `
        SELECT 
    SUM(CASE WHEN tipo = 'entrada' AND fechado = FALSE THEN valor ELSE 0 END) AS total_entrada,
    SUM(CASE WHEN tipo = 'saida' AND fechado = FALSE THEN valor ELSE 0 END) AS total_saida,
    (SUM(CASE WHEN tipo = 'entrada' AND fechado = FALSE THEN valor ELSE 0 END) - 
     SUM(CASE WHEN tipo = 'saida' AND fechado = FALSE THEN valor ELSE 0 END)) AS saldo,
    SUM(CASE WHEN tipo = 'entrada' AND data::date = CURRENT_DATE AND fechado = FALSE THEN valor ELSE 0 END) AS total_entrada_dia,
    SUM(CASE WHEN tipo = 'saida' AND data::date = CURRENT_DATE AND fechado = FALSE THEN valor ELSE 0 END) AS total_saida_dia,
    SUM(CASE WHEN tipo = 'entrada' AND date_trunc('week', data) = date_trunc('week', CURRENT_DATE) AND fechado = FALSE THEN valor ELSE 0 END) AS total_entrada_semana,
    SUM(CASE WHEN tipo = 'saida' AND date_trunc('week', data) = date_trunc('week', CURRENT_DATE) AND fechado = FALSE THEN valor ELSE 0 END) AS total_saida_semana,
    SUM(CASE WHEN tipo = 'entrada' AND date_part('month', data) = date_part('month', CURRENT_DATE) AND fechado = FALSE THEN valor ELSE 0 END) AS total_entrada_mes,
    SUM(CASE WHEN tipo = 'saida' AND date_part('month', data) = date_part('month', CURRENT_DATE) AND fechado = FALSE THEN valor ELSE 0 END) AS total_saida_mes
FROM transacoes;
    `;

    // Consulta para dados apenas do dia
    const queryToday = `
         SELECT
                id,
                tipo,
                forma_pagamento,
                valor,
                nome_do_item,
                Descricao,
                to_char(data, 'YYYY-MM-DD') AS data
            FROM transacoes
            WHERE data::date = CURRENT_DATE;
    `;

    db.query(query, (err, result) => {
        if (err) {
            console.error('Erro na consulta:', err);
            return;
        }
        
        if (result.rows.length === 0) {
            console.error('Nenhum resultado encontrado');
            return;
        }
        
       // Acessando as linhas retornadas corretamente
    const saldo = parseFloat(result.rows[0].saldo) || 0;
    console.log('Saldo:', saldo);
    const total_entrada = parseFloat(result.rows[0].total_entrada) || 0;
    const total_saida = parseFloat(result.rows[0].total_saida) || 0;

    const total_entrada_dia = parseFloat(result.rows[0].total_entrada_dia) || 0;
    const total_saida_dia = parseFloat(result.rows[0].total_saida_dia) || 0;

    const total_entrada_semana = parseFloat(result.rows[0].total_entrada_semana) || 0;
    const total_saida_semana = parseFloat(result.rows[0].total_saida_semana) || 0;

    const total_entrada_mes = parseFloat(result.rows[0].total_entrada_mes) || 0;
    const total_saida_mes = parseFloat(result.rows[0].total_saida_mes) || 0;
    
        // Executa a consulta para dados apenas do dia
        db.query(queryToday, (err, transacoesDoDia) => {
          //  if (err) return next(err);

            // Executa a consulta principal para todos os dados
            const queryTransacoes = `
                 SELECT
                id,
                tipo,
                forma_pagamento,
                valor,
                nome_do_item,
                Descricao,
                to_char(data, 'YYYY-MM-DD') AS data
            FROM transacoes
            WHERE data::date = CURRENT_DATE;

            `;

            db.query(queryTransacoes, (err, transacoes) => {
              //  if (err) return next(err);
              console.log("transações", transacoes ? transacoes.rows : []),
              console.log("transaçõesDoDia", transacoesDoDia ? transacoesDoDia.rows : []),
                res.render('index', {
                    saldo: saldo,
                   total_entrada: total_entrada,
                    total_saida: total_saida,
                    total_entrada_dia: total_entrada_dia,
                    total_saida_dia: total_saida_dia,
                    total_entrada_semana: total_entrada_semana,
                    total_saida_semana: total_saida_semana,
                    total_entrada_mes: total_entrada_mes,
                    total_saida_mes: total_saida_mes,
                    transacoes: transacoes ? transacoes.rows : [],                    
                    transacoesDoDia: transacoesDoDia ? transacoesDoDia.rows : [], // Dados apenas do dia
                    getTransacaoComIcone: getTransacaoComIcone
                    
                });
            });
        });
    });
});

app.get('/edit-transacao/:id', (req, res) => {
    const { id } = req.params;
    const query = 'SELECT * FROM transacoes WHERE id = $1';
    db.query(query, [id], (err, result) => {
       // if (err) return next(err);
        if (result.length > 0) {
            res.render('edit', { transacao: result[0] });
        } else {
            res.redirect('/');
        }
    });
});

app.post('/add-transacao', (req, res) => {
    try {
        console.log("Dados recebidos:", req.body); // Verifique o que está sendo recebido
        const { tipo, valor, forma_pagamento, nome_do_item, descricao } = req.body;

        const valorNum = parseFloat(valor);
        const query = `
            INSERT INTO transacoes (tipo, valor, forma_pagamento, nome_do_item, descricao, fechado, data)
            VALUES ($1, $2, $3, $4, $5, FALSE, CURRENT_DATE);
        `;

        console.log("Consulta:", query);
        // Executando a consulta com os parâmetros corretos
        db.query(query, [tipo, valorNum, forma_pagamento, nome_do_item, descricao], (err, result) => {
            console.log("Executando consulta..."); // Log adicionado
            if (err) {
                console.error("Erro ao executar a consulta:", err);
                return res.status(500).send('Erro ao inserir a transação');
            }
            console.log("Consulta executada com sucesso:", result);
            res.redirect('/');
        });
    } catch (e) {
        console.error("Erro ao adicionar transação:", e);
        res.status(500).send('Erro ao adicionar a transação');
    }
});





app.post('/update-transacao', (req, res) => {
    const { id, nome_do_item, tipo, valor, data, forma_pagamento, descricao } = req.body;
    const query = `
        UPDATE transacoes
        SET tipo = $1, valor = $2, data = $3, forma_pagamento = $4, nome_do_item = $5, descricao = $6
        WHERE id = $7;
    `;
    db.query(query, [tipo, valor, data, forma_pagamento, nome_do_item, descricao, id], (err, result) => {
       // if (err) return next(err);
       console.log("Consulta executada com sucesso:", result);
        res.redirect('/');
    });
});

app.post('/delete-transacao', (req, res) => {
    const { id } = req.body;
    const query = 'DELETE FROM transacoes WHERE id = $1';
    db.query(query, [id], (err, result) => {
      //  if (err) return next(err);
        res.redirect('/');
    });
});
// Backend (Express.js) - Exemplo de rota para pesquisa
app.get('/', async (req, res) => {
    const nomeDoItem = req.query.NOME_DO_ITEM || '';

    try {
        // Filtre as transações com base na pesquisa
        const transacoes = await buscarTransacoes(nomeDoItem);

        // Renderize a página com os resultados da pesquisa
        res.render('index', {
            transacoes: transacoes,
            saldo: calcularSaldo(transacoes),
            total_entrada: calcularTotalEntrada(transacoes),
            total_saida: calcularTotalSaida(transacoes),
            total_entrada_dia: calcularTotalEntradaDia(transacoes),
            total_saida_dia: calcularTotalSaidaDia(transacoes),
            nome_do_item: nomeDoItem
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Erro ao buscar transações.');
    }
});


app.post('/fechar-caixa', (req, res) => {
    const query = 'UPDATE transacoes SET fechado = TRUE WHERE fechado = FALSE';
    db.query(query, (err, result) => {
       // if (err) return next(err);
        res.redirect('/');
    });
});

app.get('/search', (req, res) => {
    const { nome_do_item } = req.query;
    const query = `
        SELECT
    id,
    tipo,
    forma_pagamento,
    valor,
    "NOME_DO_ITEM",
    Descricao,
    to_char(data, 'YYYY-MM-DD') AS data
FROM transacoes
WHERE "NOME_DO_ITEM" ILIKE $1;

    `;

    db.query(query, [`%${nome_do_item}%`], (err, transacoes) => {
        if (err) {
            console.error(err);
            res.status(500).send('Erro ao buscar transações.');
            return;
        }
        res.render('index', {
            transacoes: transacoes,
            NOME_DO_ITEM: nome_do_item, // Passa o valor de pesquisa para a view
            getTransacaoComIcone: getTransacaoComIcone
        });
    });
});
app.get('/relatorio-mensal', (req, res) => {
    const { mes, ano } = req.query;

    // Consulta SQL para somar as entradas e saídas do mês especificado
    const resumoQuery = `
        SELECT
            SUM(CASE WHEN tipo = 'entrada' THEN valor ELSE 0 END) AS total_entrada_mes,
            SUM(CASE WHEN tipo = 'saida' THEN valor ELSE 0 END) AS total_saida_mes,
            (SUM(CASE WHEN tipo = 'entrada' THEN valor ELSE 0 END) - SUM(CASE WHEN tipo = 'saida' THEN valor ELSE 0 END)) AS saldo_mes
        FROM transacoes
        WHERE EXTRACT(MONTH FROM data) = $1 AND EXTRACT(YEAR FROM data) = $2;
    `;

    // Consulta SQL para obter todas as transações do mês especificado
    const transacoesQuery = `
        SELECT
            id,
            tipo,
            forma_pagamento,
            valor,
            nome_do_item,
            descricao,
            to_char(data, 'YYYY-MM-DD') AS data
        FROM transacoes
        WHERE EXTRACT(MONTH FROM data) = $1 AND EXTRACT(YEAR FROM data) = $2;
    `;

    // Executar a consulta de resumo
    db.query(resumoQuery, [mes, ano], (err, result) => {
        if (err) return res.status(500).send('Erro ao obter resumo.');

        const total_entrada_mes = parseFloat(result.rows[0].total_entrada_mes) || 0;
        const total_saida_mes = parseFloat(result.rows[0].total_saida_mes) || 0;
        const saldo_mes = parseFloat(result.rows[0].saldo_mes) || 0;

        // Executar a consulta de transações
        db.query(transacoesQuery, [mes, ano], (err, transacoesResult) => {
            if (err) return res.status(500).send('Erro ao obter transações.');

            res.render('relatorio_mensal', {
                mes: mes,
                ano: ano,
                total_entrada_mes: total_entrada_mes,
                total_saida_mes: total_saida_mes,
                saldo_mes: saldo_mes,
                transacoes: transacoesResult.rows // Passar as transações para o template
            });
        });
    });
});

//app.use(errorHandler);
app.listen(3000, () => {
    console.log('Servidor rodando na porta 3000');
});
