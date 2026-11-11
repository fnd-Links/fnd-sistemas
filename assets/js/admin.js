// Painel administrativo do portal FND Sistemas.
// Não existe servidor: o painel conversa direto com a API do GitHub usando um
// token pessoal que fica guardado somente neste navegador. Publicar = gravar
// o arquivo data/programas.json no repositório (um commit).

import { CONFIG, URL_REPOSITORIO } from "./config.js";
import { el, urlSegura, corSegura, tagDaVersao, compararVersoes, versaoAtual, formatarTamanho, validarCatalogo } from "./dados.js";

const CHAVE_TOKEN = "fnd-admin-token";
const app = document.getElementById("app");
const botaoSair = document.getElementById("sair");
const REPO = `/repos/${CONFIG.dono}/${CONFIG.repositorio}`;
const PREFIXO_DOWNLOAD = `${URL_REPOSITORIO}/releases/download/`.toLowerCase();

const estado = { token: "", usuario: "", dados: null, sha: "", sujo: false, selecionado: "portal" };

/* ---------------- Utilidades ---------------- */

function avisar(texto, tipo = "ok", segundos = 7) {
  const caixa = el("div", { class: `aviso ${tipo}`, text: texto });
  document.getElementById("avisos").append(caixa);
  setTimeout(() => caixa.remove(), segundos * 1000);
}

function paraBase64(texto) {
  const bytes = new TextEncoder().encode(texto);
  let binario = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binario += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binario);
}

function deBase64(base64) {
  const binario = atob(base64.replace(/\s/g, ""));
  return new TextDecoder().decode(Uint8Array.from(binario, (c) => c.charCodeAt(0)));
}

class ErroGitHub extends Error {
  constructor(status, mensagem) { super(mensagem); this.status = status; }
}

async function github(caminho, opcoes = {}) {
  let resposta;
  try {
    resposta = await fetch(CONFIG.api + caminho, {
      method: opcoes.method || "GET",
      cache: "no-store",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${estado.token}`,
        "X-GitHub-Api-Version": "2022-11-28",
        ...(opcoes.body ? { "Content-Type": "application/json" } : {}),
      },
      body: opcoes.body ? JSON.stringify(opcoes.body) : undefined,
    });
  } catch {
    throw new ErroGitHub(0, "Sem conexão com o GitHub. Confira a internet e tente de novo.");
  }
  if (resposta.status === 204) return null;
  const corpo = await resposta.json().catch(() => ({}));
  if (!resposta.ok) {
    const textos = {
      401: "O token não foi aceito. Ele pode ter vencido ou ter sido digitado errado.",
      403: "O token não tem permissão para isso. Confira se ele dá acesso de leitura e escrita em Contents neste repositório.",
      404: "Não encontrado no GitHub. Confira se o token dá acesso a este repositório.",
      409: "O arquivo foi alterado no GitHub depois que você abriu o painel. Recarregue os dados antes de publicar.",
    };
    throw new ErroGitHub(resposta.status, textos[resposta.status] || corpo.message || `Erro ${resposta.status} no GitHub.`);
  }
  return corpo;
}

function marcarSujo() {
  if (!estado.sujo) { estado.sujo = true; atualizarBarra(); }
}

function slug(texto) {
  return String(texto).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

const linhas = (texto) => String(texto).split("\n").map((l) => l.trim()).filter(Boolean);

/* ---------------- Entrar ---------------- */

function telaEntrar(erro) {
  botaoSair.hidden = true;
  const token = el("input", { type: "password", id: "token", autocomplete: "off", spellcheck: "false", required: true });
  const lembrar = el("input", { type: "checkbox", id: "lembrar" });
  const botao = el("button", { class: "botao", type: "submit", text: "Entrar" });
  const formulario = el("form", { class: "bloco" },
    el("label", { class: "campo" }, el("span", { text: "Token de acesso do GitHub" }), token,
      el("small", { text: "O token fica guardado só neste navegador e é enviado somente para api.github.com." })),
    el("label", { class: "marcar" }, lembrar, "Lembrar neste computador (não marque em computador de outra pessoa)"),
    el("p", { style: "margin-top:1rem" }, botao)
  );
  formulario.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    botao.disabled = true; botao.textContent = "Entrando…";
    await entrar(token.value.trim(), lembrar.checked);
  });

  app.replaceChildren(
    el("div", { class: "entrar" },
      el("h1", { text: "Área administrativa" }),
      el("p", { text: "Aqui você altera as informações dos programas, cadastra versões e atualiza os links de download. Cada publicação vira um commit no repositório e o portal se atualiza sozinho em cerca de um minuto." }),
      erro && el("p", { class: "aviso erro", text: erro }),
      formulario,
      el("div", { class: "bloco" },
        el("h2", { text: "Como criar o token (uma vez só)" }),
        el("ol", {},
          el("li", {}, "Entre no GitHub com a conta dona do repositório e abra ",
            el("a", { href: "https://github.com/settings/personal-access-tokens/new", target: "_blank", rel: "noopener", text: "Settings, Developer settings, Fine-grained tokens" }), "."),
          el("li", { text: `Em Repository access, escolha "Only select repositories" e marque ${CONFIG.dono}/${CONFIG.repositorio}.` }),
          el("li", { text: 'Em Permissions, Repository permissions, deixe "Contents" como "Read and write". Não precisa de mais nada.' }),
          el("li", { text: "Defina a validade, gere o token e cole no campo acima." })
        ),
        el("p", { class: "vazio", text: "Quem não tem um token válido não consegue alterar nada: esta página só funciona com a permissão da sua conta do GitHub." })
      )
    )
  );
  token.focus();
}

async function entrar(token, lembrar) {
  estado.token = token;
  try {
    const repo = await github(REPO);
    if (!repo.permissions || !repo.permissions.push) {
      throw new ErroGitHub(403, "Este token consegue ler o repositório, mas não tem permissão de escrita. Crie o token com Contents em Read and write.");
    }
    estado.usuario = (repo.owner && repo.owner.login) || CONFIG.dono;
    sessionStorage.removeItem(CHAVE_TOKEN); localStorage.removeItem(CHAVE_TOKEN);
    (lembrar ? localStorage : sessionStorage).setItem(CHAVE_TOKEN, token);
    await carregarDoGitHub();
    botaoSair.hidden = false;
    telaPainel();
  } catch (erro) {
    estado.token = "";
    if (erro.status === 401) { sessionStorage.removeItem(CHAVE_TOKEN); localStorage.removeItem(CHAVE_TOKEN); }
    telaEntrar(erro.message);
  }
}

function sair() {
  if (estado.sujo && !confirm("Existem alterações que ainda não foram publicadas. Sair mesmo assim?")) return;
  sessionStorage.removeItem(CHAVE_TOKEN); localStorage.removeItem(CHAVE_TOKEN);
  Object.assign(estado, { token: "", dados: null, sha: "", sujo: false, selecionado: "portal" });
  telaEntrar();
}

/* ---------------- Dados ---------------- */

async function carregarDoGitHub() {
  const arquivo = await github(`${REPO}/contents/${CONFIG.arquivoDados}?ref=${encodeURIComponent(CONFIG.ramo)}`);
  const dados = JSON.parse(deBase64(arquivo.content));
  dados.portal = dados.portal || {};
  dados.portal.contato = dados.portal.contato || {};
  dados.portal.passos = Array.isArray(dados.portal.passos) ? dados.portal.passos : [];
  while (dados.portal.passos.length < 3) dados.portal.passos.push({ titulo: "", texto: "" });
  dados.programas = Array.isArray(dados.programas) ? dados.programas : [];
  for (const p of dados.programas) {
    p.recursos = p.recursos || []; p.requisitos = p.requisitos || []; p.versoes = p.versoes || [];
    for (const v of p.versoes) { v.notas = v.notas || []; v.arquivo = v.arquivo || {}; }
  }
  estado.dados = dados; estado.sha = arquivo.sha; estado.sujo = false;
}

async function publicar(botao) {
  const dados = estado.dados;
  const erros = validarCatalogo(dados, PREFIXO_DOWNLOAD);
  if (erros.length) { mostrarErros(erros); return; }
  for (const p of dados.programas) p.versoes.sort((a, b) => compararVersoes(b.versao, a.versao));

  botao.disabled = true; botao.textContent = "Publicando…";
  try {
    const resposta = await github(`${REPO}/contents/${CONFIG.arquivoDados}`, {
      method: "PUT",
      body: {
        message: "Atualiza o catálogo de programas pelo painel administrativo",
        content: paraBase64(JSON.stringify(dados, null, 2) + "\n"),
        sha: estado.sha,
        branch: CONFIG.ramo,
      },
    });
    estado.sha = resposta.content.sha; estado.sujo = false;
    avisar("Publicado. O portal mostra as alterações em cerca de um minuto.");
    telaPainel();
  } catch (erro) {
    avisar(erro.message, "erro", 12);
    botao.disabled = false; botao.textContent = "Publicar alterações";
  }
}

function mostrarErros(erros) {
  const caixa = document.getElementById("erros");
  caixa.replaceChildren(
    el("div", { class: "aviso erro" }, el("strong", { text: "Corrija antes de publicar:" }), el("ul", { class: "erros" }, erros.map((e) => el("li", { text: e }))))
  );
  caixa.scrollIntoView({ block: "center" });
}

/* ---------------- Releases ---------------- */

async function acharRelease(tag) {
  const lista = await github(`${REPO}/releases?per_page=100`);
  return lista.find((r) => r.tag_name === tag) || null;
}

async function criarRascunho(programa, versao, retorno) {
  const tag = tagDaVersao(programa.id, versao.versao);
  retorno.replaceChildren(el("span", { text: "Falando com o GitHub…" }));
  try {
    let release = await acharRelease(tag);
    if (!release) {
      release = await github(`${REPO}/releases`, {
        method: "POST",
        body: {
          tag_name: tag,
          target_commitish: CONFIG.ramo,
          name: `${programa.nome} ${versao.versao}`,
          body: versao.notas.map((n) => `- ${n}`).join("\n"),
          draft: true,
        },
      });
    }
    retorno.replaceChildren(
      el("p", { class: "aviso ok" },
        release.draft ? "Rascunho pronto. " : "Esta release já está publicada. ",
        el("a", { href: urlSegura(release.html_url), target: "_blank", rel: "noopener", text: "Abrir a release no GitHub" }),
        release.draft
          ? ". Lá, clique em editar, arraste o ZIP deste programa, clique em Publish release e depois volte aqui e use Buscar arquivo da release."
          : ". Se o ZIP já está lá, use Buscar arquivo da release.")
    );
  } catch (erro) {
    retorno.replaceChildren(el("p", { class: "aviso erro", text: erro.message }));
  }
}

async function buscarArquivo(programa, versao, retorno) {
  const tag = tagDaVersao(programa.id, versao.versao);
  retorno.replaceChildren(el("span", { text: "Procurando a release…" }));
  try {
    const release = await acharRelease(tag);
    if (!release) throw new Error(`Não existe release com a tag ${tag}. Crie o rascunho primeiro.`);
    if (release.draft) throw new Error("A release ainda é um rascunho. Abra a release no GitHub, envie o ZIP e clique em Publish release.");
    const arquivos = release.assets || [];
    const zip = arquivos.find((a) => /\.zip$/i.test(a.name)) || arquivos[0];
    if (!zip) throw new Error("A release está publicada, mas sem nenhum arquivo. Envie o ZIP na página da release.");
    versao.arquivo = {
      nome: zip.name,
      url: zip.browser_download_url,
      tamanho: zip.size,
      sha256: /^sha256:[0-9a-f]{64}$/i.test(zip.digest || "") ? zip.digest.slice(7) : "",
    };
    if (!versao.data && release.published_at) versao.data = release.published_at.slice(0, 10);
    marcarSujo();
    renderizarMenu();
    renderizarEditor();
    avisar(`Arquivo ${zip.name} vinculado à versão ${versao.versao}. Clique em Publicar alterações para o portal mostrar.`);
  } catch (erro) {
    retorno.replaceChildren(el("p", { class: "aviso erro", text: erro.message }));
  }
}

/* ---------------- Painel ---------------- */

function campo(rotulo, entrada, ajuda) {
  return el("label", { class: "campo" }, el("span", { text: rotulo }), entrada, ajuda && el("small", { text: ajuda }));
}

function entradaTexto(objeto, chave, extras = {}) {
  const multilinha = extras.linhas;
  const no = multilinha ? el("textarea", { rows: extras.rows || 4 }) : el("input", { type: extras.type || "text", ...extras.attrs });
  const valor = objeto[chave];
  no.value = multilinha ? (valor || []).join("\n") : valor === undefined || valor === null ? "" : valor;
  no.addEventListener("input", () => {
    objeto[chave] = multilinha ? linhas(no.value) : extras.numero ? (no.value === "" ? "" : Number(no.value)) : no.value;
    marcarSujo();
    if (extras.aoMudar) extras.aoMudar(no.value);
  });
  no.addEventListener("change", () => { if (!multilinha && typeof objeto[chave] === "string") { objeto[chave] = objeto[chave].trim(); no.value = objeto[chave]; } });
  return no;
}

function atualizarBarra() {
  const situacao = document.getElementById("situacao");
  if (!situacao) return;
  situacao.textContent = estado.sujo ? "Há alterações que ainda não foram publicadas." : "Tudo publicado.";
  situacao.classList.toggle("sujo", estado.sujo);
}

function renderizarMenu() {
  const menu = document.getElementById("menu");
  const itens = [
    el("li", {}, el("button", { type: "button", "aria-current": String(estado.selecionado === "portal"), onclick: () => selecionar("portal") }, "Textos do site e contatos")),
    ...estado.dados.programas.map((p, i) => {
      const atual = versaoAtual(p);
      const botao = el("button", { type: "button", "aria-current": String(estado.selecionado === i), style: `--cor-programa:${corSegura(p.cor)}`, onclick: () => selecionar(i) },
        p.nome || "Programa sem nome",
        el("small", { text: `${atual ? `Versão ${atual.versao}` : "Sem download"}${p.visivel === false ? " (oculto)" : ""}` }));
      return el("li", {}, botao);
    }),
  ];
  menu.replaceChildren(...itens);
}

function selecionar(qual) { estado.selecionado = qual; renderizarMenu(); renderizarEditor(); }

function editorPortal() {
  const portal = estado.dados.portal; const c = portal.contato;
  return [
    el("section", { class: "bloco" },
      el("h2", { text: "Textos da página inicial" }),
      campo("Frase de abertura", entradaTexto(portal, "frase")),
      campo("Texto do Suporte", entradaTexto(portal, "suporte")),
      campo("Texto do rodapé", entradaTexto(portal, "rodape"), "Aparece no fim de todas as páginas.")),
    el("section", { class: "bloco" },
      el("h2", { text: "Como baixar e instalar" }),
      portal.passos.map((passo, i) =>
        el("div", { class: "linha-campos" },
          campo(`Passo ${i + 1}: título`, entradaTexto(passo, "titulo")),
          campo(`Passo ${i + 1}: explicação`, entradaTexto(passo, "texto"))))),
    el("section", { class: "bloco" },
      el("h2", { text: "Contatos de suporte" }),
      el("p", { class: "vazio", text: "Campo vazio não aparece no portal." }),
      el("div", { class: "linha-campos", style: "margin-top:.9rem" },
        campo("Instagram (link)", entradaTexto(c, "instagram", { type: "url" })),
        campo("YouTube (link)", entradaTexto(c, "youtube", { type: "url" }))),
      el("div", { class: "linha-campos" },
        campo("WhatsApp (link)", entradaTexto(c, "whatsapp", { type: "url" }), "Exemplo: https://wa.me/5511999999999"),
        campo("E-mail", entradaTexto(c, "email", { type: "email" })))),
  ];
}

function blocoVersao(programa, versao) {
  const retorno = el("div", { class: "retorno" });
  const tag = el("span", { class: "tag", text: tagDaVersao(programa.id, versao.versao || "?") });
  const numeroValido = () => /^\d+(\.\d+){1,3}$/.test(versao.versao || "");
  const exigirNumero = (acao) => () => {
    if (!numeroValido()) { retorno.replaceChildren(el("p", { class: "aviso erro", text: "Preencha o número da versão no formato 1.0.0 antes." })); return; }
    acao();
  };
  versao.arquivo = versao.arquivo || {};
  return el("div", { class: "versao-bloco" },
    el("div", { class: "linha-campos" },
      campo("Número da versão", entradaTexto(versao, "versao", { attrs: { placeholder: "1.0.0", inputmode: "decimal" }, aoMudar: () => { tag.textContent = tagDaVersao(programa.id, versao.versao || "?"); renderizarMenu(); } })),
      campo("Data de publicação", entradaTexto(versao, "data", { type: "date" }))),
    campo("O que mudou (uma novidade por linha)", entradaTexto(versao, "notas", { linhas: true })),
    el("fieldset", {},
      el("legend", { text: "Arquivo para download" }),
      el("p", {}, "Release desta versão no GitHub: ", tag),
      el("div", { class: "acoes", style: "margin-top:.75rem" },
        el("button", { class: "botao secundario pequeno", type: "button", onclick: exigirNumero(() => criarRascunho(programa, versao, retorno)), text: "Criar rascunho da release" }),
        el("button", { class: "botao secundario pequeno", type: "button", onclick: exigirNumero(() => buscarArquivo(programa, versao, retorno)), text: "Buscar arquivo da release" })),
      retorno,
      el("div", { style: "margin-top:.9rem" },
        campo("Link de download", entradaTexto(versao.arquivo, "url", { type: "url", aoMudar: renderizarMenu }), "Preenchido sozinho pelo botão Buscar arquivo da release. Sem link, o portal mostra Download em breve.")),
      el("div", { class: "linha-campos" },
        campo("Nome do arquivo", entradaTexto(versao.arquivo, "nome")),
        campo("Tamanho em bytes", entradaTexto(versao.arquivo, "tamanho", { type: "number", numero: true, attrs: { min: "0" } }), formatarTamanho(versao.arquivo.tamanho) || "")),
      campo("SHA-256 (opcional)", entradaTexto(versao.arquivo, "sha256"))),
    el("p", { style: "margin-top:1rem" },
      el("button", { class: "botao perigo pequeno", type: "button", text: "Remover esta versão", onclick: () => {
        if (!confirm(`Remover a versão ${versao.versao || "sem número"} de ${programa.nome}? A release e o ZIP no GitHub não são apagados.`)) return;
        programa.versoes.splice(programa.versoes.indexOf(versao), 1); marcarSujo(); renderizarMenu(); renderizarEditor();
      } }))
  );
}

function editorPrograma(indice) {
  const lista = estado.dados.programas;
  const p = lista[indice];
  const idTravado = p.versoes.length > 0 && !p._novo;
  const cor = el("input", { type: "color" }); cor.value = corSegura(p.cor);
  cor.addEventListener("input", () => { p.cor = cor.value; marcarSujo(); renderizarMenu(); });
  const visivel = el("input", { type: "checkbox" }); visivel.checked = p.visivel !== false;
  visivel.addEventListener("change", () => { p.visivel = visivel.checked; marcarSujo(); renderizarMenu(); });
  const mover = (delta) => () => {
    const novo = indice + delta; if (novo < 0 || novo >= lista.length) return;
    [lista[indice], lista[novo]] = [lista[novo], lista[indice]]; estado.selecionado = novo; marcarSujo(); renderizarMenu(); renderizarEditor();
  };

  return [
    el("section", { class: "bloco" },
      el("div", { class: "cabeca" }, el("h2", { text: "Informações do programa" }),
        el("div", { class: "acoes" },
          el("button", { class: "botao secundario pequeno", type: "button", onclick: mover(-1), disabled: indice === 0, text: "Subir na lista" }),
          el("button", { class: "botao secundario pequeno", type: "button", onclick: mover(1), disabled: indice === lista.length - 1, text: "Descer na lista" }))),
      el("div", { class: "linha-campos" },
        campo("Nome", entradaTexto(p, "nome", { aoMudar: renderizarMenu })),
        campo("Identificador", entradaTexto(p, "id", { attrs: idTravado ? { readonly: true } : {} }),
          idTravado ? "Travado: já é usado no endereço da página e nas tags das releases." : "Usado no endereço da página e nas tags das releases. Letras minúsculas, números e hífen.")),
      campo("Resumo (uma frase)", entradaTexto(p, "resumo")),
      campo("Descrição", (() => { const t = el("textarea", { rows: 5 }); t.value = p.descricao || ""; t.addEventListener("input", () => { p.descricao = t.value.trim(); marcarSujo(); }); return t; })()),
      el("div", { class: "linha-campos" },
        campo("Recursos (um por linha)", entradaTexto(p, "recursos", { linhas: true, rows: 6 })),
        campo("Requisitos (um por linha)", entradaTexto(p, "requisitos", { linhas: true, rows: 6 }))),
      el("div", { class: "linha-campos" },
        campo("Cor do programa", cor),
        el("label", { class: "marcar" }, visivel, "Mostrar no portal"))),
    el("section", { class: "bloco" },
      el("div", { class: "cabeca" }, el("h2", { text: "Versões" }),
        el("button", { class: "botao pequeno", type: "button", text: "Cadastrar nova versão", onclick: () => {
          p.versoes.unshift({ versao: "", data: new Date().toISOString().slice(0, 10), notas: [], arquivo: { nome: "", url: "", tamanho: "", sha256: "" } });
          marcarSujo(); renderizarEditor();
        } })),
      p.versoes.length
        ? p.versoes.map((v) => blocoVersao(p, v))
        : el("p", { class: "vazio", text: "Nenhuma versão cadastrada. O portal mostra Download em breve para este programa." })),
    el("section", { class: "bloco" },
      el("h2", { text: "Remover programa" }),
      el("p", { text: "Tira o programa do catálogo. As releases e os ZIPs que já estão no GitHub continuam lá." }),
      el("p", { style: "margin-top:.9rem" }, el("button", { class: "botao perigo pequeno", type: "button", text: "Remover este programa", onclick: () => {
        if (!confirm(`Remover ${p.nome || "este programa"} do catálogo?`)) return;
        lista.splice(indice, 1); estado.selecionado = "portal"; marcarSujo(); renderizarMenu(); renderizarEditor();
      } }))),
  ];
}

function renderizarEditor() {
  const editor = document.getElementById("editor");
  document.getElementById("erros").replaceChildren();
  editor.replaceChildren(...(estado.selecionado === "portal" ? editorPortal() : editorPrograma(estado.selecionado)));
}

function adicionarPrograma() {
  const nome = prompt("Nome do novo programa (exemplo: FND Agenda):");
  if (!nome || !nome.trim()) return;
  let id = slug(nome); const usados = new Set(estado.dados.programas.map((p) => p.id));
  if (!id) id = "programa";
  let n = 2; const base = id; while (usados.has(id)) id = `${base}-${n++}`;
  estado.dados.programas.push({ id, nome: nome.trim(), resumo: "", descricao: "", recursos: [], requisitos: ["Windows 10 ou 11"], cor: "#0182FC", visivel: true, versoes: [], _novo: true });
  marcarSujo(); selecionar(estado.dados.programas.length - 1);
}

function telaPainel() {
  const botaoPublicar = el("button", { class: "botao", type: "button", text: "Publicar alterações" });
  botaoPublicar.addEventListener("click", () => {
    for (const p of estado.dados.programas) delete p._novo;
    publicar(botaoPublicar);
  });
  app.replaceChildren(
    el("div", { class: "barra" },
      el("span", { class: "situacao", id: "situacao" }),
      el("div", { class: "acoes" },
        el("button", { class: "botao secundario", type: "button", text: "Recarregar do GitHub", onclick: async () => {
          if (estado.sujo && !confirm("Recarregar descarta as alterações que ainda não foram publicadas. Continuar?")) return;
          try { await carregarDoGitHub(); estado.selecionado = "portal"; telaPainel(); avisar("Dados recarregados."); } catch (erro) { avisar(erro.message, "erro", 12); }
        } }),
        botaoPublicar)),
    el("div", { id: "erros" }),
    el("div", { class: "painel" },
      el("div", {},
        el("ul", { class: "menu", id: "menu" }),
        el("button", { class: "botao secundario pequeno", type: "button", text: "Adicionar programa", onclick: adicionarPrograma })),
      el("div", { id: "editor" }))
  );
  if (estado.selecionado !== "portal" && !estado.dados.programas[estado.selecionado]) estado.selecionado = "portal";
  atualizarBarra(); renderizarMenu(); renderizarEditor();
}

/* ---------------- Início ---------------- */

botaoSair.addEventListener("click", (evento) => { evento.preventDefault(); sair(); });
window.addEventListener("beforeunload", (evento) => { if (estado.sujo) { evento.preventDefault(); evento.returnValue = ""; } });

const guardado = sessionStorage.getItem(CHAVE_TOKEN) || localStorage.getItem(CHAVE_TOKEN);
if (guardado) {
  app.replaceChildren(el("p", { class: "vazio", text: "Entrando…" }));
  entrar(guardado, Boolean(localStorage.getItem(CHAVE_TOKEN)));
} else {
  telaEntrar();
}
