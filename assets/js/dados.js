// Funções compartilhadas entre o portal e o painel administrativo.

/** Caminho da raiz do site, calculado a partir deste arquivo (funciona em qualquer subpasta). */
export const RAIZ = new URL("../../", import.meta.url);

export async function carregarDados() {
  const resposta = await fetch(new URL("data/programas.json", RAIZ), { cache: "no-cache" });
  if (!resposta.ok) throw new Error(`Não foi possível carregar a lista de programas (erro ${resposta.status}).`);
  return resposta.json();
}

/** Cria um elemento. O texto sempre entra como texto puro, nunca como HTML. */
export function el(tag, atributos = {}, ...filhos) {
  const no = document.createElement(tag);
  for (const [chave, valor] of Object.entries(atributos)) {
    if (valor === null || valor === undefined || valor === false) continue;
    if (chave === "class") no.className = valor;
    else if (chave === "text") no.textContent = valor;
    else if (chave === "style") no.style.cssText = valor;
    else if (chave.startsWith("on")) no.addEventListener(chave.slice(2), valor);
    else if (valor === true) no.setAttribute(chave, "");
    else no.setAttribute(chave, valor);
  }
  for (const filho of filhos.flat()) {
    if (filho === null || filho === undefined || filho === false) continue;
    no.append(filho.nodeType ? filho : document.createTextNode(String(filho)));
  }
  return no;
}

/** Aceita somente endereços https. Qualquer outra coisa vira vazio. */
export function urlSegura(valor) {
  try {
    const url = new URL(String(valor || "").trim());
    return url.protocol === "https:" ? url.href : "";
  } catch {
    return "";
  }
}

export function corSegura(valor, padrao = "#1F4FE0") {
  return /^#[0-9a-fA-F]{6}$/.test(String(valor || "")) ? valor : padrao;
}

/** Versão publicada mais recente: a primeira da lista que tem arquivo para baixar. */
export function versaoAtual(programa) {
  return (programa.versoes || []).find((v) => v.arquivo && urlSegura(v.arquivo.url)) || null;
}

export function formatarData(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso || ""))) return "";
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

export function formatarTamanho(bytes) {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n <= 0) return "";
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  return `${(n / (1024 * 1024)).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB`;
}

/** "FND Controle de Acesso PRO" -> "Controle de Acesso PRO" */
export function nomeSemMarca(nome) {
  return String(nome || "").replace(/^FND\s+/i, "");
}

/** Nome da tag da release de uma versão: cada programa tem o próprio prefixo. */
export function tagDaVersao(idPrograma, versao) {
  return `${idPrograma}-v${versao}`;
}

/** Compara "1.10.0" com "1.9.3" do jeito certo. Retorna >0 se a for maior. */
export function compararVersoes(a, b) {
  const pa = String(a).split(".").map((x) => parseInt(x, 10) || 0);
  const pb = String(b).split(".").map((x) => parseInt(x, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d;
  }
  return 0;
}

export function montarRodape(dados, destino) {
  const c = (dados.portal && dados.portal.contato) || {};
  const links = [
    ["Instagram", urlSegura(c.instagram)],
    ["YouTube", urlSegura(c.youtube)],
    ["WhatsApp", urlSegura(c.whatsapp)],
    ["E-mail", /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(c.email || "") ? `mailto:${c.email}` : ""],
  ].filter(([, url]) => url);
  destino.replaceChildren(
    ...links.map(([rotulo, url]) =>
      el("a", { href: url, rel: "noopener", target: url.startsWith("mailto:") ? null : "_blank", text: rotulo })
    )
  );
  return links.length;
}

/** Confere tudo antes de publicar. Devolve a lista de problemas (vazia = pode publicar). */
export function validarCatalogo(dados, prefixoDownload) {
  const PREFIXO_DOWNLOAD = String(prefixoDownload || "").toLowerCase();
  const erros = [];
  const ids = new Set();
  for (const p of dados.programas) {
    const quem = p.nome || p.id || "Programa sem nome";
    if (!p.nome || !p.nome.trim()) erros.push("Existe um programa sem nome.");
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(p.id || "")) erros.push(`${quem}: o identificador só pode ter letras minúsculas, números e hífen.`);
    if (ids.has(p.id)) erros.push(`${quem}: o identificador "${p.id}" está repetido em outro programa.`);
    ids.add(p.id);
    const vistas = new Set();
    for (const v of p.versoes || []) {
      if (!/^\d+(\.\d+){1,3}$/.test(v.versao || "")) { erros.push(`${quem}: a versão "${v.versao || ""}" precisa estar no formato 1.0.0.`); continue; }
      if (vistas.has(v.versao)) erros.push(`${quem}: a versão ${v.versao} está cadastrada duas vezes.`);
      vistas.add(v.versao);
      if (v.data && !/^\d{4}-\d{2}-\d{2}$/.test(v.data)) erros.push(`${quem} ${v.versao}: data inválida.`);
      const url = (v.arquivo && v.arquivo.url) || "";
      if (url) {
        if (!urlSegura(url)) erros.push(`${quem} ${v.versao}: o link de download precisa começar com https://.`);
        else if (url.toLowerCase().startsWith(PREFIXO_DOWNLOAD)) {
          const tag = decodeURIComponent(url.slice(PREFIXO_DOWNLOAD.length).split("/")[0]);
          if (tag !== tagDaVersao(p.id, v.versao)) {
            erros.push(`${quem} ${v.versao}: o link aponta para a release "${tag}", mas a release desta versão é "${tagDaVersao(p.id, v.versao)}". Cada programa usa somente as próprias releases.`);
          }
        }
        if (v.arquivo.sha256 && !/^[0-9a-fA-F]{64}$/.test(v.arquivo.sha256)) erros.push(`${quem} ${v.versao}: o SHA-256 precisa ter 64 caracteres.`);
      }
    }
  }
  const c = (dados.portal && dados.portal.contato) || {};
  for (const campo of ["instagram", "youtube", "whatsapp"]) {
    if (c[campo] && !urlSegura(c[campo])) erros.push(`Contato ${campo}: o link precisa começar com https://.`);
  }
  if (c.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(c.email)) erros.push("Contato: e-mail inválido.");
  return erros;
}

